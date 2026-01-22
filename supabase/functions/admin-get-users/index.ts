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

    // Fetch all profiles (including admins)
    const { data: profilesData, error: profilesError } = await supabase
      .from('profiles')
      .select('user_id, full_name, locale, created_at')
      .order('created_at', { ascending: false });

    if (profilesError) throw profilesError;

    // Fetch all user roles from user_roles table
    const { data: userRolesData, error: rolesError } = await supabase
      .from('user_roles')
      .select('user_id, role');

    if (rolesError) {
      console.error('Error fetching user roles:', rolesError);
    }

    // Create a map of user_id to role for quick lookup
    const roleMap = new Map<string, string>();
    if (userRolesData) {
      for (const userRole of userRolesData) {
        roleMap.set(userRole.user_id, userRole.role);
      }
    }

    // Fetch auth users with admin API
    const enrichedUsers = [];

    for (const profile of profilesData || []) {
      try {
        const { data: authUser, error: authError } = await supabase.auth.admin.getUserById(
          profile.user_id
        );

        if (authError) {
          console.error(`Error fetching auth data for user ${profile.user_id}:`, authError);
          // Still include user with limited data
          enrichedUsers.push({
            ...profile,
            email: 'N/A',
            role: roleMap.get(profile.user_id) || 'client',
            is_active: true,
          });
          continue;
        }

        enrichedUsers.push({
          ...profile,
          email: authUser.user?.email || 'N/A',
          role: roleMap.get(profile.user_id) || 'client',
          is_active: authUser.user?.user_metadata?.is_active !== false, // Default true
        });
      } catch (error) {
        console.error(`Error processing user ${profile.user_id}:`, error);
        // Include user with limited data
        enrichedUsers.push({
          ...profile,
          email: 'N/A',
          role: roleMap.get(profile.user_id) || 'client',
          is_active: true,
        });
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        data: enrichedUsers,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('Error fetching users:', error);
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
