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

    // Get user ID to delete from request body
    const { user_id } = await req.json()

    if (!user_id) {
      return new Response(JSON.stringify({ error: 'User ID is required' }), {
        headers: { ...buildCorsHeaders(req), 'Content-Type': 'application/json' },
        status: 400,
      })
    }

    // Delete the user using admin privileges
    const { error: deleteError } = await supabaseClient.auth.admin.deleteUser(user_id)

    if (deleteError) {
      console.error('Error deleting user:', deleteError)
      return new Response(JSON.stringify({ error: 'Unable to delete user' }), {
        headers: { ...buildCorsHeaders(req), 'Content-Type': 'application/json' },
        status: 400,
      })
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...buildCorsHeaders(req), 'Content-Type': 'application/json' },
      status: 200,
    })
  } catch (error) {
    return errorResponse(req, 'delete-user', error, 500, 'Operation failed')
  }
})
