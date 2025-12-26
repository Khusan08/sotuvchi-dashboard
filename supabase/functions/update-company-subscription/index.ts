import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.81.1'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Verify the user making the request is a super_admin
    const authHeader = req.headers.get('Authorization')!
    const token = authHeader.replace('Bearer ', '')
    const { data: { user } } = await supabaseClient.auth.getUser(token)

    if (!user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 401,
      })
    }

    // Check if user is super_admin
    const { data: roleData } = await supabaseClient
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'super_admin')
      .maybeSingle()

    if (!roleData) {
      return new Response(JSON.stringify({ error: 'Forbidden - Super admin only' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 403,
      })
    }

    const { 
      company_id, 
      action, // 'extend', 'cancel', 'activate', 'update_settings'
      days, // for extend action
      subscription_status, // 'trial', 'basic', 'premium', 'cancelled'
      max_users // for update_settings action
    } = await req.json()

    if (!company_id || !action) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      })
    }

    let updateData: any = {}

    if (action === 'extend') {
      if (!days || days <= 0) {
        return new Response(JSON.stringify({ error: 'Invalid days value' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
        })
      }

      // Get current subscription end date
      const { data: company } = await supabaseClient
        .from('companies')
        .select('subscription_ends_at')
        .eq('id', company_id)
        .single()

      const currentEndDate = company?.subscription_ends_at 
        ? new Date(company.subscription_ends_at) 
        : new Date()
      
      // If current end date is in the past, start from today
      const baseDate = currentEndDate < new Date() ? new Date() : currentEndDate
      baseDate.setDate(baseDate.getDate() + days)

      updateData = {
        subscription_ends_at: baseDate.toISOString(),
        subscription_status: subscription_status || 'basic',
        is_active: true
      }
    } else if (action === 'cancel') {
      updateData = {
        subscription_status: 'cancelled',
        is_active: false
      }
    } else if (action === 'activate') {
      updateData = {
        subscription_status: subscription_status || 'basic',
        is_active: true
      }
    } else if (action === 'update_settings') {
      if (max_users !== undefined) {
        updateData.max_users = max_users
      }
      if (subscription_status) {
        updateData.subscription_status = subscription_status
      }
    } else {
      return new Response(JSON.stringify({ error: 'Invalid action' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      })
    }

    const { data, error } = await supabaseClient
      .from('companies')
      .update(updateData)
      .eq('id', company_id)
      .select()
      .single()

    if (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      })
    }

    return new Response(JSON.stringify({ success: true, company: data }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'An error occurred'
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    })
  }
})
