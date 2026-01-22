import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.58.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ToggleUserStatusRequest {
  userId: string;
  isActive: boolean;
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Create Supabase client with SERVICE_ROLE_KEY for admin operations
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

    // Verify superadmin role
    const { data: userRoles, error: roleCheckError } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'superadmin')
      .limit(1);

    if (roleCheckError || !userRoles || userRoles.length === 0) {
      console.error('Unauthorized: Superadmin access required');
      return new Response(
        JSON.stringify({ code: 'not_superadmin', message: 'Superadmin access required' }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 403,
        }
      );
    }

    // Parse request body
    const { userId, isActive }: ToggleUserStatusRequest = await req.json();

    if (!userId) {
      return new Response(
        JSON.stringify({ error: 'Missing required field: userId' }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
        }
      );
    }

    console.log(`Toggling user ${userId} status to:`, isActive);

    // Get current user data
    const { data: currentUser, error: getUserError } = await supabase.auth.admin.getUserById(
      userId
    );

    if (getUserError) {
      throw new Error(`Failed to get user: ${getUserError.message}`);
    }

    // Update user metadata and ban status
    const { error: updateError } = await supabase.auth.admin.updateUserById(
      userId,
      {
        ban_duration: isActive ? 'none' : '876000h', // Ban for 100 years if deactivated
        user_metadata: {
          ...currentUser.user?.user_metadata,
          is_active: isActive,
        },
      }
    );

    if (updateError) {
      console.error('Error updating user status:', updateError);
      throw new Error(`Failed to update user status: ${updateError.message}`);
    }

    console.log(`User ${userId} ${isActive ? 'activated and unbanned' : 'deactivated and banned'} successfully`);

    // Log the action
    await supabase
      .from('will_status_events')
      .insert({
        will_id: null,
        previous_status: null,
        new_status: null,
        actor_user_id: user.id,
        notes: `${isActive ? 'Activated' : 'Deactivated'} user account: ${currentUser.user?.email}`,
      });

    return new Response(
      JSON.stringify({
        success: true,
        message: `User ${isActive ? 'activated' : 'deactivated'} successfully`,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('Error toggling user status:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return new Response(
      JSON.stringify({
        success: false,
        error: errorMessage,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
