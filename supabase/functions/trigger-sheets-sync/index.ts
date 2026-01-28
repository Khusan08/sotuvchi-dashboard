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
    const appsScriptUrl = Deno.env.get('GOOGLE_APPS_SCRIPT_URL');

    if (!appsScriptUrl) {
      console.error('GOOGLE_APPS_SCRIPT_URL not configured');
      return new Response(
        JSON.stringify({ success: false, error: 'Google Apps Script URL not configured' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    console.log('Triggering Google Sheets sync via Apps Script...');

    // Call the Apps Script URL to trigger the sync
    const response = await fetch(appsScriptUrl, {
      method: 'GET',
      redirect: 'follow',
    });

    const responseText = await response.text();
    console.log('Apps Script response:', responseText);

    if (!response.ok) {
      console.error('Apps Script call failed:', response.status, responseText);
      return new Response(
        JSON.stringify({ success: false, error: `Apps Script returned ${response.status}` }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }

    return new Response(
      JSON.stringify({ success: true, message: 'Google Sheets sync triggered' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );
  } catch (error: any) {
    console.error('Error triggering sheets sync:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
