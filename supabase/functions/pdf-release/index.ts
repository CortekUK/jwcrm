import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

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
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

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

    console.log('Admin verified, proceeding with release');

    const { will_id, reviewer_notes } = await req.json();
    console.log('Releasing PDF to client for will:', will_id);

    // Fetch the will to ensure it exists and has a PDF
    const { data: will, error: willError } = await supabase
      .from('wills')
      .select('*')
      .eq('id', will_id)
      .single();

    if (willError || !will) {
      console.error('Will not found:', willError);
      throw new Error('Will not found');
    }

    if (!will.pdf_path) {
      console.error('No PDF generated for this will');
      throw new Error('No PDF generated for this will');
    }

    console.log('Will found, releasing to client');

    // Update will to release to client
    const { error: updateError } = await supabase
      .from('wills')
      .update({
        status: 'released_to_client',
        visible_to_client: true,
        released_at: new Date().toISOString(),
        reviewed_at: new Date().toISOString(),
        reviewer_user_id: user.id,
        reviewer_notes: reviewer_notes || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', will_id);

    if (updateError) {
      console.error('Failed to update will:', updateError);
      throw updateError;
    }

    // Log status change event
    const { error: eventError } = await supabase
      .from('will_status_events')
      .insert({
        will_id: will_id,
        actor_user_id: user.id,
        previous_status: will.status,
        new_status: 'released_to_client',
        notes: reviewer_notes || 'PDF released to client',
      });

    if (eventError) {
      console.error('Failed to log status event:', eventError);
      // Don't throw, just log the error
    }

    console.log('Successfully released PDF to client');

    return new Response(
      JSON.stringify({
        success: true,
        message: 'PDF successfully released to client',
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('Error releasing PDF:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return new Response(
      JSON.stringify({
        success: false,
        error: errorMessage,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    );
  }
});
