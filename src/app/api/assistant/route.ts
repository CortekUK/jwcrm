// POST /api/assistant
//
// Staff help chatbot. How-to guidance only: the model is given the hand-written
// knowledge base (src/lib/assistant/knowledge), filtered by the caller's roles,
// and never any live business data. Nothing is stored — the conversation lives
// in the browser and is sent in full with each request.
//
// Auth: Bearer access token, same as /api/feedback. Users whose only role is
// `client` (or who have no role) are refused.
//
// Body: { messages: [{ role: "user" | "assistant", content: string }], pagePath?: string }
// Response: streamed plain text (text/plain; charset=utf-8). Errors are JSON
// { error } with 400/401/403/429/503/500.

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import OpenAI from "openai";
import type { Stream } from "openai/streaming";
import type { ChatCompletionChunk } from "openai/resources/chat/completions";
import { buildPrompt } from "@/lib/assistant/buildPrompt";
import { ALL_SECTIONS } from "@/lib/assistant/knowledge";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "",
  process.env.SUPABASE_SERVICE_ROLE_KEY || ""
);

const MAX_MESSAGES = 20;
const MAX_CONTENT_CHARS = 2000;
const MAX_PAGE_PATH_CHARS = 300;

// Simple sliding-window rate limit. In-memory, so it is per server instance
// (each serverless instance / dev process keeps its own count) and resets on
// restart. Good enough to stop runaway usage; not a hard global quota.
const RATE_LIMIT = 30;
const RATE_WINDOW_MS = 60 * 60 * 1000;
const rateBuckets = new Map<string, number[]>();

function checkRateLimit(userId: string): { ok: boolean; retryAfterSec: number } {
  const now = Date.now();
  const recent = (rateBuckets.get(userId) || []).filter((t) => now - t < RATE_WINDOW_MS);
  if (recent.length >= RATE_LIMIT) {
    rateBuckets.set(userId, recent);
    return { ok: false, retryAfterSec: Math.ceil((RATE_WINDOW_MS - (now - recent[0])) / 1000) };
  }
  recent.push(now);
  rateBuckets.set(userId, recent);
  // Opportunistic cleanup so the map doesn't grow without bound.
  if (rateBuckets.size > 5000) {
    rateBuckets.forEach((times, key) => {
      if (!times.some((t) => now - t < RATE_WINDOW_MS)) rateBuckets.delete(key);
    });
  }
  return { ok: true, retryAfterSec: 0 };
}

type ChatMessage = { role: "user" | "assistant"; content: string };

function validateBody(
  raw: unknown
): { ok: true; messages: ChatMessage[]; pagePath: string } | { ok: false; error: string } {
  if (!raw || typeof raw !== "object") return { ok: false, error: "Invalid request body" };
  const body = raw as { messages?: unknown; pagePath?: unknown };
  if (!Array.isArray(body.messages) || body.messages.length === 0) {
    return { ok: false, error: "messages must be a non-empty array" };
  }
  const messages: ChatMessage[] = [];
  for (const m of body.messages) {
    if (!m || typeof m !== "object") return { ok: false, error: "Invalid message" };
    const { role, content } = m as { role?: unknown; content?: unknown };
    if (role !== "user" && role !== "assistant") {
      return { ok: false, error: "Invalid message role" };
    }
    if (typeof content !== "string" || !content.trim()) {
      return { ok: false, error: "Message content must be a non-empty string" };
    }
    if (content.length > MAX_CONTENT_CHARS) {
      return { ok: false, error: `Each message must be ${MAX_CONTENT_CHARS} characters or fewer` };
    }
    messages.push({ role, content });
  }
  // Keep only the most recent messages, and make sure the window starts with
  // a user turn and ends with one (the question being asked).
  let trimmed = messages.slice(-MAX_MESSAGES);
  while (trimmed.length && trimmed[0].role !== "user") trimmed = trimmed.slice(1);
  if (!trimmed.length || trimmed[trimmed.length - 1].role !== "user") {
    return { ok: false, error: "The last message must be from the user" };
  }
  const pagePath =
    typeof body.pagePath === "string" ? body.pagePath.slice(0, MAX_PAGE_PATH_CHARS) : "";
  return { ok: true, messages: trimmed, pagePath };
}

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization") || "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
    if (!token) {
      return NextResponse.json({ error: "Missing authorization header" }, { status: 401 });
    }

    const { data: userInfo, error: userError } = await supabaseAdmin.auth.getUser(token);
    const user = userInfo?.user;
    if (userError || !user) {
      return NextResponse.json({ error: "Invalid authentication" }, { status: 401 });
    }

    const { data: roleRows, error: rolesError } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id);
    if (rolesError) {
      console.error("assistant: failed to load roles", rolesError);
      return NextResponse.json({ error: "Could not verify your account" }, { status: 500 });
    }
    const roles = Array.from(
      new Set((roleRows || []).map((r: { role: string }) => r.role))
    );
    const staffRoles = roles.filter((r) => r !== "client");
    if (staffRoles.length === 0) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    let rawBody: unknown;
    try {
      rawBody = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }
    const validation = validateBody(rawBody);
    if (!validation.ok) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    // Prefer the server-only key; fall back to the existing project key (also
    // used by document scanning) so one key serves both.
    const apiKey =
      process.env.OPENAI_API_KEY || process.env.NEXT_PUBLIC_OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "The help assistant isn't set up yet. Please try again later or use “Report an issue”." },
        { status: 503 }
      );
    }

    const limit = checkRateLimit(user.id);
    if (!limit.ok) {
      return NextResponse.json(
        { error: "You've reached the hourly limit for the help assistant. Please try again later." },
        { status: 429, headers: { "Retry-After": String(limit.retryAfterSec) } }
      );
    }

    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("full_name")
      .eq("user_id", user.id)
      .maybeSingle();
    const name =
      (profile?.full_name as string | null | undefined)?.trim() ||
      (user.user_metadata?.full_name as string | undefined)?.trim() ||
      "";

    const { prompt } = buildPrompt({
      roles: staffRoles,
      name,
      pagePath: validation.pagePath,
      sections: ALL_SECTIONS,
    });

    const openai = new OpenAI({ apiKey });
    let completion: Stream<ChatCompletionChunk>;
    try {
      completion = await openai.chat.completions.create({
        model: process.env.ASSISTANT_MODEL || "gpt-4o-mini",
        temperature: 0.2,
        max_tokens: 700,
        stream: true,
        messages: [{ role: "system", content: prompt }, ...validation.messages],
      });
    } catch (err) {
      console.error("assistant: OpenAI request failed", err);
      const status = (err as { status?: number })?.status;
      if (status === 429) {
        return NextResponse.json(
          { error: "The help assistant is busy right now. Please try again in a minute." },
          { status: 503 }
        );
      }
      return NextResponse.json({ error: "The help assistant could not answer right now" }, { status: 500 });
    }

    const encoder = new TextEncoder();
    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        try {
          for await (const chunk of completion) {
            const text = chunk.choices[0]?.delta?.content;
            if (text) controller.enqueue(encoder.encode(text));
          }
          controller.close();
        } catch (err) {
          console.error("assistant: stream failed", err);
          controller.error(err);
        }
      },
      cancel() {
        completion.controller.abort();
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    console.error("assistant: unexpected error", error);
    return NextResponse.json({ error: "The help assistant could not answer right now" }, { status: 500 });
  }
}
