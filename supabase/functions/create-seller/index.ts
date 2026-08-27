import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.81.1'
import { buildCorsHeaders, errorResponse } from '../_shared/security.ts'


Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: buildCorsHeaders(req) })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Verify the user making the request is an admin
    const authHeader = req.headers.get('Authorization')!
    const token = authHeader.replace('Bearer ', '')
    const { data: { user } } = await supabaseClient.auth.getUser(token)

    if (!user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        headers: { ...buildCorsHeaders(req), 'Content-Type': 'application/json' },
        status: 401,
      })
    }

    // Check if user is admin or rop
    const { data: roleData } = await supabaseClient
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .in('role', ['admin', 'rop'])
      .maybeSingle()

    if (!roleData) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), {
        headers: { ...buildCorsHeaders(req), 'Content-Type': 'application/json' },
        status: 403,
      })
    }

    // Get request body
    const { email, password, full_name, phone } = await req.json()

    // Create the user
    const { data: authData, error: authError } = await supabaseClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        full_name,
      },
    })

    if (authError) {
      return new Response(JSON.stringify({ error: authError.message }), {
        headers: { ...buildCorsHeaders(req), 'Content-Type': 'application/json' },
        status: 400,
      })
    }

    // Update profile with phone
    if (authData.user && phone) {
      await supabaseClient
        .from('profiles')
        .update({ phone })
        .eq('id', authData.user.id)
    }

    return new Response(JSON.stringify({ success: true, user: authData.user }), {
      headers: { ...buildCorsHeaders(req), 'Content-Type': 'application/json' },
      status: 200,
    })
  } catch (error) {
    return errorResponse(req, 'create-seller', error, 500, 'Operation failed')
  }
})
