import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.81.1'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
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

    // Users to delete
    const userIds = [
      '71b9d437-7c94-431b-b0ac-d0572b10118d', // Hasan
      'c41d30ce-7a55-494b-949c-aaea82474d35', // Husan
      '2ab203f8-66ff-4fc1-8e8e-93a6be5c393d', // Husan
      'c5767be8-aa53-48f5-954c-980035318a94', // Husan
      '74f305d9-fbea-450d-9ec2-f9f6c04ace0d', // j nkm
    ]

    const results = []

    for (const userId of userIds) {
      const { error } = await supabaseClient.auth.admin.deleteUser(userId)
      if (error) {
        results.push({ userId, success: false, error: error.message })
      } else {
        results.push({ userId, success: true })
      }
    }

    return new Response(JSON.stringify({ results }), {
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
