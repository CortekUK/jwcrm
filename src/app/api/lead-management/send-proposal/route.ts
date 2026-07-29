import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { generateProposalPDF } from "@/lib/pdf/generateProposalPDF";
import { sendUserEmail } from "@/lib/integrations/sendUserEmail";
import { companyDetails } from "@/config/company";
import { normalizeLineItems, lineItemsSubtotal, type InvoiceLineItem } from "@/lib/pdf/invoiceLineItems";
import { upsertLeadDeal, assertCanManageLeadDeal } from "@/lib/lead-management/proposalInvoice";
import { getLeadEmailTemplates } from "@/lib/lead-management/settingsServer";
import { resolveLeadTemplate, type RenderedLeadEmail } from "@/lib/lead-management/leadEmailTemplates";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  try {
    // Resolve the calling user so we can route the email via their Outlook
    // when connected, and check they're allowed to manage this lead's deal.
    let callerId: string | null = null;
    const authHeader = request.headers.get("authorization") || "";
    const accessToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
    if (accessToken) {
      const { data: userInfo } = await supabaseAdmin.auth.getUser(accessToken);
      callerId = userInfo?.user?.id ?? null;
    }

    const body = await request.json();
    const {
      leadId,
      amount,
      currency = "AED",
      proposalContent,
      leadEmail,
      leadName,
      line_items,
    } = body;

    if (!leadId || !amount || !proposalContent) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // 1. Get lead details
    const { data: lead, error: leadError } = await supabaseAdmin
      .from("leads")
      .select("*")
      .eq("id", leadId)
      .single();

    if (leadError || !lead) {
      return NextResponse.json(
        { error: "Lead not found" },
        { status: 404 }
      );
    }

    const auth = await assertCanManageLeadDeal(supabaseAdmin, callerId, lead);
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    // Use provided email/name if available (from edited lead), otherwise use from database
    const effectiveEmail = leadEmail || lead.email;
    const effectiveName = leadName || lead.full_name;

    // Resolve the assigned account manager (falls back to the default contact).
    // Name comes from the profile; email lives on auth.users.
    let accountManagerName = companyDetails.defaultContactName;
    let accountManagerEmail = companyDetails.invoiceEmail;
    if (lead.assigned_to) {
      const { data: managerProfile } = await supabaseAdmin
        .from("profiles")
        .select("full_name")
        .eq("user_id", lead.assigned_to)
        .single();
      if (managerProfile?.full_name) {
        accountManagerName = managerProfile.full_name;
      }
      const { data: managerAuth } = await supabaseAdmin.auth.admin.getUserById(
        lead.assigned_to
      );
      if (managerAuth?.user?.email) {
        accountManagerEmail = managerAuth.user.email;
      }
    }

    // Itemised charges (drafting / court fee / MOJ stamps etc). Subtotal is
    // their sum; falls back to the flat amount when no items are supplied.
    const items: InvoiceLineItem[] = normalizeLineItems(line_items, amount);
    const subtotalAmount = lineItemsSubtotal(items);
    const vatAmount = subtotalAmount * (companyDetails.vatRate / 100);
    const totalAmount = subtotalAmount + vatAmount;

    // 2. Create or update this lead's active proposal record. A proposal is
    //    purely informational — no Stripe session, no payment capability.
    //    That only happens later when staff explicitly send an invoice.
    const { proposal } = await upsertLeadDeal(supabaseAdmin, {
      leadId,
      mode: "proposal",
      amount: subtotalAmount,
      currency,
      lineItems: items,
      proposalContent,
    });

    // 3. Update lead status to pending
    await supabaseAdmin
      .from("leads")
      .update({
        status: "pending",
        updated_at: new Date().toISOString(),
      })
      .eq("id", leadId);

    // 4. Generate the Proposal PDF (itemised)
    const now = new Date();
    const validUntil = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000); // 30 days from now

    const proposalPDFBase64 = generateProposalPDF({
      invoiceNumber: proposal.invoice_number,
      proposalDate: now,
      validUntil: validUntil,
      clientName: effectiveName,
      clientEmail: effectiveEmail,
      clientPhone: lead.phone,
      clientCompany: lead.company_name,
      amount: subtotalAmount,
      currency: currency,
      proposalContent: proposalContent,
      lineItems: items,
    });

    // Persist the PDF so the existing View/Download PDF menu in the admin UI
    // (ViewProposalDialog) actually has something to open.
    let proposalPdfPath: string | null = null;
    try {
      proposalPdfPath = `${leadId}/proposal_${proposal.id}_${Date.now()}.pdf`;
      const { error: storageError } = await supabaseAdmin.storage
        .from("proposals")
        .upload(proposalPdfPath, Buffer.from(proposalPDFBase64, "base64"), {
          contentType: "application/pdf",
          upsert: true,
        });
      if (storageError) {
        console.error("Error uploading proposal PDF:", storageError);
        proposalPdfPath = null;
      }
    } catch (storageErr) {
      console.error("Error uploading proposal PDF:", storageErr);
    }
    if (proposalPdfPath) {
      await supabaseAdmin
        .from("proposals")
        .update({ proposal_pdf_path: proposalPdfPath })
        .eq("id", proposal.id);
    }

    // 5. Send email with the Proposal PDF attached only — no invoice, no
    //    payment link. The client hasn't agreed to anything yet.
    const formattedAmount = new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency,
    }).format(totalAmount);

    const itemRows = items
      .map(
        (item) => `
                  <tr>
                    <td style="padding: 8px 12px; border-bottom: 1px solid #E6E6E4; color: #222222; font-size: 13px;">${item.description}</td>
                    <td style="padding: 8px 12px; border-bottom: 1px solid #E6E6E4; text-align: right; color: #222222; font-size: 13px;">${new Intl.NumberFormat("en-US", { style: "currency", currency }).format(item.amount)}</td>
                  </tr>`
      )
      .join("");

    // Build the "What to Expect" process timeline block
    const timelineRows = companyDetails.processTimeline
      .map(
        (step) => `
                  <tr>
                    <td style="padding: 10px 12px 10px 0; vertical-align: top; white-space: nowrap; color: #0C5536; font-weight: bold; font-size: 13px;">${step.title}</td>
                    <td style="padding: 10px 0; color: #444444; font-size: 13px; line-height: 1.5;">${step.detail}</td>
                  </tr>`
      )
      .join("");

    // The structured blocks (charges table, process timeline) are kept
    // whichever way the prose is produced — a template author edits the
    // wording, not the itemised figures the client needs to see.
    const proposalStructuredHtml = `
              <div style="background-color: #ffffff; border: 1px solid #E6E6E4; border-radius: 8px; padding: 20px; margin: 20px 0;">
                <table style="width: 100%; border-collapse: collapse;">
                  <tr>
                    <td style="padding: 8px 0; color: #666666;">Reference Number:</td>
                    <td style="padding: 8px 0; text-align: right; font-weight: bold; color: #222222;">${proposal.invoice_number}</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; color: #666666;">Account Manager:</td>
                    <td style="padding: 8px 0; text-align: right; color: #222222;">
                      <span style="font-weight: bold;">${accountManagerName}</span><br/>
                      <a href="mailto:${accountManagerEmail}" style="color: #0C5536; font-size: 13px; text-decoration: none;">${accountManagerEmail}</a>
                    </td>
                  </tr>
                </table>
              </div>
              <div style="background-color: #ffffff; border: 1px solid #E6E6E4; border-radius: 8px; padding: 20px; margin: 20px 0;">
                <h3 style="color: #0C5536; margin: 0 0 12px 0; font-size: 14px;">Estimated Charges</h3>
                <table style="width: 100%; border-collapse: collapse;">
                  <thead>
                    <tr>
                      <th style="text-align: left; padding: 8px 12px; border-bottom: 2px solid #0C5536; font-size: 12px; color: #0C5536;">Description</th>
                      <th style="text-align: right; padding: 8px 12px; border-bottom: 2px solid #0C5536; font-size: 12px; color: #0C5536;">Amount</th>
                    </tr>
                  </thead>
                  <tbody>${itemRows}</tbody>
                </table>
                <table style="width: 100%; border-collapse: collapse; margin-top: 10px;">
                  <tr>
                    <td style="padding: 4px 12px; color: #666666; font-size: 13px;">Sub-Total</td>
                    <td style="padding: 4px 12px; text-align: right; color: #222222; font-size: 13px;">${new Intl.NumberFormat("en-US", { style: "currency", currency }).format(subtotalAmount)}</td>
                  </tr>
                  <tr>
                    <td style="padding: 4px 12px; color: #666666; font-size: 13px;">VAT (${companyDetails.vatRate}%)</td>
                    <td style="padding: 4px 12px; text-align: right; color: #222222; font-size: 13px;">${new Intl.NumberFormat("en-US", { style: "currency", currency }).format(vatAmount)}</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 12px; color: #0C5536; font-weight: bold; font-size: 15px; border-top: 1px solid #E6E6E4;">Total Estimated Amount</td>
                    <td style="padding: 8px 12px; text-align: right; color: #0C5536; font-weight: bold; font-size: 15px; border-top: 1px solid #E6E6E4;">${formattedAmount}</td>
                  </tr>
                </table>
              </div>
              <p style="color: #6B6B6B; font-size: 13px; text-align: center;">
                This is a proposal only — no payment is required at this stage.<br/>
                Once you're ready to proceed, we'll send you a formal invoice with a secure payment link.
              </p>
              <div style="background-color: #ffffff; border: 1px solid #E6E6E4; border-radius: 8px; padding: 20px; margin: 25px 0 10px 0;">
                <h3 style="color: #0C5536; margin: 0 0 12px 0; font-size: 16px;">What to Expect — Process Timeline</h3>
                <table style="width: 100%; border-collapse: collapse;">${timelineRows}</table>
              </div>`;

    // When the "Proposal Email" template is active it supplies the subject and
    // the prose. Toggled off (or blank), we fall back to the original
    // hardcoded builder below so an empty proposal email can never go out.
    let proposalTemplate: RenderedLeadEmail | null = null;
    try {
      const templates = await getLeadEmailTemplates();
      proposalTemplate = resolveLeadTemplate(
        templates,
        "proposal",
        {
          lead_name: effectiveName,
          invoice_number: proposal.invoice_number,
          amount: formattedAmount,
          salesperson_name: accountManagerName,
        },
        {
          extraHtml: proposalStructuredHtml,
          subtitle: `Professional Will Drafting Services · ${companyDetails.invoiceCity}`,
        }
      );
    } catch (templateError) {
      console.error("Proposal template lookup failed, using default:", templateError);
    }

    // Route email via the caller's Outlook when connected, else Resend.
    const emailResult = await sendUserEmail(callerId, {
      to: effectiveEmail,
      subject: proposalTemplate?.subject || `Your Proposal - ${proposal.invoice_number}`,
      refId: proposal.id,
      attachments: [
        { content: proposalPDFBase64, filename: `Proposal-${proposal.invoice_number}.pdf` },
      ],
      html: proposalTemplate?.html ?? `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background-color: #0C5536; padding: 20px; text-align: center;">
              <h1 style="color: #C6A03B; margin: 0; font-size: 22px;">${companyDetails.legalName}</h1>
              <p style="color: #E6E6E4; margin: 5px 0 0 0; font-size: 12px;">Professional Will Drafting Services &middot; ${companyDetails.invoiceCity}</p>
            </div>
            <div style="padding: 30px; background-color: #FAFAF8;">
              <h2 style="color: #0C5536; margin-top: 0;">Dear ${effectiveName},</h2>
              <p style="color: #222222; line-height: 1.6;">
                Thank you for your interest in our services. Please find attached your <strong>Proposal</strong> for your review.
              </p>

              <div style="background-color: #ffffff; border: 1px solid #E6E6E4; border-radius: 8px; padding: 20px; margin: 20px 0;">
                <table style="width: 100%; border-collapse: collapse;">
                  <tr>
                    <td style="padding: 8px 0; color: #666666;">Reference Number:</td>
                    <td style="padding: 8px 0; text-align: right; font-weight: bold; color: #222222;">${proposal.invoice_number}</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; color: #666666;">Account Manager:</td>
                    <td style="padding: 8px 0; text-align: right; color: #222222;">
                      <span style="font-weight: bold;">${accountManagerName}</span><br/>
                      <a href="mailto:${accountManagerEmail}" style="color: #0C5536; font-size: 13px; text-decoration: none;">${accountManagerEmail}</a>
                    </td>
                  </tr>
                </table>
              </div>

              <div style="background-color: #ffffff; border: 1px solid #E6E6E4; border-radius: 8px; padding: 20px; margin: 20px 0;">
                <h3 style="color: #0C5536; margin: 0 0 12px 0; font-size: 14px;">Estimated Charges</h3>
                <table style="width: 100%; border-collapse: collapse;">
                  <thead>
                    <tr>
                      <th style="text-align: left; padding: 8px 12px; border-bottom: 2px solid #0C5536; font-size: 12px; color: #0C5536;">Description</th>
                      <th style="text-align: right; padding: 8px 12px; border-bottom: 2px solid #0C5536; font-size: 12px; color: #0C5536;">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${itemRows}
                  </tbody>
                </table>
                <table style="width: 100%; border-collapse: collapse; margin-top: 10px;">
                  <tr>
                    <td style="padding: 4px 12px; color: #666666; font-size: 13px;">Sub-Total</td>
                    <td style="padding: 4px 12px; text-align: right; color: #222222; font-size: 13px;">${new Intl.NumberFormat("en-US", { style: "currency", currency }).format(subtotalAmount)}</td>
                  </tr>
                  <tr>
                    <td style="padding: 4px 12px; color: #666666; font-size: 13px;">VAT (${companyDetails.vatRate}%)</td>
                    <td style="padding: 4px 12px; text-align: right; color: #222222; font-size: 13px;">${new Intl.NumberFormat("en-US", { style: "currency", currency }).format(vatAmount)}</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 12px; color: #0C5536; font-weight: bold; font-size: 15px; border-top: 1px solid #E6E6E4;">Total Estimated Amount</td>
                    <td style="padding: 8px 12px; text-align: right; color: #0C5536; font-weight: bold; font-size: 15px; border-top: 1px solid #E6E6E4;">${formattedAmount}</td>
                  </tr>
                </table>
              </div>

              <p style="color: #6B6B6B; font-size: 13px; text-align: center;">
                This is a proposal only — no payment is required at this stage.<br/>
                Once you're ready to proceed, we'll send you a formal invoice with a secure payment link.
              </p>

              <div style="background-color: #ffffff; border: 1px solid #E6E6E4; border-radius: 8px; padding: 20px; margin: 25px 0 10px 0;">
                <h3 style="color: #0C5536; margin: 0 0 12px 0; font-size: 16px;">What to Expect — Process Timeline</h3>
                <table style="width: 100%; border-collapse: collapse;">
                  ${timelineRows}
                </table>
              </div>

              <p style="color: #444444; font-size: 14px; line-height: 1.6; margin: 18px 0 0 0;">
                If you have any questions, please contact <strong>${accountManagerName}</strong> at
                <a href="mailto:${accountManagerEmail}" style="color: #0C5536; text-decoration: none;">${accountManagerEmail}</a>.
              </p>
            </div>
            <div style="background-color: #222222; padding: 15px; text-align: center;">
              <p style="color: #E6E6E4; margin: 0; font-size: 12px;">
                &copy; ${new Date().getFullYear()} ${companyDetails.legalName}. All rights reserved.
              </p>
              <p style="color: #666666; margin: 5px 0 0 0; font-size: 11px;">
                TRN: ${companyDetails.trn} &middot; Questions? Contact us at ${companyDetails.invoiceEmail}
              </p>
            </div>
          </div>
        `,
    });
    if (!emailResult.ok) {
      console.error("Error sending proposal email:", emailResult.error);
      // Don't fail the request, just log the error
    }

    return NextResponse.json({
      success: true,
      proposalId: proposal.id,
      invoiceNumber: proposal.invoice_number,
      emailProvider: emailResult.provider,
    });
  } catch (error) {
    console.error("Error in send-proposal:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
