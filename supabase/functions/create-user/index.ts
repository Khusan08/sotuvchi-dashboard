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

    // Verify the user making the request is an admin or rop
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
      .select('role, company_id')
      .eq('user_id', user.id)
      .in('role', ['admin', 'rop'])
      .maybeSingle()

    if (!roleData) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), {
        headers: { ...buildCorsHeaders(req), 'Content-Type': 'application/json' },
        status: 403,
      })
    }

    const creatorCompanyId = roleData.company_id

    // Get request body
    const { email, password, full_name, phone, role } = await req.json()

    // Validate role
    if (!role || !['admin', 'rop', 'sotuvchi'].includes(role)) {
      return new Response(JSON.stringify({ error: 'Invalid role. Must be admin, rop or sotuvchi' }), {
        headers: { ...buildCorsHeaders(req), 'Content-Type': 'application/json' },
        status: 400,
      })
    }

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

    if (!authData.user) {
      return new Response(JSON.stringify({ error: 'Failed to create user' }), {
        headers: { ...buildCorsHeaders(req), 'Content-Type': 'application/json' },
        status: 500,
      })
    }

    // Update profile with phone and company_id
    const profileUpdate: Record<string, any> = {}
    if (phone) profileUpdate.phone = phone
    if (creatorCompanyId) profileUpdate.company_id = creatorCompanyId

    if (Object.keys(profileUpdate).length > 0) {
      await supabaseClient
        .from('profiles')
        .update(profileUpdate)
        .eq('id', authData.user.id)
    }

    // Add the specified role with company_id
    const { error: roleError } = await supabaseClient
      .from('user_roles')
      .insert({
        user_id: authData.user.id,
        role: role,
        company_id: creatorCompanyId
      })

    if (roleError) {
      console.error('Error assigning role:', roleError)
      return new Response(JSON.stringify({ error: 'Failed to assign role' }), {
        headers: { ...buildCorsHeaders(req), 'Content-Type': 'application/json' },
        status: 500,
      })
    }

    return new Response(JSON.stringify({ success: true, user: authData.user }), {
      headers: { ...buildCorsHeaders(req), 'Content-Type': 'application/json' },
      status: 200,
    })
  } catch (error) {
    return errorResponse(req, 'create-user', error, 500, 'Operation failed')
  }
})
