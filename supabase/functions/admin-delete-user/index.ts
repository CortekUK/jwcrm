import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.58.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface DeleteUserRequest {
  userId: string;
}

// Tables/columns that reference auth.users(id) with no ON DELETE CASCADE/SET NULL.
// Postgres will reject the auth.users delete with a foreign-key violation if any
// row here still points at the target user, and GoTrue only reports that back as
// an opaque "Database error deleting user" 500 — so we check these ourselves
// first and return a precise, actionable error instead.
const DEPENDENT_REFERENCES: Array<{ table: string; column: string; label: string }> = [
  { table: 'employees', column: 'created_by', label: 'employee records they created' },
  { table: 'monthly_reviews', column: 'reviewer_id', label: 'monthly reviews they are the reviewer for' },
  { table: 'monthly_reviews', column: 'approved_by', label: 'monthly reviews they approved' },
  { table: 'quarterly_reviews', column: 'reviewer_id', label: 'quarterly reviews they are the reviewer for' },
  { table: 'quarterly_reviews', column: 'approved_by', label: 'quarterly reviews they approved' },
  { table: 'leave_requests', column: 'approved_by', label: 'leave requests they approved' },
  { table: 'kpis', column: 'updated_by', label: 'KPI definitions they last updated' },
  { table: 'kpi_evaluations', column: 'evaluated_by', label: 'KPI evaluations they submitted' },
  { table: 'employee_custom_kpis', column: 'created_by', label: 'custom KPIs they created' },
  { table: 'employee_custom_kpis', column: 'updated_by', label: 'custom KPIs they last updated' },
  { table: 'custom_kpi_evaluations', column: 'evaluated_by', label: 'custom KPI evaluations they submitted' },
  { table: 'attendance', column: 'marked_by', label: 'attendance records they marked' },
  { table: 'attendance_warnings', column: 'sent_by', label: 'attendance warnings they sent' },
  { table: 'finance_transactions', column: 'created_by', label: 'finance transactions they logged' },
  { table: 'employee_documents', column: 'uploaded_by', label: 'employee documents they uploaded' },
  { table: 'user_identity_documents', column: 'uploaded_by_admin_id', label: 'identity documents they uploaded on behalf of a client' },
  { table: 'leave_approval_steps', column: 'approver_id', label: 'leave approval steps assigned to them' },
  { table: 'leave_approval_steps', column: 'response_by', label: 'leave approval steps they responded to' },
  { table: 'leave_approval_steps', column: 'escalated_to', label: 'leave approval steps escalated to them' },
  { table: 'leave_approval_delegations', column: 'delegator_id', label: 'leave approval delegations they created' },
  { table: 'leave_approval_delegations', column: 'delegate_id', label: 'leave approval delegations assigned to them' },
];

async function findDependentRecords(
  supabase: ReturnType<typeof createClient>,
  userId: string
) {
  const blockers: Array<{ table: string; column: string; label: string; count: number }> = [];

  await Promise.all(
    DEPENDENT_REFERENCES.map(async (ref) => {
      const { count, error } = await supabase
        .from(ref.table)
        .select('id', { count: 'exact', head: true })
        .eq(ref.column, userId);

      // If the check itself errors (e.g. table renamed), don't silently proceed —
      // surface it so it gets fixed rather than masking a real blocker.
      if (error) {
        console.error(`Dependent-record check failed for ${ref.table}.${ref.column}:`, error);
        return;
      }

      if (count && count > 0) {
        blockers.push({ ...ref, count });
      }
    })
  );

  return blockers;
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
    const { userId }: DeleteUserRequest = await req.json();

    if (!userId) {
      return new Response(
        JSON.stringify({ error: 'Missing required field: userId' }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
        }
      );
    }

    console.log(`Deleting user:`, userId);

    // Get user data before deletion for logging
    const { data: userData, error: getUserError } = await supabase.auth.admin.getUserById(
      userId
    );

    if (getUserError) {
      throw new Error(`Failed to get user: ${getUserError.message}`);
    }

    const userEmail = userData.user?.email;

    // Check for records that reference this user via a foreign key with no
    // ON DELETE CASCADE/SET NULL — deleting the auth user would otherwise fail
    // at the database level with an opaque error.
    const blockers = await findDependentRecords(supabase, userId);

    if (blockers.length > 0) {
      const reasons = blockers
        .map((b) => `${b.count} ${b.label} (${b.table}.${b.column})`)
        .join('; ');

      return new Response(
        JSON.stringify({
          success: false,
          code: 'user_has_dependent_records',
          error: `Cannot delete ${userEmail || userId}: they still have associated records that must be reassigned or removed first — ${reasons}.`,
          blockers,
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 409,
        }
      );
    }

    // Delete user using Admin API (this will cascade delete related records if configured)
    const { error: deleteError } = await supabase.auth.admin.deleteUser(userId);

    if (deleteError) {
      console.error('Error deleting user:', deleteError);
      throw new Error(`Failed to delete user: ${deleteError.message}`);
    }

    console.log(`User ${userId} deleted successfully`);

    // Log the action
    await supabase
      .from('will_status_events')
      .insert({
        will_id: null,
        previous_status: null,
        new_status: null,
        actor_user_id: user.id,
        notes: `Deleted user account: ${userEmail || userId}`,
      });

    return new Response(
      JSON.stringify({
        success: true,
        message: 'User deleted successfully',
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('Error deleting user:', error);
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
