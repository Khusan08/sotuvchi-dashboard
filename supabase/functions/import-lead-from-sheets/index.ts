import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Muhim stage ID - leads automatically go here
const MUHIM_STAGE_ID = "1aa6d478-0e36-4642-b5c5-e2a6b6985c08";

interface LeadData {
  customer_name: string;
  customer_phone?: string;
  customer_email?: string;
  lead_type?: string;
  activity?: string;
  source?: string;
  notes?: string;
  price?: number;
  lead_quality?: string;
  seller_id?: string;
  stage?: string;
}

Deno.serve(async (req) => {
  console.log('Import lead from sheets function called');

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const body = await req.json();
    console.log('Received data from Google Sheets:', body);

    // Extract lead data from the webhook payload - supports Uzbek field names from Google Sheets
    const leadData: LeadData = {
      customer_name: body.customer_name || body['Mijoz ismi'] || body['Mijoz ismi *'] || body['Customer Name'] || body.name,
      customer_phone: body.customer_phone || body['Telefon raqami'] || body['Telefon raqami *'] || body['Customer Phone'] || body.phone,
      customer_email: body.customer_email || body['Customer Email'] || body.email,
      lead_type: body.lead_type || body['Lead Type'] || 'Yangi lid',
      activity: body.activity || body['Faoliyat turi'] || body['Activity'] || null,
      source: body.source || body['Source'] || 'Google Sheets',
      notes: body.notes || body['Notes'] || '',
      price: body.price || body['Price'] ? parseFloat(body.price || body['Price']) : undefined,
      lead_quality: body.lead_quality || body['Lead Quality'] || 'Lid sifati',
      seller_id: body.seller_id || body['Seller ID'],
      stage: MUHIM_STAGE_ID, // Always set to Muhim stage
    };

    // Validate required fields
    if (!leadData.customer_name) {
      throw new Error('Customer name is required');
    }

    // If no seller_id is provided, assign to first available admin/rop user
    if (!leadData.seller_id) {
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
        leadData.seller_id = adminUsers[0].user_id;
      } else {
        throw new Error('No admin or ROP users found to assign the lead');
      }
    }

    console.log('Inserting lead data:', leadData);

    // Insert the lead into the database
    const { data: newLead, error: insertError } = await supabase
      .from('leads')
      .insert(leadData)
      .select()
      .single();

    if (insertError) {
      console.error('Error inserting lead:', insertError);
      throw insertError;
    }

    console.log('Lead successfully created:', newLead);

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Lead imported successfully',
        lead: newLead,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('Error in import-lead-from-sheets function:', error);
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
});
