"use client";

// Floating "Help assistant" chat for staff screens. How-to guidance only —
// the server answers from the hand-written knowledge base, never live data.
// The conversation is kept in React state only and disappears on refresh.

import { useCallback, useEffect, useRef, useState } from "react";
import { Bot, Loader2, MessageCircleQuestion, RotateCcw, Send, X } from "lucide-react";
import { toast } from "sonner";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

type ChatMessage = { role: "user" | "assistant"; content: string };

const MAX_INPUT = 2000;
const MAX_SENT_MESSAGES = 20;
// The app's sonner toasts default to bottom-right, exactly where this panel
// sits; show the assistant's own errors at the top so they don't cover it.
const TOAST_POSITION = "top-center" as const;

interface Starter {
  key: string;
  fallback: string;
}

// First matching role wins; every list ends with the all-staff question.
const ROLE_STARTERS: { roles: string[]; starters: Starter[] }[] = [
  {
    roles: ["superadmin", "admin"],
    starters: [
      { key: "assistant.starters.addUser", fallback: "How do I add a new staff user?" },
      { key: "assistant.starters.sendProposal", fallback: "How do I send a proposal?" },
    ],
  },
  {
    roles: ["hr"],
    starters: [
      { key: "assistant.starters.leaveBalance", fallback: "How do I check an employee's remaining leave?" },
      { key: "assistant.starters.approveLeave", fallback: "How do I approve a leave request?" },
    ],
  },
  {
    roles: ["salesperson", "account_manager"],
    starters: [
      { key: "assistant.starters.sendProposal", fallback: "How do I send a proposal?" },
      { key: "assistant.starters.convertLead", fallback: "How do I convert a lead into a client?" },
    ],
  },
  {
    roles: ["lead_management"],
    starters: [
      { key: "assistant.starters.assignLead", fallback: "How do I assign a lead to a salesperson?" },
      { key: "assistant.starters.convertLead", fallback: "How do I convert a lead into a client?" },
    ],
  },
  {
    roles: ["finance"],
    starters: [
      { key: "assistant.starters.recordPayment", fallback: "How do I record a payment on an invoice?" },
      { key: "assistant.starters.sendProposal", fallback: "How do I send a proposal?" },
    ],
  },
];

const ALL_STAFF_STARTER: Starter = {
  key: "assistant.starters.requestLeave",
  fallback: "How do I request leave?",
};

function startersFor(roles: string[]): Starter[] {
  const match = ROLE_STARTERS.find((g) => g.roles.some((r) => roles.includes(r)));
  return [...(match?.starters ?? []), ALL_STAFF_STARTER].slice(0, 3);
}

// Assistant replies are markdown (numbered steps, nested lists, tables, code).
// react-markdown builds React nodes and ignores raw HTML, so model output can
// never inject markup. Every block gets dir="auto" so Arabic and English lines
// each align correctly, even when mixed in one reply.
const markdownComponents: Components = {
  p: ({ children }) => <p dir="auto" className="my-1.5 first:mt-0 last:mb-0">{children}</p>,
  h1: ({ children }) => <p dir="auto" className="mb-1 mt-3 font-semibold first:mt-0">{children}</p>,
  h2: ({ children }) => <p dir="auto" className="mb-1 mt-3 font-semibold first:mt-0">{children}</p>,
  h3: ({ children }) => <p dir="auto" className="mb-1 mt-2 font-semibold first:mt-0">{children}</p>,
  h4: ({ children }) => <p dir="auto" className="mb-1 mt-2 font-semibold first:mt-0">{children}</p>,
  ul: ({ children }) => <ul dir="auto" className="my-1.5 list-disc space-y-1 ps-5">{children}</ul>,
  ol: ({ children }) => <ol dir="auto" className="my-1.5 list-decimal space-y-1 ps-5">{children}</ol>,
  li: ({ children }) => <li className="ps-0.5 [&>ol]:my-1 [&>ul]:my-1">{children}</li>,
  strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
  a: ({ href, children }) => (
    <a href={href} target="_blank" rel="noopener noreferrer" className="text-[#0C5536] underline underline-offset-2">
      {children}
    </a>
  ),
  code: ({ children, className }) =>
    className ? (
      <code className={className}>{children}</code>
    ) : (
      <code dir="ltr" className="rounded bg-background/70 px-1 py-0.5 text-[0.85em]">{children}</code>
    ),
  pre: ({ children }) => (
    <pre dir="ltr" className="my-2 overflow-x-auto rounded-md bg-background/70 p-2 text-xs">{children}</pre>
  ),
  blockquote: ({ children }) => (
    <blockquote dir="auto" className="my-2 border-s-2 border-[#0C5536]/40 ps-3 text-muted-foreground">{children}</blockquote>
  ),
  hr: () => <hr className="my-2 border-border" />,
  table: ({ children }) => (
    <div className="my-2 max-w-full overflow-x-auto rounded-md border border-border">
      <table dir="auto" className="w-full border-collapse text-xs">{children}</table>
    </div>
  ),
  th: ({ children }) => <th className="border-b border-border bg-background/60 px-2 py-1 text-start font-semibold">{children}</th>,
  td: ({ children }) => <td className="border-b border-border px-2 py-1 align-top last:border-b-0">{children}</td>,
};

function AssistantText({ text }: { text: string }) {
  return (
    <div className="break-words text-sm leading-relaxed [overflow-wrap:anywhere]">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
        {text}
      </ReactMarkdown>
    </div>
  );
}

export function AssistantWidget() {
  const { t, i18n } = useTranslation("common");
  const isRtl = i18n.language === "ar";
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [pending, setPending] = useState(false); // waiting for the first chunk
  const [streaming, setStreaming] = useState(false);
  const [roles, setRoles] = useState<string[] | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const busy = pending || streaming;
  const title = t("assistant.title", "Help assistant");

  // Load the user's roles once, the first time the panel opens, to pick starters.
  useEffect(() => {
    if (!open || roles !== null) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase.auth.getSession();
      const userId = data.session?.user?.id;
      if (!userId) return;
      const { data: rows } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId);
      if (!cancelled) setRoles((rows || []).map((r: { role: string }) => r.role));
    })();
    return () => {
      cancelled = true;
    };
  }, [open, roles]);

  // Keep the newest message in view.
  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, pending]);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  // Stop any in-flight request when the widget unmounts.
  useEffect(() => () => abortRef.current?.abort(), []);

  const send = useCallback(
    async (text: string) => {
      const content = text.trim();
      if (!content || busy) return;
      if (content.length > MAX_INPUT) {
        toast.error(t("assistant.tooLong", "Please keep your message under 2000 characters."), {
          position: TOAST_POSITION,
        });
        return;
      }

      const history: ChatMessage[] = [...messages, { role: "user", content }];
      setMessages(history);
      setInput("");
      setPending(true);

      const controller = new AbortController();
      abortRef.current = controller;
      let started = false;

      try {
        const { data } = await supabase.auth.getSession();
        const token = data.session?.access_token;
        if (!token) {
          throw new Error(t("assistant.notSignedIn", "Your session has expired. Please sign in again."));
        }

        const res = await fetch("/api/assistant", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            messages: history.slice(-MAX_SENT_MESSAGES),
            pagePath: window.location.pathname,
          }),
          signal: controller.signal,
        });

        if (!res.ok || !res.body) {
          const json = await res.json().catch(() => ({}));
          throw new Error(json?.error || `Request failed (${res.status})`);
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let reply = "";
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          reply += decoder.decode(value, { stream: true });
          if (!started) {
            started = true;
            setPending(false);
            setStreaming(true);
            setMessages((prev) => [...prev, { role: "assistant", content: reply }]);
          } else {
            const snapshot = reply;
            setMessages((prev) => {
              const next = prev.slice();
              next[next.length - 1] = { role: "assistant", content: snapshot };
              return next;
            });
          }
        }
        reply += decoder.decode();
        if (!reply.trim()) {
          throw new Error(t("assistant.empty", "The assistant didn't reply. Please try again."));
        }
      } catch (err) {
        if (controller.signal.aborted) return;
        const msg = err instanceof Error ? err.message : "";
        toast.error(t("assistant.failed", "The help assistant couldn't answer"), {
          description: msg || undefined,
          position: TOAST_POSITION,
        });
        // Roll back an unanswered question so it can be re-sent.
        if (!started) {
          setMessages((prev) => prev.slice(0, -1));
          setInput(content);
        }
      } finally {
        if (abortRef.current === controller) abortRef.current = null;
        setPending(false);
        setStreaming(false);
      }
    },
    [busy, messages, t]
  );

  const newChat = () => {
    abortRef.current?.abort();
    abortRef.current = null;
    setMessages([]);
    setInput("");
    setPending(false);
    setStreaming(false);
    inputRef.current?.focus();
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      void send(input);
    }
  };

  const starters = startersFor(roles ?? []);

  return (
    <>
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label={t("assistant.open", "Open help assistant")}
          title={title}
          className={cn(
            "fixed bottom-5 z-40 flex h-12 w-12 items-center justify-center rounded-full bg-[#0C5536] text-white shadow-lg transition hover:bg-[#0a4730] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#C6A03B] focus-visible:ring-offset-2 print:hidden",
            isRtl ? "left-5" : "right-5"
          )}
        >
          <MessageCircleQuestion className="h-6 w-6" />
        </button>
      )}

      {open && (
        <div
          role="dialog"
          aria-label={title}
          dir={isRtl ? "rtl" : "ltr"}
          className={cn(
            "fixed z-40 flex flex-col overflow-hidden bg-background shadow-2xl print:hidden",
            // Mobile: full-screen sheet. Desktop: 380×560 panel in the corner.
            "inset-0 sm:inset-auto sm:bottom-5 sm:h-[560px] sm:max-h-[calc(100dvh-2.5rem)] sm:w-[380px] sm:rounded-xl sm:border",
            isRtl ? "sm:left-5" : "sm:right-5"
          )}
        >
          <div className="flex items-center gap-2 border-b bg-[#0C5536] px-4 py-3 text-white">
            <Bot className="h-5 w-5 shrink-0" />
            <h2 className="flex-1 truncate text-sm font-semibold">{title}</h2>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={newChat}
              disabled={messages.length === 0 && !busy}
              className="h-8 gap-1 px-2 text-white hover:bg-white/10 hover:text-white"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              <span className="text-xs">{t("assistant.newChat", "New chat")}</span>
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => setOpen(false)}
              aria-label={t("assistant.close", "Close")}
              className="h-8 w-8 text-white hover:bg-white/10 hover:text-white"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          <div ref={listRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-4 text-sm" aria-live="polite">
            {messages.length === 0 && (
              <div className="space-y-3">
                <p className="text-muted-foreground">
                  {t(
                    "assistant.intro",
                    "Hi! Ask me how to do something in the CRM and I'll walk you through it. I can't see your data — just how the system works."
                  )}
                </p>
                <p className="text-xs font-medium text-muted-foreground">
                  {t("assistant.tryAsking", "Try asking:")}
                </p>
                <div className="flex flex-col gap-2">
                  {starters.map((s) => {
                    const q = t(s.key, s.fallback);
                    return (
                      <button
                        key={s.key}
                        type="button"
                        onClick={() => void send(q)}
                        disabled={busy}
                        className="rounded-lg border px-3 py-2 text-start text-sm transition hover:border-[#0C5536]/40 hover:bg-[rgba(12,85,54,0.06)] disabled:opacity-50"
                      >
                        {q}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {messages.map((m, i) => (
              <div key={i} className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}>
                <div
                  dir="auto"
                  className={cn(
                    "max-w-[85%] rounded-2xl px-3 py-2",
                    m.role === "user"
                      ? "whitespace-pre-wrap break-words bg-[#0C5536] text-white"
                      : "bg-muted text-foreground"
                  )}
                >
                  {m.role === "user" ? m.content : <AssistantText text={m.content} />}
                </div>
              </div>
            ))}

            {pending && (
              <div className="flex justify-start">
                <div className="flex items-center gap-2 rounded-2xl bg-muted px-3 py-2 text-muted-foreground">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  <span>{t("assistant.thinking", "Thinking…")}</span>
                </div>
              </div>
            )}
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              void send(input);
            }}
            className="flex items-end gap-2 border-t p-3"
          >
            <Textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={onKeyDown}
              maxLength={MAX_INPUT}
              rows={1}
              dir="auto"
              placeholder={t("assistant.placeholder", "Ask how to do something…")}
              className="max-h-32 min-h-[40px] flex-1 resize-none text-sm"
            />
            <Button
              type="submit"
              size="icon"
              disabled={busy || !input.trim()}
              aria-label={t("assistant.send", "Send")}
              className="h-10 w-10 shrink-0 bg-[#0C5536] hover:bg-[#0a4730]"
            >
              {busy ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className={cn("h-4 w-4", isRtl && "-scale-x-100")} />
              )}
            </Button>
          </form>
          <p className="px-3 pb-2 text-center text-[10px] text-muted-foreground">
            {t("assistant.disclaimer", "Answers are guidance only and may be wrong. Chats aren't saved.")}
          </p>
        </div>
      )}
    </>
  );
}
