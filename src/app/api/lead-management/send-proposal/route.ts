import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { generateProposalPDF } from "@/lib/pdf/generateProposalPDF";
import { sendUserEmail } from "@/lib/integrations/sendUserEmail";
import { senderFor } from "@/config/email";
import { companyDetails } from "@/config/company";
import { computeInvoiceAmounts } from "@/lib/finance/invoiceAmounts";
import { proposalAcceptUrl } from "@/lib/finance/acceptLink";
import {
  lineItemsSubtotal,
  normalizeLineItems,
  type InvoiceLineItem,
} from "@/lib/pdf/invoiceLineItems";
import {
  awaitingCourtChoice,
  baseLineItems,
  courtChoiceSummary,
  normalizeCourtOptions,
} from "@/lib/lead-management/courtOptions";
import {
  buildDefaultProposalEmailHtml,
  buildProposalStructuredHtml,
  proposalFormattedAmount,
} from "@/lib/lead-management/proposalEmailHtml";
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
      vat_rate,
      court_options,
    } = body;

    // The amount is no longer required up front: with courts offered the
    // server works it out from the items, and a proposal whose only charges
    // are the court options is legitimate. The "something to charge" check
    // happens below, once the items and options are parsed.
    if (!leadId || !proposalContent) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Registration courts offered (Abu Dhabi / Dubai / DIFC). Absent from
    // the body -> undefined, which leaves court_options untouched, so a stale
    // browser tab running the old dialog still sends a working proposal.
    const courtOptions =
      court_options === undefined ? undefined : normalizeCourtOptions(court_options);
    // Fees are typed per proposal; there is no default to fall back on, so an
    // offered court with no fee is a mistake, not a free option.
    if (courtOptions?.some((o) => !(o.amount > 0))) {
      return NextResponse.json(
        { error: "Every offered registration court needs a fee greater than zero" },
        { status: 400 }
      );
    }

    // The BASE items (drafting, notarization, …). Any court line in them is
    // dropped: whether a court fee is in the items is upsertLeadDeal's call.
    // A proposal offering courts may have no base items at all, and must not
    // gain normalizeLineItems' invented "Will (UAE)" row for the flat amount.
    const rawBase = baseLineItems(Array.isArray(line_items) ? line_items : []);
    const baseItems =
      rawBase.length > 0 || !courtOptions?.length
        ? baseLineItems(normalizeLineItems(rawBase, Number(amount) || 0))
        : [];
    if (lineItemsSubtotal(baseItems) <= 0 && !courtOptions?.length) {
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

    // Undefined means "no override" — the column must stay NULL so every
    // reader keeps falling back to companyDetails.vatRate.
    const vatRateOverride: number | null | undefined =
      vat_rate === undefined ? undefined : vat_rate === null || vat_rate === "" ? null : Number(vat_rate);

    // 2. Create or update this lead's active proposal record. A proposal is
    //    purely informational — no Stripe session, no payment capability.
    //    That only happens later when staff explicitly send an invoice.
    //    With courts offered, upsertLeadDeal decides the final line items
    //    (and the amount) — so everything below reads the SAVED row, never
    //    the request.
    const { proposal } = await upsertLeadDeal(supabaseAdmin, {
      leadId,
      mode: "proposal",
      amount: lineItemsSubtotal(baseItems),
      currency,
      lineItems: baseItems,
      proposalContent,
      vatRate: vatRateOverride,
      courtOptions,
    });

    // Itemised charges (drafting / court fee / MOJ stamps etc), resolved from
    // the saved row through the shared helper so the PDF, the email and the
    // later payment link can never disagree about the VAT or the total.
    const savedItems = (proposal.line_items ?? null) as InvoiceLineItem[] | null;
    // Not in the generated types until migration 20260928000001 is applied.
    const savedCourtOptions = (proposal as { court_options?: unknown }).court_options ?? null;
    const amounts = computeInvoiceAmounts(
      {
        amount: proposal.amount,
        line_items: savedItems,
        vat_rate: proposal.vat_rate,
        vat_amount: proposal.vat_amount,
      },
      companyDetails.vatRate
    );
    // Set only while the client has a court to choose; every client-facing
    // figure then comes from the per-court options instead of one total.
    const courtChoice = awaitingCourtChoice(savedItems, savedCourtOptions)
      ? courtChoiceSummary(
          savedItems,
          savedCourtOptions,
          { vat_rate: proposal.vat_rate, vat_amount: proposal.vat_amount },
          companyDetails.vatRate
        )
      : null;

    // 3. Update lead status to pending
    await supabaseAdmin
      .from("leads")
      .update({
        status: "pending",
        updated_at: new Date().toISOString(),
      })
      .eq("id", leadId);

    // 4. Generate the Proposal PDF (itemised)
    //
    // The accept link is minted from the proposal id, which only exists after
    // step 2 — that ordering is why it is resolved here and not at the top.
    const acceptUrl = proposalAcceptUrl(proposal.id);

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
      amount: amounts.subtotal,
      currency: currency,
      proposalContent: proposalContent,
      // The saved items as stored: while a court is still to be chosen the
      // renderer must see the empty-or-base list itself, not a copy that
      // normalizeLineItems has padded with an invented "Will (UAE)" row.
      lineItems: savedItems ?? undefined,
      courtOptions: savedCourtOptions,
      vatRate: proposal.vat_rate ?? null,
      vatAmount: proposal.vat_amount ?? null,
      acceptUrl,
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
    // "from AED …" while a court is still to be chosen — there is no single
    // total until then.
    const formattedAmount = proposalFormattedAmount(currency, amounts, courtChoice);

    // The structured blocks (charges table, accept button, process timeline)
    // are kept whichever way the prose is produced — a template author edits
    // the wording, not the itemised figures the client needs to see.
    const proposalStructuredHtml = buildProposalStructuredHtml({
      currency,
      invoiceNumber: proposal.invoice_number,
      accountManagerName,
      accountManagerEmail,
      acceptUrl,
      amounts,
      courtChoice,
      formattedAmount,
    });

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
    // From the account manager, on the verified domain, so the client sees a
    // person and replies reach them. senderFor falls back to the generic
    // address if their login is not a justwills.ae mailbox.
    const emailResult = await sendUserEmail(callerId, {
      from: senderFor(accountManagerName, accountManagerEmail),
      to: effectiveEmail,
      subject: proposalTemplate?.subject || `Your Proposal - ${proposal.invoice_number}`,
      refId: proposal.id,
      log: { kind: "proposal", leadId, proposalId: proposal.id },
      attachments: [
        { content: proposalPDFBase64, filename: `Proposal-${proposal.invoice_number}.pdf` },
      ],
      html:
        proposalTemplate?.html ??
        buildDefaultProposalEmailHtml({
          effectiveName,
          accountManagerName,
          accountManagerEmail,
          structuredHtml: proposalStructuredHtml,
        }),
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
