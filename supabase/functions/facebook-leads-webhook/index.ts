import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { buildCorsHeaders, errorResponse, jsonResponse, verifyFacebookSignature } from '../_shared/security.ts';
import { optionalEmail, optionalPhone, optionalString, requiredString } from '../_shared/validation.ts';

const VERIFY_TOKEN = Deno.env.get('FACEBOOK_VERIFY_TOKEN');

Deno.serve(async (req) => {
  console.log('Facebook webhook called:', req.method);

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: buildCorsHeaders(req) });
  }

  // GET request is for webhook verification from Facebook
  if (req.method === 'GET') {
    const url = new URL(req.url);
    const mode = url.searchParams.get('hub.mode');
    const token = url.searchParams.get('hub.verify_token');
    const challenge = url.searchParams.get('hub.challenge');

    if (!VERIFY_TOKEN) {
      console.error('FACEBOOK_VERIFY_TOKEN is not configured');
      return new Response('Forbidden', { status: 403 });
    }

    if (mode === 'subscribe' && token === VERIFY_TOKEN) {
      console.log('Webhook verified successfully');
      return new Response(challenge, {
        status: 200,
        headers: { 'Content-Type': 'text/plain' },
      });
    }
    console.log('Verification failed');
    return new Response('Forbidden', { status: 403 });
  }

  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  // Raw body is needed to validate Facebook's HMAC signature.
  const rawBody = await req.text();
  const signatureValid = await verifyFacebookSignature(
    rawBody,
    req.headers.get('x-hub-signature-256'),
  );

  if (!signatureValid) {
    console.warn('Rejected Facebook webhook with invalid or missing signature');
    return jsonResponse(req, { success: false, error: 'Unauthorized' }, 401);
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const body = JSON.parse(rawBody);

    if (body.object === 'page') {
      for (const entry of body.entry || []) {
        for (const change of entry.changes || []) {
          if (change.value && change.value.leadgen_id) {
            const leadData = change.value;
            const fieldData = Array.isArray(leadData.field_data) ? leadData.field_data : [];
            const getFieldValue = (name: string) => {
              const field = fieldData.find((f: any) => f.name === name);
              return field?.values?.[0] || '';
            };

            const newLead: Record<string, unknown> = {
              customer_name:
                optionalString(getFieldValue('full_name') || getFieldValue('first_name'), 'customer_name', 100) ??
                'Facebook Lead',
              customer_phone: optionalPhone(getFieldValue('phone_number') || getFieldValue('phone'), 'customer_phone') ?? null,
              customer_email: optionalEmail(getFieldValue('email'), 'customer_email') ?? null,
              lead_type: 'Yangi lid',
              activity: 'new',
              source: 'Facebook Lead Ads',
              notes: `Lead ID: ${requiredString(String(leadData.leadgen_id), 'leadgen_id', 64)}`,
              status: 'new',
            };

            const { data: adminUsers, error: adminError } = await supabase
              .from('user_roles')
              .select('user_id')
              .in('role', ['admin', 'rop'])
              .limit(1);

            if (adminError || !adminUsers || adminUsers.length === 0) {
              console.error('Unable to resolve an assignee for the lead:', adminError);
              return errorResponse(req, 'facebook-leads-webhook', 'no assignee', 500);
            }

            newLead['seller_id'] = adminUsers[0].user_id;

            const { error: insertError } = await supabase.from('leads').insert(newLead);
            if (insertError) {
              return errorResponse(req, 'facebook-leads-webhook', insertError, 500);
            }
            console.log('Lead successfully created from Facebook webhook');
          }
        }
      }
    }

    return jsonResponse(req, { success: true }, 200);
  } catch (error) {
    return errorResponse(req, 'facebook-leads-webhook', error, 400, 'Invalid request');
  }
});
