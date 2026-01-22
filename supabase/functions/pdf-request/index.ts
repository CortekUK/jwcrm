import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.58.0';

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
    // Create Supabase client with service role for admin operations
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Get user from JWT
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Missing authorization header');
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    
    if (userError || !user) {
      throw new Error('Invalid authentication');
    }

    console.log('User authenticated:', user.id);

    // Verify admin role
    const { data: isAdmin, error: roleError } = await supabase
      .rpc('has_role', { _user_id: user.id, _role: 'admin' });

    if (roleError || !isAdmin) {
      console.error('Unauthorized: Admin access required');
      throw new Error('Unauthorized: Admin access required');
    }

    console.log('Admin verified, proceeding with PDF generation');

    // Parse request body
    const { will_id } = await req.json();

    if (!will_id) {
      throw new Error('will_id is required');
    }

    console.log('Requesting PDF for will:', will_id);

    // Fetch will record (admin can access any will)
    const { data: will, error: willError } = await supabase
      .from('wills')
      .select('*')
      .eq('id', will_id)
      .single();

    if (willError) {
      console.error('Error fetching will:', willError);
      throw new Error('Will not found or access denied');
    }

    // Fetch user's locale from profiles
    const { data: profile } = await supabase
      .from('profiles')
      .select('locale')
      .eq('user_id', will.user_id)
      .single();

    const locale = profile?.locale || 'en';

    console.log('Building payload for Make webhook');

    // Build payload for Make
    const payload = {
      will_id: will.id,
      user_id: will.user_id,
      status: will.status, // Include status for watermark logic
      locale,
      answers: will.answers || {},
      uploads: will.upload_files || [],
      template_id: 'pdfmonkey_template_placeholder', // Will be replaced when client provides real template ID
    };

    // Get Make webhook URL
    const makeWebhookUrl = Deno.env.get('MAKE_WEBHOOK_URL');
    if (!makeWebhookUrl) {
      console.error('MAKE_WEBHOOK_URL not configured');
      throw new Error('PDF generation service not configured');
    }

    console.log('Calling Make webhook');

    // Call Make webhook
    const makeResponse = await fetch(makeWebhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!makeResponse.ok) {
      console.error('Make webhook failed:', makeResponse.status, await makeResponse.text());
      throw new Error('Failed to trigger PDF generation');
    }

    console.log('Make webhook called successfully');

    // Update will status to generating_pdf
    const { error: updateError } = await supabase
      .from('wills')
      .update({
        status: 'generating_pdf',
        updated_at: new Date().toISOString(),
      })
      .eq('id', will_id);

    if (updateError) {
      console.error('Error updating will status:', updateError);
      throw updateError;
    }

    console.log('Will status updated to generating_pdf');

    return new Response(
      JSON.stringify({
        ok: true,
        will_id,
        message: 'PDF generation started',
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('Error in pdf-request:', error);
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
