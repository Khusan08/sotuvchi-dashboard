import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const VERIFY_TOKEN = Deno.env.get('FACEBOOK_VERIFY_TOKEN') || 'lovable_crm_verify_token_2024';

Deno.serve(async (req) => {
  console.log('Facebook webhook called:', req.method);

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // GET request is for webhook verification from Facebook
  if (req.method === 'GET') {
    const url = new URL(req.url);
    const mode = url.searchParams.get('hub.mode');
    const token = url.searchParams.get('hub.verify_token');
    const challenge = url.searchParams.get('hub.challenge');

    console.log('Verification request:', { mode, token, challenge });

    if (mode === 'subscribe' && token === VERIFY_TOKEN) {
      console.log('Webhook verified successfully');
      return new Response(challenge, { 
        status: 200,
        headers: { 'Content-Type': 'text/plain' }
      });
    } else {
      console.log('Verification failed');
      return new Response('Forbidden', { status: 403 });
    }
  }

  // POST request is for receiving lead data
  if (req.method === 'POST') {
    try {
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
      const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
      const supabase = createClient(supabaseUrl, supabaseKey);

      const body = await req.json();
      console.log('Received Facebook webhook data:', JSON.stringify(body, null, 2));

      // Facebook sends data in this format:
      // { object: 'page', entry: [ { changes: [ { value: { leadgen_id, form_id, ... } } ] } ] }
      
      if (body.object === 'page') {
        for (const entry of body.entry || []) {
          for (const change of entry.changes || []) {
            if (change.value && change.value.leadgen_id) {
              console.log('Processing lead:', change.value);

              // Extract lead data from the webhook
              const leadData = change.value;
              
              // Get field data if available
              const fieldData = leadData.field_data || [];
              const getFieldValue = (name: string) => {
                const field = fieldData.find((f: any) => f.name === name);
                return field?.values?.[0] || '';
              };

              // Prepare lead for insertion
              const newLead: any = {
                customer_name: getFieldValue('full_name') || getFieldValue('first_name') || 'Facebook Lead',
                customer_phone: getFieldValue('phone_number') || getFieldValue('phone'),
                customer_email: getFieldValue('email'),
                lead_type: 'Yangi lid',
                activity: 'new',
                source: 'Facebook Lead Ads',
                notes: `Lead ID: ${leadData.leadgen_id}\nForm ID: ${leadData.form_id}`,
                status: 'new',
              };

              // Assign to first available admin/rop user
              const { data: adminUsers, error: adminError } = await supabase
                .from('user_roles')
                .select('user_id')
                .in('role', ['admin', 'rop'])
                .limit(1);

              if (adminError) {
                console.error('Error fetching admin users:', adminError);
                throw new Error('Failed to assign lead to a user');
              }

              if (adminUsers && adminUsers.length > 0) {
                newLead['seller_id'] = adminUsers[0].user_id;
              } else {
                console.error('No admin or ROP users found');
                throw new Error('No admin or ROP users found to assign the lead');
              }

              console.log('Inserting lead:', newLead);

              const { data: insertedLead, error: insertError } = await supabase
                .from('leads')
                .insert(newLead)
                .select()
                .single();

              if (insertError) {
                console.error('Error inserting lead:', insertError);
                throw insertError;
              }

              console.log('Lead successfully created:', insertedLead);
            }
          }
        }
      }

      return new Response(
        JSON.stringify({ success: true }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      );
    } catch (error) {
      console.error('Error processing webhook:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      return new Response(
        JSON.stringify({
          success: false,
          error: errorMessage,
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
        }
      );
    }
  }

  return new Response('Method not allowed', { status: 405 });
});
