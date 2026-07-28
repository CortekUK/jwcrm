// POST /api/wills/[id]/sign
//
// Records the client's signature on their FINALISED will and produces a
// signed COPY of the document.
//
// Why a copy rather than an edit: the finalised PDF at wills.pdf_path is
// normally the team's hand-edited document (drafted in Word, then uploaded),
// so regenerating it from `answers` would throw those edits away. Instead the
// stored PDF is loaded as-is and ONE execution page is appended carrying the
// signature. The original file is never touched — the signed version is
// written to a new path (wills.signed_pdf_path), leaving two distinct
// documents.
//
// The page is appended rather than stamped onto the last page because the
// uploaded document's layout is unknown; drawing at a guessed coordinate
// could land on top of existing text or the court's attestation block.

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import { companyDetails } from "@/config/company";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id: willId } = await context.params;

    const authHeader = request.headers.get("authorization") || "";
    const accessToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
    if (!accessToken) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { data: userInfo, error: userErr } = await supabaseAdmin.auth.getUser(accessToken);
    if (userErr || !userInfo?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const callerId = userInfo.user.id;

    const body = await request.json().catch(() => ({}));
    const signature: string | undefined = body.signature;
    if (!signature || typeof signature !== "string" || !signature.startsWith("data:image/")) {
      return NextResponse.json(
        { error: "A signature image is required" },
        { status: 400 }
      );
    }

    const { data: will, error: willError } = await supabaseAdmin
      .from("wills")
      .select("id, user_id, status, pdf_path, answers")
      .eq("id", willId)
      .single();

    if (willError || !will) {
      return NextResponse.json({ error: "Will not found" }, { status: 404 });
    }

    // Only the testator may sign, and only their own will.
    if (will.user_id !== callerId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    if (will.status !== "finalized") {
      return NextResponse.json(
        { error: "Only a finalised will can be signed" },
        { status: 409 }
      );
    }
    if (!will.pdf_path) {
      return NextResponse.json(
        { error: "This will has no document to sign yet" },
        { status: 409 }
      );
    }

    const signedAt = new Date();

    // Client display name, for the execution wording.
    const answers = (will.answers as Record<string, any>) || {};
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("full_name")
      .eq("user_id", will.user_id)
      .maybeSingle();
    const clientName =
      answers?.personal?.full_name || profile?.full_name || "The Testator";

    // Load the finalised document exactly as it was uploaded.
    const { data: originalFile, error: downloadError } = await supabaseAdmin.storage
      .from("wills")
      .download(will.pdf_path);

    if (downloadError || !originalFile) {
      console.error("Could not download finalised will:", downloadError);
      return NextResponse.json(
        { error: "Could not read the finalised document" },
        { status: 500 }
      );
    }

    let signedBytes: Uint8Array;
    try {
      const pdfDoc = await PDFDocument.load(await originalFile.arrayBuffer());

      // Match the appended page to the document's own size where possible.
      const existingPages = pdfDoc.getPages();
      const { width, height } =
        existingPages.length > 0
          ? existingPages[existingPages.length - 1].getSize()
          : { width: 595.28, height: 841.89 }; // A4 fallback

      const page = pdfDoc.addPage([width, height]);
      const helv = await pdfDoc.embedFont(StandardFonts.TimesRoman);
      const helvBold = await pdfDoc.embedFont(StandardFonts.TimesRomanBold);

      const green = rgb(0.047, 0.333, 0.212); // #0C5536
      const grey = rgb(0.42, 0.42, 0.42);
      const M = 56;
      let y = height - 90;

      page.drawText("EXECUTION BY ELECTRONIC SIGNATURE", {
        x: M,
        y,
        size: 14,
        font: helvBold,
        color: green,
      });
      y -= 28;

      page.drawLine({
        start: { x: M, y },
        end: { x: width - M, y },
        thickness: 0.75,
        color: rgb(0.85, 0.85, 0.85),
      });
      y -= 34;

      const intro = `I, ${clientName}, confirm that I have reviewed the foregoing Will and that it reflects my wishes. I have signed it electronically as set out below.`;
      // Simple width-aware wrap so long names never overflow the page.
      const maxWidth = width - M * 2;
      const words = intro.split(" ");
      let line = "";
      for (const word of words) {
        const candidate = line ? `${line} ${word}` : word;
        if (helv.widthOfTextAtSize(candidate, 11) > maxWidth) {
          page.drawText(line, { x: M, y, size: 11, font: helv });
          y -= 16;
          line = word;
        } else {
          line = candidate;
        }
      }
      if (line) {
        page.drawText(line, { x: M, y, size: 11, font: helv });
        y -= 16;
      }
      y -= 24;

      page.drawText(`NAME: ${clientName}`, { x: M, y, size: 11, font: helv });
      y -= 30;

      page.drawText("SIGNATURE:", { x: M, y, size: 11, font: helv });

      // Embed the drawn signature.
      const base64 = signature.includes(",") ? signature.split(",")[1] : signature;
      const pngImage = await pdfDoc.embedPng(Buffer.from(base64, "base64"));
      const sigWidth = 170;
      const sigDims = pngImage.scaleToFit(sigWidth, 60);
      page.drawImage(pngImage, {
        x: M + 80,
        y: y - sigDims.height + 10,
        width: sigDims.width,
        height: sigDims.height,
      });
      y -= Math.max(sigDims.height, 24) + 6;

      page.drawLine({
        start: { x: M + 80, y },
        end: { x: M + 80 + sigWidth, y },
        thickness: 0.75,
        color: rgb(0.75, 0.75, 0.75),
      });
      y -= 20;

      page.drawText(
        `Signed electronically on ${signedAt.toLocaleString("en-GB", { timeZone: "Asia/Dubai" })} (GST)`,
        { x: M + 80, y, size: 9, font: helv, color: grey }
      );
      y -= 40;

      page.drawText(`Will reference: ${will.id}`, {
        x: M,
        y,
        size: 9,
        font: helv,
        color: grey,
      });
      y -= 14;
      page.drawText(
        `This page was appended to the finalised Will by ${companyDetails.legalName}. The preceding pages are unaltered.`,
        { x: M, y, size: 9, font: helv, color: grey }
      );

      signedBytes = await pdfDoc.save();
    } catch (pdfErr) {
      console.error("Failed to build signed PDF:", pdfErr);
      return NextResponse.json(
        { error: "Could not produce the signed document" },
        { status: 500 }
      );
    }

    // Write the signed copy to its OWN path — pdf_path is left untouched.
    const signedPath = `${will.user_id}/signed_${willId}_${Date.now()}.pdf`;
    const { error: uploadError } = await supabaseAdmin.storage
      .from("wills")
      .upload(signedPath, Buffer.from(signedBytes), {
        contentType: "application/pdf",
        upsert: true,
      });

    if (uploadError) {
      console.error("Signed PDF upload failed:", uploadError);
      return NextResponse.json(
        { error: "Could not save the signed document" },
        { status: 500 }
      );
    }

    const signedAtIso = signedAt.toISOString();
    const { error: updateError } = await supabaseAdmin
      .from("wills")
      .update({
        client_signature: signature,
        client_signature_at: signedAtIso,
        signed_pdf_path: signedPath,
      })
      .eq("id", willId);

    if (updateError) {
      console.error("Failed to record signature:", updateError);
      return NextResponse.json(
        { error: "Could not record the signature" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      signedPdfPath: signedPath,
      signedAt: signedAtIso,
    });
  } catch (error) {
    console.error("sign route crashed:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
