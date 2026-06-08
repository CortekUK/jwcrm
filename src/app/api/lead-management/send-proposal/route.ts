import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { stripe } from "@/integrations/stripe/server";
import { generateProposalPDF } from "@/lib/pdf/generateProposalPDF";
import { generateInvoicePDFArabic } from "@/lib/pdf/generateInvoicePDFArabic";
import { sendUserEmail } from "@/lib/integrations/sendUserEmail";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  try {
    // Resolve the calling user so we can route the email via their Outlook
    // when connected. Falls back to the system Resend sender otherwise.
    let callerId: string | null = null;
    const authHeader = request.headers.get("authorization") || "";
    const accessToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
    if (accessToken) {
      const { data: userInfo } = await supabaseAdmin.auth.getUser(accessToken);
      callerId = userInfo?.user?.id ?? null;
    }

    const body = await request.json();
    const { leadId, amount, currency = "AED", proposalContent, leadEmail, leadName } = body;

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

    // Use provided email/name if available (from edited lead), otherwise use from database
    const effectiveEmail = leadEmail || lead.email;
    const effectiveName = leadName || lead.full_name;

    // 2. Create proposal record (invoice_number is auto-generated)
    const { data: proposal, error: proposalError } = await supabaseAdmin
      .from("proposals")
      .insert({
        lead_id: leadId,
        amount,
        currency,
        proposal_content: proposalContent,
        status: "draft",
      })
      .select()
      .single();

    if (proposalError || !proposal) {
      console.error("Error creating proposal:", proposalError);
      return NextResponse.json(
        { error: "Failed to create proposal" },
        { status: 500 }
      );
    }

    // 3. Create Stripe Checkout Session
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      mode: "payment",
      customer_email: effectiveEmail,
      line_items: [
        {
          price_data: {
            currency: currency.toLowerCase(),
            product_data: {
              name: "Just Wills - Legal Services",
              description: `Proposal ${proposal.invoice_number} for ${effectiveName}`,
            },
            unit_amount: Math.round(amount * 100),
          },
          quantity: 1,
        },
      ],
      metadata: {
        proposalId: proposal.id,
        leadEmail: effectiveEmail,
        leadName: effectiveName,
      },
      success_url: `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/payment/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/payment/cancelled`,
    });

    // 4. Update proposal with Stripe info
    const { error: updateError } = await supabaseAdmin
      .from("proposals")
      .update({
        stripe_checkout_session_id: session.id,
        stripe_payment_link: session.url,
        status: "sent",
        sent_at: new Date().toISOString(),
      })
      .eq("id", proposal.id);

    if (updateError) {
      console.error("Error updating proposal:", updateError);
    }

    // 5. Update lead status to pending
    await supabaseAdmin
      .from("leads")
      .update({
        status: "pending",
        updated_at: new Date().toISOString(),
      })
      .eq("id", leadId);

    // 6. Generate PDFs
    const now = new Date();
    const dueDate = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000); // 7 days from now
    const validUntil = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000); // 30 days from now

    // Generate Proposal PDF
    const proposalPDFBase64 = generateProposalPDF({
      invoiceNumber: proposal.invoice_number,
      proposalDate: now,
      validUntil: validUntil,
      clientName: effectiveName,
      clientEmail: effectiveEmail,
      clientPhone: lead.phone,
      clientCompany: lead.company_name,
      amount: amount,
      currency: currency,
      proposalContent: proposalContent,
    });

    // Generate Invoice PDF in Arabic
    const invoicePDFBase64 = await generateInvoicePDFArabic({
      invoiceNumber: proposal.invoice_number,
      invoiceDate: now,
      dueDate: dueDate,
      clientName: effectiveName,
      clientEmail: effectiveEmail,
      clientPhone: lead.phone,
      clientCompany: lead.company_name,
      amount: amount,
      currency: currency,
      description: "خدمات صياغة الوصايا الاحترافية", // Professional Will Drafting Services in Arabic
    });

    // 7. Send email with PDF attachments
    const formattedAmount = new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency,
    }).format(amount);

    // Route email via the caller's Outlook when connected, else Resend.
    const emailResult = await sendUserEmail(callerId, {
      to: effectiveEmail,
      subject: `Your Proposal & Invoice - ${proposal.invoice_number}`,
      refId: proposal.id,
      attachments: [
        { content: proposalPDFBase64, filename: `Proposal-${proposal.invoice_number}.pdf` },
        { content: invoicePDFBase64, filename: `Invoice-${proposal.invoice_number}.pdf` },
      ],
      html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background-color: #0C5536; padding: 20px; text-align: center;">
              <h1 style="color: #C6A03B; margin: 0;">Just Wills</h1>
              <p style="color: #E6E6E4; margin: 5px 0 0 0; font-size: 12px;">Professional Will Drafting Services</p>
            </div>
            <div style="padding: 30px; background-color: #FAFAF8;">
              <h2 style="color: #0C5536; margin-top: 0;">Dear ${effectiveName},</h2>
              <p style="color: #222222; line-height: 1.6;">
                Thank you for your interest in our services. Please find attached your <strong>Proposal</strong> and <strong>Invoice</strong> for your review.
              </p>

              <div style="background-color: #ffffff; border: 1px solid #E6E6E4; border-radius: 8px; padding: 20px; margin: 20px 0;">
                <table style="width: 100%; border-collapse: collapse;">
                  <tr>
                    <td style="padding: 8px 0; color: #666666;">Invoice Number:</td>
                    <td style="padding: 8px 0; text-align: right; font-weight: bold; color: #222222;">${proposal.invoice_number}</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; color: #666666;">Amount Due:</td>
                    <td style="padding: 8px 0; text-align: right; font-weight: bold; color: #0C5536; font-size: 18px;">${formattedAmount}</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; color: #666666;">Due Date:</td>
                    <td style="padding: 8px 0; text-align: right; color: #222222;">${dueDate.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</td>
                  </tr>
                </table>
              </div>

              <div style="background-color: #FFF8E7; border: 1px solid #C6A03B; border-radius: 8px; padding: 15px; margin: 20px 0;">
                <p style="margin: 0; color: #8B6914; font-size: 14px;">
                  <strong>Attachments:</strong><br/>
                  📄 Proposal-${proposal.invoice_number}.pdf<br/>
                  📄 Invoice-${proposal.invoice_number}.pdf
                </p>
              </div>

              <div style="text-align: center; margin: 30px 0;">
                <a href="${session.url}" style="background-color: #0C5536; color: #ffffff; padding: 15px 40px; text-decoration: none; border-radius: 5px; display: inline-block; font-size: 16px; font-weight: bold;">
                  Pay ${formattedAmount} Now
                </a>
              </div>

              <p style="color: #6B6B6B; font-size: 13px; text-align: center;">
                Click the button above to securely complete your payment via Stripe.<br/>
                Your invoice can be used for tax and accounting purposes.
              </p>
            </div>
            <div style="background-color: #222222; padding: 15px; text-align: center;">
              <p style="color: #E6E6E4; margin: 0; font-size: 12px;">
                &copy; ${new Date().getFullYear()} Just Wills. All rights reserved.
              </p>
              <p style="color: #666666; margin: 5px 0 0 0; font-size: 11px;">
                Questions? Contact us at support@justwills.ae
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
      paymentUrl: session.url,
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
