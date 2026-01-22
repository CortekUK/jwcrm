import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.58.0';
import { PDFDocument, rgb, degrees } from 'https://cdn.skypack.dev/pdf-lib@1.17.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('PDF callback received');

    // Parse request body from Make
    const { will_id, user_id, pdf_url } = await req.json();

    if (!will_id || !user_id || !pdf_url) {
      throw new Error('Missing required fields: will_id, user_id, or pdf_url');
    }

    console.log('Processing PDF callback for will:', will_id);

    // Create Supabase client with service role (bypass RLS for storage write)
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Download PDF from PDFMonkey URL
    console.log('Downloading PDF from:', pdf_url);
    const pdfResponse = await fetch(pdf_url);

    if (!pdfResponse.ok) {
      console.error('Failed to download PDF:', pdfResponse.status);
      throw new Error('Failed to download PDF from PDFMonkey');
    }

    const pdfBlob = await pdfResponse.blob();
    const pdfArrayBuffer = await pdfBlob.arrayBuffer();
    let pdfBuffer = new Uint8Array(pdfArrayBuffer);

    console.log('PDF downloaded, size:', pdfBuffer.length, 'bytes');

    // Get current will status to determine if watermark is needed
    const { data: will, error: willError } = await supabase
      .from('wills')
      .select('status')
      .eq('id', will_id)
      .single();

    if (willError) {
      console.error('Error fetching will status:', willError);
      throw new Error('Failed to fetch will status');
    }

    // Add watermark if status is not finalized
    if (will.status !== 'finalized') {
      console.log('Adding DRAFT watermark to PDF (status:', will.status, ')');

      try {
        // Load the PDF
        const pdfDoc = await PDFDocument.load(pdfBuffer);
        const pages = pdfDoc.getPages();

        // Add watermark to each page
        for (const page of pages) {
          const { width, height } = page.getSize();

          // Draw diagonal "JUST WILLS" watermark with gold color (bottom-left to top-right)
          page.drawText('JUST WILLS', {
            x: width / 2 - 200,
            y: height / 2 - 100,
            size: 120,
            color: rgb(0.776, 0.627, 0.231), // #C6A03B gold color
            opacity: 0.08, // Match CSS watermark opacity
            rotate: degrees(45),
          });
        }

        // Save the modified PDF
        const watermarkedPdfBytes = await pdfDoc.save();
        pdfBuffer = new Uint8Array(watermarkedPdfBytes);
        console.log('Watermark added successfully');
      } catch (watermarkError) {
        console.error('Error adding watermark:', watermarkError);
        // Continue without watermark rather than failing completely
      }
    } else {
      console.log('Status is finalized, no watermark needed');
    }

    // Define storage path
    const storagePath = `wills/${user_id}/drafts/${will_id}.pdf`;

    console.log('Uploading to Supabase Storage:', storagePath);

    // Upload to Supabase Storage
    const { error: uploadError } = await supabase.storage
      .from('wills')
      .upload(storagePath, pdfBuffer, {
        contentType: 'application/pdf',
        upsert: true, // Replace if exists
      });

    if (uploadError) {
      console.error('Storage upload error:', uploadError);
      
      // Update will status to awaiting_review on failure
      await supabase
        .from('wills')
        .update({
          status: 'awaiting_review',
          updated_at: new Date().toISOString(),
        })
        .eq('id', will_id);

      throw new Error('Failed to upload PDF to storage: ' + uploadError.message);
    }

    console.log('PDF uploaded successfully');

    // Update will record with PDF path and status
      const { error: updateError } = await supabase
        .from('wills')
        .update({
          pdf_path: storagePath,
          pdf_generated_at: new Date().toISOString(),
          status: 'draft_generated_internal',
          visible_to_client: false,
          updated_at: new Date().toISOString(),
        })
        .eq('id', will_id)
        .eq('user_id', user_id);

    if (updateError) {
      console.error('Error updating will record:', updateError);
      throw updateError;
    }

    console.log('Will record updated successfully');

    return new Response(
      JSON.stringify({
        ok: true,
        message: 'PDF processed and stored successfully',
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('Error in pdf-callback:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return new Response(
      JSON.stringify({
        ok: false,
        error: errorMessage,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
