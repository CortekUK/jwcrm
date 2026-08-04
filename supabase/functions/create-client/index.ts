import { Resend } from 'npm:resend@6.1.3';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.58.0';
import { EMAIL_FROM, EMAIL_REPLY_TO } from '../_shared/email.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CreateClientRequest {
  fullName: string;
  email: string;
  locale?: 'en' | 'ar';
  role?: 'client' | 'admin';
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

    // Verify admin role
    const { data: userRoles, error: roleCheckError } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'admin')
      .limit(1);

    if (roleCheckError || !userRoles || userRoles.length === 0) {
      console.error('Unauthorized: Admin access required');
      throw new Error('Unauthorized: Admin access required');
    }

    // Parse request body
    const {
      fullName,
      email,
      locale = 'en',
      role = 'client',
      sendWelcomeEmail = true,
    }: CreateClientRequest = await req.json();

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

    console.log('Creating client:', { email, fullName, locale });

    // Generate temporary password
    const tempPassword = generateTempPassword();

    // Create user using Admin API
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email,
      password: tempPassword,
      email_confirm: true, // Auto-confirm email
      user_metadata: {
        full_name: fullName,
        role: role,
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

    // Insert the role (trigger doesn't create any role)
    const { error: roleError } = await supabase
      .from('user_roles')
      .insert({
        user_id: authData.user.id,
        role: role,
      });

    if (roleError) {
      console.error('Error inserting user role:', roleError);
      throw new Error(`Failed to create user role: ${roleError.message}`);
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

          console.log('=== EMAIL DEBUG INFO ===');
          console.log('Sending welcome email to:', email);
          console.log('Sending from:', fromEmail);
          console.log('RESEND_API_KEY configured:', resendApiKey ? 'YES (length: ' + resendApiKey.length + ')' : 'NO');
          console.log('========================');

          const { data: emailData, error: sendError } = await resend.emails.send({
            from: fromEmail,
            to: email,
            replyTo: EMAIL_REPLY_TO,
            subject: 'Welcome to Just Wills - Your Account Has Been Created',
            html: `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <div style="background-color: #0C5536; padding: 20px; text-align: center; border-radius: 8px 8px 0 0;">
                  <h1 style="color: white; margin: 0; font-size: 24px;">Welcome to Just Wills</h1>
                  <p style="color: white; margin: 5px 0 0 0; font-size: 14px;">Professional Will Drafting Services</p>
                </div>

                <div style="background-color: white; padding: 30px; border: 1px solid #E6E6E4;">
                  <p>Dear ${fullName},</p>

                  <p>Your account has been created by our administrative team. You can now access the Just Wills client portal to manage your will documents.</p>

                  <div style="background-color: #E6F7F1; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #0C5536;">
                    <h3 style="color: #0C5536; margin-top: 0; font-size: 16px;">Your Login Credentials:</h3>
                    <p style="margin: 5px 0;"><strong>Email:</strong> ${email}</p>
                    <p style="margin: 5px 0;"><strong>Temporary Password:</strong> <code style="background-color: #f5f5f5; padding: 2px 6px; border-radius: 3px; font-size: 14px;">${tempPassword}</code></p>
                    <p style="margin: 15px 0 5px 0;"><strong>Portal URL:</strong></p>
                    <p style="margin: 5px 0;"><a href="${portalUrl}/auth" style="color: #0C5536; text-decoration: underline;">${portalUrl}/auth</a></p>
                  </div>

                  <div style="background-color: #FFF9E6; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #C6A03B;">
                    <h3 style="color: #C6A03B; margin-top: 0; font-size: 16px;">🔒 Important Security Notice:</h3>
                    <ul style="color: #6B6B6B; margin: 10px 0; padding-left: 20px;">
                      <li>Please change your password immediately after your first login</li>
                      <li>Use a strong, unique password for your account</li>
                      <li>Never share your password with anyone</li>
                      <li>Keep your login credentials secure</li>
                    </ul>
                  </div>

                  <div style="background-color: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
                    <h3 style="color: #0C5536; margin-top: 0;">Getting Started:</h3>
                    <ol style="color: #333; line-height: 1.8; margin: 10px 0; padding-left: 20px;">
                      <li>Click the portal link above or visit ${portalUrl}/auth</li>
                      <li>Enter your email and temporary password</li>
                      <li>Change your password when prompted</li>
                      <li>Complete your will information form</li>
                      <li>Review and submit your will for processing</li>
                    </ol>
                  </div>

                  <p>If you have any questions or need assistance, please don't hesitate to contact our support team.</p>

                  <p style="color: #0C5536; margin-top: 30px;"><strong>Just Wills Team</strong></p>
                </div>

                <div style="background-color: #f5f5f5; padding: 15px; text-align: center; border-radius: 0 0 8px 8px;">
                  <p style="color: #999; font-size: 12px; margin: 0;">
                    This is an automated message from Just Wills. Please do not reply to this email.
                  </p>
                  <p style="color: #999; font-size: 12px; margin: 5px 0;">
                    For support, please contact us through the client portal.
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

    // Log the client creation in activity log
    await supabase
      .from('will_status_events')
      .insert({
        will_id: null,
        previous_status: null,
        new_status: null,
        actor_user_id: user.id,
        notes: `Created new client account: ${fullName} (${email})`,
      });

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Client created successfully',
        data: {
          userId: authData.user.id,
          email: authData.user.email,
          fullName,
          tempPassword, // Return to admin
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
    console.error('Error creating client:', error);
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
