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

    // Get request body
    const { 
      company_name, 
      company_slug,
      admin_email, 
      admin_password, 
      admin_full_name,
      admin_phone,
      subscription_status = 'trial',
      subscription_days = 14,
      max_users = 5
    } = await req.json()

    // Validate required fields
    if (!company_name || !admin_email || !admin_password || !admin_full_name) {
      return new Response(JSON.stringify({ error: 'Missing required fields: company_name, admin_email, admin_password, admin_full_name' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      })
    }

    // Auto-generate slug if not provided
    const slug = company_slug || company_name.toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim()

    // Check if company slug already exists
    const { data: existingCompany } = await supabaseClient
      .from('companies')
      .select('id')
      .eq('slug', slug)
      .maybeSingle()

    if (existingCompany) {
      // Add random suffix if slug exists
      const uniqueSlug = `${slug}-${Date.now().toString(36)}`
      console.log(`Slug ${slug} exists, using ${uniqueSlug}`)
    }

    // Calculate subscription end date
    const subscriptionEndsAt = new Date()
    subscriptionEndsAt.setDate(subscriptionEndsAt.getDate() + subscription_days)

    // Use unique slug
    const finalSlug = existingCompany 
      ? `${slug}-${Date.now().toString(36)}`
      : slug

    // Create the company
    const { data: companyData, error: companyError } = await supabaseClient
      .from('companies')
      .insert({
        name: company_name,
        slug: finalSlug,
        subscription_status,
        subscription_ends_at: subscriptionEndsAt.toISOString(),
        max_users,
        is_active: true
      })
      .select()
      .single()

    if (companyError) {
      console.error('Error creating company:', companyError)
      return new Response(JSON.stringify({ error: 'Failed to create company: ' + companyError.message }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      })
    }

    // Create the admin user
    const { data: authData, error: authError } = await supabaseClient.auth.admin.createUser({
      email: admin_email,
      password: admin_password,
      email_confirm: true,
      user_metadata: {
        full_name: admin_full_name,
      },
    })

    if (authError) {
      // Rollback company creation
      await supabaseClient.from('companies').delete().eq('id', companyData.id)
      return new Response(JSON.stringify({ error: authError.message }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      })
    }

    if (!authData.user) {
      await supabaseClient.from('companies').delete().eq('id', companyData.id)
      return new Response(JSON.stringify({ error: 'Failed to create admin user' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      })
    }

    // Update profile with company_id and phone
    const { error: profileError } = await supabaseClient
      .from('profiles')
      .update({ 
        company_id: companyData.id,
        phone: admin_phone || null
      })
      .eq('id', authData.user.id)

    if (profileError) {
      console.error('Error updating profile:', profileError)
    }

    // Add admin role for this user in this company
    const { error: roleError } = await supabaseClient
      .from('user_roles')
      .update({ company_id: companyData.id })
      .eq('user_id', authData.user.id)

    if (roleError) {
      console.error('Error updating user role:', roleError)
    }

    // Also add explicit admin role
    await supabaseClient
      .from('user_roles')
      .insert({
        user_id: authData.user.id,
        role: 'admin',
        company_id: companyData.id
      })

    // Create default stages for the company
    const defaultStages = [
      { name: 'Yangi mijoz', display_order: 1, color: 'bg-blue-500', company_id: companyData.id },
      { name: 'Qiziqish', display_order: 2, color: 'bg-yellow-500', company_id: companyData.id },
      { name: 'Taklif', display_order: 3, color: 'bg-purple-500', company_id: companyData.id },
      { name: 'Muzokara', display_order: 4, color: 'bg-orange-500', company_id: companyData.id },
      { name: 'Sotildi', display_order: 5, color: 'bg-green-500', company_id: companyData.id },
    ]

    await supabaseClient.from('stages').insert(defaultStages)

    return new Response(JSON.stringify({ 
      success: true, 
      company: companyData,
      admin: { id: authData.user.id, email: authData.user.email }
    }), {
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
