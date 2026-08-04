import { Resend } from 'npm:resend@6.1.3';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.58.0';
import { EMAIL_FROM, EMAIL_REPLY_TO } from '../_shared/email.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

type PermissionLevel = 'head' | 'employee';
type AppRole = 'client' | 'admin' | 'hr' | 'finance' | 'lead_management' | 'salesperson' | 'account_manager';

// Roles that support tiered permissions
const TIERED_PERMISSION_ROLES: AppRole[] = ['hr', 'finance', 'lead_management', 'admin'];

interface RoleWithPermission {
  role: AppRole;
  permissionLevel?: PermissionLevel;
}

interface CreateDashboardUserRequest {
  fullName: string;
  email: string;
  locale?: 'en' | 'ar';
  role?: AppRole;
  roles?: AppRole[];
  rolesWithPermissions?: RoleWithPermission[];
  sendWelcomeEmail?: boolean;
}

// Generate secure temporary password
function generateTempPassword(): string {
  const length = 16;
  const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
  let password = '';

  // Ensure at least one of each type
  password += 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'[Math.floor(Math.random() * 26)]; // Uppercase
  password += 'abcdefghijklmnopqrstuvwxyz'[Math.floor(Math.random() * 26)]; // Lowercase
  password += '0123456789'[Math.floor(Math.random() * 10)]; // Number
  password += '!@#$%^&*'[Math.floor(Math.random() * 8)]; // Special

  // Fill the rest randomly
  for (let i = password.length; i < length; i++) {
    password += charset[Math.floor(Math.random() * charset.length)];
  }

  // Shuffle the password
  return password.split('').sort(() => Math.random() - 0.5).join('');
}

// Role display names for emails
const roleDisplayNames: Record<string, string> = {
  client: 'Client',
  admin: 'Administrator',
  superadmin: 'Super Administrator',
  hr: 'HR',
  finance: 'Finance',
  lead_management: 'Lead Management',
  salesperson: 'Salesperson',
  account_manager: 'Account Manager',
};

// Permission level display names
const permissionDisplayNames: Record<string, string> = {
  head: 'Head',
  employee: 'Employee',
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

    // Verify admin or superadmin role
    const { data: adminRoleCheck, error: roleCheckError } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .in('role', ['admin', 'superadmin'])
      .limit(1);

    if (roleCheckError || !adminRoleCheck || adminRoleCheck.length === 0) {
      console.error('Unauthorized: Admin or superadmin access required');
      throw new Error('Unauthorized: Admin access required');
    }

    // Parse request body
    const {
      fullName,
      email,
      locale = 'en',
      role,
      roles,
      rolesWithPermissions,
      sendWelcomeEmail = true,
    }: CreateDashboardUserRequest = await req.json();

    // Build roles with permission levels
    // Priority: rolesWithPermissions > roles > role
    let rolesToInsert: RoleWithPermission[] = [];

    if (rolesWithPermissions && rolesWithPermissions.length > 0) {
      // Use the new format with explicit permission levels
      rolesToInsert = rolesWithPermissions.map(rwp => ({
        role: rwp.role,
        permissionLevel: TIERED_PERMISSION_ROLES.includes(rwp.role)
          ? (rwp.permissionLevel || 'head')
          : 'head', // Non-tiered roles always get 'head'
      }));
    } else if (roles && roles.length > 0) {
      // Legacy format: all roles default to 'head'
      rolesToInsert = roles.map(r => ({ role: r, permissionLevel: 'head' as PermissionLevel }));
    } else if (role) {
      rolesToInsert = [{ role, permissionLevel: 'head' as PermissionLevel }];
    } else {
      rolesToInsert = [{ role: 'client' as AppRole, permissionLevel: 'head' as PermissionLevel }];
    }

    // Support both single role and multiple roles (for validation and logging)
    const userRolesToAssign: string[] = rolesToInsert.map(r => r.role);

    // Primary role used to seed user_metadata so the handle_new_user trigger
    // inserts the correct role (instead of defaulting to 'client').
    const primaryRole: AppRole = rolesToInsert[0]?.role ?? 'client';

    // Validate required fields
    if (!fullName || !email) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: fullName and email are required' }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
        }
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return new Response(
        JSON.stringify({ error: 'Invalid email format' }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
        }
      );
    }

    // Validate roles
    const validRoles = ['client', 'admin', 'hr', 'finance', 'lead_management', 'salesperson', 'account_manager'];
    const invalidRoles = userRolesToAssign.filter(r => !validRoles.includes(r));
    if (invalidRoles.length > 0) {
      return new Response(
        JSON.stringify({ error: `Invalid role(s): ${invalidRoles.join(', ')}. Must be one of: ${validRoles.join(', ')}` }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
        }
      );
    }

    // Check if user is trying to create salesperson - only superadmin can do this
    if (userRolesToAssign.includes('salesperson')) {
      const { data: superadminCheck, error: superadminCheckError } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .eq('role', 'superadmin')
        .limit(1);

      if (superadminCheckError || !superadminCheck || superadminCheck.length === 0) {
        console.error('Unauthorized: Only superadmin can create salesperson accounts');
        return new Response(
          JSON.stringify({ error: 'Unauthorized: Only superadmin can create salesperson accounts' }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 403,
          }
        );
      }
    }

    console.log('Creating dashboard user:', { email, fullName, locale, roles: userRolesToAssign });

    // Generate temporary password
    const tempPassword = generateTempPassword();

    // Create user using Admin API
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email,
      password: tempPassword,
      email_confirm: true, // Auto-confirm email
      user_metadata: {
        full_name: fullName,
        role: primaryRole,
        locale: locale,
      },
    });

    if (authError) {
      console.error('Error creating user:', authError);
      throw new Error(`Failed to create user: ${authError.message}`);
    }

    if (!authData.user) {
      throw new Error('User creation failed: No user data returned');
    }

    console.log('User created successfully:', authData.user.id);

    // Update profile with locale
    const { error: profileError } = await supabase
      .from('profiles')
      .update({ locale })
      .eq('user_id', authData.user.id);

    if (profileError) {
      console.error('Error updating profile:', profileError);
      // Don't throw - user is created, just log the error
    }

    // Insert all roles with permission levels
    const roleInserts = rolesToInsert.map(r => ({
      user_id: authData.user.id,
      role: r.role,
      permission_level: r.permissionLevel || 'head',
    }));

    // Upsert (not insert): the handle_new_user trigger has already inserted the
    // primary role from user_metadata, so a plain insert would hit the
    // UNIQUE (user_id, role) constraint and fail. onConflict updates the
    // permission_level and tolerates the trigger's pre-existing row.
    const { error: roleError } = await supabase
      .from('user_roles')
      .upsert(roleInserts, { onConflict: 'user_id,role' });

    if (roleError) {
      console.error('Error inserting user roles:', roleError);
      throw new Error(`Failed to create user roles: ${roleError.message}`);
    }

    // Send welcome email if enabled
    let emailSent = false;
    let emailError = null;

    if (sendWelcomeEmail) {
      const resendApiKey = Deno.env.get('RESEND_API_KEY');
      if (resendApiKey) {
        try {
          const resend = new Resend(resendApiKey);
          const fromEmail = EMAIL_FROM;
          const portalUrl = 'https://willsgenerator.vercel.app';

          const roleDisplay = userRolesToAssign.map(r => roleDisplayNames[r] || r).join(', ');

          console.log('=== EMAIL DEBUG INFO ===');
          console.log('Sending welcome email to:', email);
          console.log('Roles:', userRolesToAssign.join(', '), '- Display name:', roleDisplay);
          console.log('========================');

          const subject = `Welcome to Just Wills - Your ${roleDisplay} Account Has Been Created`;

          const { data: emailData, error: sendError } = await resend.emails.send({
            from: fromEmail,
            to: email,
            replyTo: EMAIL_REPLY_TO,
            subject,
            html: `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <div style="background-color: #0C5536; padding: 20px; text-align: center; border-radius: 8px 8px 0 0;">
                  <h1 style="color: white; margin: 0; font-size: 24px;">Welcome to Just Wills</h1>
                  <p style="color: white; margin: 5px 0 0 0; font-size: 14px;">${roleDisplay} Portal</p>
                </div>

                <div style="background-color: white; padding: 30px; border: 1px solid #E6E6E4;">
                  <p>Dear ${fullName},</p>

                  <p>Your ${roleDisplay} account has been created by our administrative team. You can now access the Just Wills ${roleDisplay} portal.</p>

                  <div style="background-color: #E6F7F1; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #0C5536;">
                    <h3 style="color: #0C5536; margin-top: 0; font-size: 16px;">Your Login Credentials:</h3>
                    <p style="margin: 5px 0;"><strong>Email:</strong> ${email}</p>
                    <p style="margin: 5px 0;"><strong>Temporary Password:</strong> <code style="background-color: #f5f5f5; padding: 2px 6px; border-radius: 3px; font-size: 14px;">${tempPassword}</code></p>
                  </div>

                  <div style="background-color: #FFF9E6; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #C6A03B;">
                    <h3 style="color: #C6A03B; margin-top: 0; font-size: 16px;">Important Security Notice:</h3>
                    <ul style="color: #6B6B6B; margin: 10px 0; padding-left: 20px;">
                      <li>Please change your password immediately after your first login</li>
                      <li>Use a strong, unique password for your account</li>
                      <li>Never share your password with anyone</li>
                    </ul>
                  </div>

                  <p style="color: #0C5536; margin-top: 30px;"><strong>Just Wills Team</strong></p>
                </div>

                <div style="background-color: #f5f5f5; padding: 15px; text-align: center; border-radius: 0 0 8px 8px;">
                  <p style="color: #999; font-size: 12px; margin: 0;">
                    This is an automated message from Just Wills. Please do not reply to this email.
                  </p>
                </div>
              </div>
            `,
          });

          if (sendError) {
            console.error('Email sending error:', sendError);
            emailError = sendError.message;
          } else {
            console.log('Welcome email sent successfully, ID:', emailData?.id);
            emailSent = true;
          }
        } catch (error) {
          console.error('Failed to send welcome email:', error);
          emailError = error instanceof Error ? error.message : 'Unknown error';
        }
      } else {
        console.warn('RESEND_API_KEY not configured - skipping email');
        emailError = 'RESEND_API_KEY not configured';
      }
    }

    // Log the user creation in activity log
    const roleNamesWithPermissions = rolesToInsert.map(r => {
      const roleName = roleDisplayNames[r.role] || r.role;
      if (TIERED_PERMISSION_ROLES.includes(r.role)) {
        const permLevel = permissionDisplayNames[r.permissionLevel || 'head'] || r.permissionLevel;
        return `${permLevel} ${roleName}`;
      }
      return roleName;
    }).join(', ');
    await supabase
      .from('will_status_events')
      .insert({
        will_id: null,
        previous_status: null,
        new_status: null,
        actor_user_id: user.id,
        notes: `Created new account: ${fullName} (${email}) with roles: ${roleNamesWithPermissions}`,
      });

    return new Response(
      JSON.stringify({
        success: true,
        message: 'User created successfully',
        data: {
          userId: authData.user.id,
          email: authData.user.email,
          fullName,
          roles: userRolesToAssign,
          tempPassword,
          emailSent,
          emailError,
        },
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('Error creating dashboard user:', error);
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
