import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const looksLikeHtml = (text: string) => {
  const t = (text || '').trimStart().toLowerCase();
  return t.startsWith('<!doctype html') || t.startsWith('<html');
};

const looksLikeGoogleSignIn = (finalUrl: string, bodyText: string) => {
  // When Apps Script isn't truly public, server-to-server requests often land on accounts.google.com
  // and return an HTML sign-in page (status can still be 200).
  const url = (finalUrl || '').toLowerCase();
  const body = (bodyText || '').toLowerCase();
  return (
    url.includes('accounts.google.com') ||
    body.includes('accounts.google.com') ||
    body.includes('signin') ||
    body.includes('choose an account') ||
    looksLikeHtml(bodyText)
  );
};

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

    const tryParseJson = (text: string) => {
      const trimmed = (text || '').trim();
      if (!trimmed) return null;
      if (!(trimmed.startsWith('{') || trimmed.startsWith('['))) return null;
      try {
        return JSON.parse(trimmed);
      } catch {
        return null;
      }
    };

    // Retry a couple of times on transient errors (Apps Script can intermittently return 429/5xx)
    for (let attempt = 1; attempt <= 3; attempt++) {
      const response = await fetch(url.toString(), {
        method: 'GET',
        // If Google redirects to a sign-in page, following redirects can mask the real problem.
        // We still follow by default, but we also detect sign-in HTML in the final response.
        redirect: 'follow',
        headers: {
          'Cache-Control': 'no-cache',
          'Accept': 'application/json,text/plain,*/*',
        },
      });

      lastStatus = response.status;
      lastBody = await response.text();
      const finalUrl = response.url;
      const isSignIn = looksLikeGoogleSignIn(finalUrl, lastBody);

      const parsed = tryParseJson(lastBody);
      const reportedSuccess = typeof parsed?.success === 'boolean' ? parsed.success : null;
      const reportedError = typeof parsed?.error === 'string' ? parsed.error : null;

      console.log(
        `Apps Script response (attempt ${attempt}): status=${lastStatus} url=${finalUrl} signIn=${isSignIn} success=${reportedSuccess} error=${reportedError} body=${lastBody?.slice?.(0, 250) ?? ''}`
      );

      if (response.ok && !isSignIn) {
        // Apps Script can return HTTP 200 with a JSON error payload.
        if (reportedSuccess === false) {
          return new Response(
            JSON.stringify({
              success: false,
              error: 'Apps Script reported failure',
              details: parsed ?? lastBody?.slice?.(0, 1000) ?? String(lastBody),
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
          );
        }

        return new Response(
          JSON.stringify({ success: true, message: 'Google Sheets sync triggered' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
        );
      }

      // Treat sign-in HTML as a hard auth/config error (not transient)
      if (isSignIn) {
        console.error('Apps Script requires sign-in / not publicly accessible.');
        return new Response(
          JSON.stringify({
            success: false,
            error: 'Apps Script is not publicly accessible (Google sign-in page returned).',
            details:
              'Deploy the Apps Script as a Web App with “Execute as: Me” and “Who has access: Anyone”. Then use the /exec URL from that deployment.',
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
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
