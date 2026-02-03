import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
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

    // Add a cache-buster to avoid any intermittent caching issues
    const url = new URL(appsScriptUrl);
    url.searchParams.set('ts', Date.now().toString());

    let lastStatus = 0;
    let lastBody = '';

    // Retry a couple of times on transient errors (Apps Script can intermittently return 429/5xx)
    for (let attempt = 1; attempt <= 3; attempt++) {
      const response = await fetch(url.toString(), {
        method: 'GET',
        redirect: 'follow',
        headers: {
          'Cache-Control': 'no-cache',
        },
      });

      lastStatus = response.status;
      lastBody = await response.text();
      console.log(`Apps Script response (attempt ${attempt}):`, lastStatus, lastBody);

      if (response.ok) {
        return new Response(
          JSON.stringify({ success: true, message: 'Google Sheets sync triggered' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
        );
      }

      const isTransient = response.status === 429 || response.status >= 500;
      if (attempt < 3 && isTransient) {
        await sleep(400 * attempt);
        continue;
      }
      break;
    }

    console.error('Apps Script call failed:', lastStatus, lastBody);
    return new Response(
      JSON.stringify({
        success: false,
        error: `Apps Script returned ${lastStatus}`,
        details: lastBody?.slice?.(0, 500) ?? String(lastBody),
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );

  } catch (error: any) {
    console.error('Error triggering sheets sync:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
