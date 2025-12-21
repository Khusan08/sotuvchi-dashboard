import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const MYZVONKI_API_KEY = Deno.env.get('MYZVONKI_API_KEY');
    
    if (!MYZVONKI_API_KEY) {
      console.error('MYZVONKI_API_KEY is not configured');
      return new Response(
        JSON.stringify({ error: 'My Zvonki API kaliti sozlanmagan' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const webhookUrl = `${SUPABASE_URL}/functions/v1/myzvonki-webhook`;

    console.log('Registering webhook with URL:', webhookUrl);

    // My Zvonki API endpoint
    const myzvonkiApiUrl = 'https://my.zadarma.com/api/v1/';
    
    // Build the request body according to My Zvonki API
    const requestBody = {
      action: 'webhook.subscribe',
      hooks: {
        'call.start': webhookUrl,
        'call.answer': webhookUrl,
        'call.finish': webhookUrl
      }
    };

    console.log('Request body:', JSON.stringify(requestBody));

    // Make request to My Zvonki API
    const response = await fetch(myzvonkiApiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${MYZVONKI_API_KEY}`,
      },
      body: JSON.stringify(requestBody),
    });

    const responseText = await response.text();
    console.log('My Zvonki response status:', response.status);
    console.log('My Zvonki response:', responseText);

    let responseData;
    try {
      responseData = JSON.parse(responseText);
    } catch {
      responseData = { raw: responseText };
    }

    if (!response.ok) {
      return new Response(
        JSON.stringify({ 
          error: 'My Zvonki API xatolik qaytardi', 
          details: responseData 
        }),
        { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Webhook muvaffaqiyatli ro\'yxatdan o\'tkazildi',
        webhookUrl,
        response: responseData 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('Error registering webhook:', error);
    const errorMessage = error instanceof Error ? error.message : 'Noma\'lum xatolik';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
