import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { generateWillPDF } from "@/lib/pdf/generateWillPDF";
import { generateWillDocx } from "@/lib/docx/generateWillDocx";
import type { Answers, WillJurisdiction } from "@/types/will-form";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Verify the caller is an authenticated admin.
    const authHeader = request.headers.get("authorization") || "";
    const accessToken = authHeader.startsWith("Bearer ")
      ? authHeader.slice(7)
      : null;
    if (!accessToken) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { data: userInfo } = await supabaseAdmin.auth.getUser(accessToken);
    const callerId = userInfo?.user?.id;
    if (!callerId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { data: isAdmin } = await supabaseAdmin.rpc("has_role", {
      _user_id: callerId,
      _role: "admin",
    });
    if (!isAdmin) {
      return NextResponse.json(
        { error: "Admin access required" },
        { status: 403 }
      );
    }

    const { id } = await params;
    const body = await request.json().catch(() => ({}));

    // Fetch the will
    const { data: will, error: willError } = await supabaseAdmin
      .from("wills")
      .select("*")
      .eq("id", id)
      .single();
    if (willError || !will) {
      return NextResponse.json({ error: "Will not found" }, { status: 404 });
    }

    const answers = (will.answers || {}) as Answers;

    // Jurisdiction: explicit override from the request, else stored on the will,
    // else default to Abu Dhabi.
    const jurisdiction: WillJurisdiction =
      body.jurisdiction === "dubai" || body.jurisdiction === "abu_dhabi"
        ? body.jurisdiction
        : answers.jurisdiction || "abu_dhabi";

    // Client name for the cover / footer
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("full_name")
      .eq("user_id", will.user_id)
      .single();
    const clientName =
      answers.personal?.full_name || profile?.full_name || "Client";

    // Generate the PDF (DRAFT watermark until finalized)
    const isFinal = will.status === "finalized";
    // Only a finalized will carries the client's signature — a draft is
    // produced before they have signed, so it keeps the blank ruled line.
    const signature = isFinal ? will.client_signature : null;
    const signatureDate = isFinal ? will.client_signature_at : null;

    const base64 = generateWillPDF({
      answers,
      jurisdiction,
      clientName,
      draft: !isFinal,
      signature,
      signatureDate,
    });
    const pdfBuffer = Buffer.from(base64, "base64");

    // Upload to storage under the client's folder (matches storage policy)
    const fileName = `${will.user_id}/draft_${Date.now()}.pdf`;
    const { error: uploadError } = await supabaseAdmin.storage
      .from("wills")
      .upload(fileName, pdfBuffer, {
        contentType: "application/pdf",
        upsert: true,
      });
    if (uploadError) {
      console.error("Will PDF upload error:", uploadError);
      return NextResponse.json(
        { error: "Failed to upload generated PDF" },
        { status: 500 }
      );
    }

    // Generate the matching editable Word draft (same content, same clause
    // order as the PDF) so staff can amend it before re-uploading the final
    // PDF via the existing Upload PDF flow. Non-fatal if it fails — the PDF
    // is still the document of record.
    let docxFileName: string | null = null;
    try {
      const docxBuffer = await generateWillDocx({
        answers,
        jurisdiction,
        clientName,
        draft: !isFinal,
        signature,
        signatureDate,
      });
      docxFileName = `${will.user_id}/draft_${Date.now()}.docx`;
      const { error: docxUploadError } = await supabaseAdmin.storage
        .from("wills")
        .upload(docxFileName, docxBuffer, {
          contentType:
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          upsert: true,
        });
      if (docxUploadError) {
        console.error("Will docx upload error:", docxUploadError);
        docxFileName = null;
      }
    } catch (docxErr) {
      console.error("Could not generate will docx:", docxErr);
    }

    // Point the will at the new PDF (and docx, if it was generated)
    const { error: updateError } = await supabaseAdmin
      .from("wills")
      .update({
        pdf_path: fileName,
        pdf_generated_at: new Date().toISOString(),
        ...(docxFileName ? { docx_path: docxFileName } : {}),
      })
      .eq("id", id);
    if (updateError) {
      console.error("Will update error:", updateError);
      return NextResponse.json(
        { error: "Failed to update will" },
        { status: 500 }
      );
    }

    // Record a version in the amendment history
    try {
      const { data: lastVersion } = await supabaseAdmin
        .from("will_document_versions")
        .select("version_number")
        .eq("will_id", id)
        .order("version_number", { ascending: false })
        .limit(1)
        .maybeSingle();
      const nextVersion = ((lastVersion?.version_number as number) ?? 0) + 1;
      await supabaseAdmin.from("will_document_versions").insert({
        will_id: id,
        version_number: nextVersion,
        pdf_path: fileName,
        ...(docxFileName ? { docx_path: docxFileName } : {}),
        uploaded_by: callerId,
        notes: `Generated from ${jurisdiction === "dubai" ? "Dubai" : "Abu Dhabi"} template`,
      });
    } catch (versionErr) {
      console.error("Could not record document version:", versionErr);
    }

    return NextResponse.json({
      ok: true,
      pdf_path: fileName,
      docx_path: docxFileName,
      jurisdiction,
    });
  } catch (error) {
    console.error("Error generating will draft:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
