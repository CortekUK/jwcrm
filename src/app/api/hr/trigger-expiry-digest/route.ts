import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
    },
  });
}

export async function POST(request: NextRequest) {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };

  try {
    // Verify authentication
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json({ error: 'Missing authorization header' }, { status: 401, headers });
    }

    const token = authHeader.replace('Bearer ', '');

    // Get service role key for bypassing RLS
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!serviceRoleKey || serviceRoleKey === 'your-service-role-key-here') {
      return NextResponse.json(
        { error: 'Server configuration error: SUPABASE_SERVICE_ROLE_KEY not configured' },
        { status: 500, headers }
      );
    }

    // Create Supabase client with service role to bypass RLS for role check
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || '',
      serviceRoleKey
    );

    // Verify user
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);

    if (userError || !user) {
      return NextResponse.json({ error: 'Invalid authentication' }, { status: 401, headers });
    }

    // Check if user has HR role (using service role client to bypass RLS)
    const { data: roles, error: rolesError } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id);

    if (rolesError) {
      console.error('Error fetching roles:', rolesError);
      return NextResponse.json({ error: 'Failed to verify permissions' }, { status: 500, headers });
    }

    const hasHRRole = roles?.some(r => r.role === 'hr' || r.role === 'admin');
    if (!hasHRRole) {
      return NextResponse.json({ error: 'Insufficient permissions. HR role required.' }, { status: 403, headers });
    }

    // Get the Supabase URL for calling the Edge Function
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

    if (!supabaseUrl) {
      return NextResponse.json(
        { error: 'Server configuration error: Missing Supabase URL' },
        { status: 500, headers }
      );
    }

    console.log('Triggering document expiry digest Edge Function...');

    // Call the Edge Function
    const edgeFunctionResponse = await fetch(
      `${supabaseUrl}/functions/v1/send-document-expiry-digest`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${serviceRoleKey}`,
        },
        body: JSON.stringify({}),
      }
    );

    const result = await edgeFunctionResponse.json();

    if (!edgeFunctionResponse.ok) {
      console.error('Edge Function error:', result);
      return NextResponse.json(
        {
          success: false,
          error: result.error || 'Edge Function returned an error',
          details: result
        },
        { status: edgeFunctionResponse.status, headers }
      );
    }

    console.log('Edge Function response:', result);

    return NextResponse.json({
      success: true,
      message: 'Document expiry digest triggered successfully',
      result,
    }, { headers });

  } catch (error) {
    console.error('Error triggering expiry digest:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return NextResponse.json({
      success: false,
      error: errorMessage,
    }, { status: 500, headers });
  }
}
