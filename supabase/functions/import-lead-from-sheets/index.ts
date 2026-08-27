import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { buildCorsHeaders, errorResponse, hasValidSharedSecret, jsonResponse } from '../_shared/security.ts';
import {
  optionalEmail,
  optionalNonNegativeNumber,
  optionalPhone,
  optionalString,
  optionalUuid,
  requiredString,
  ValidationError,
} from '../_shared/validation.ts';

// Muhim stage ID - leads automatically go here
const MUHIM_STAGE_ID = '1aa6d478-0e36-4642-b5c5-e2a6b6985c08';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: buildCorsHeaders(req) });
  }

  // Only the Google Sheets integration knows this shared secret.
  if (!hasValidSharedSecret(req, 'SHEETS_WEBHOOK_SECRET')) {
    console.warn('Rejected import-lead-from-sheets request with invalid shared secret');
    return jsonResponse(req, { success: false, error: 'Unauthorized' }, 401);
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const body = await req.json();

    const leadData: Record<string, unknown> = {
      customer_name: requiredString(
        body.customer_name || body['Mijoz ismi'] || body['Mijoz ismi *'] || body['Customer Name'] || body.name,
        'customer_name',
        100,
      ),
      customer_phone: optionalPhone(
        body.customer_phone || body['Telefon raqami'] || body['Telefon raqami *'] || body['Customer Phone'] || body.phone,
        'customer_phone',
      ) ?? null,
      customer_email: optionalEmail(
        body.customer_email || body['Customer Email'] || body.email,
        'customer_email',
      ) ?? null,
      lead_type: optionalString(body.lead_type || body['Lead Type'], 'lead_type', 50) ?? 'Yangi lid',
      activity: optionalString(body.activity || body['Faoliyat turi'] || body['Activity'], 'activity', 50) ?? null,
      source: optionalString(body.source || body['Source'], 'source', 100) ?? 'Google Sheets',
      notes: optionalString(body.notes || body['Notes'], 'notes', 2000) ?? '',
      price: optionalNonNegativeNumber(body.price ?? body['Price'], 'price') ?? null,
      lead_quality: optionalString(body.lead_quality || body['Lead Quality'], 'lead_quality', 50) ?? 'Lid sifati',
      stage: MUHIM_STAGE_ID,
    };

    // seller_id is attacker-influenceable input: only accept it when it maps to a real user.
    const requestedSeller = optionalUuid(body.seller_id || body['Seller ID'], 'seller_id');
    let sellerId: string | undefined;

    if (requestedSeller) {
      const { data: sellerProfile } = await supabase
        .from('profiles')
        .select('id')
        .eq('id', requestedSeller)
        .maybeSingle();
      if (sellerProfile) sellerId = sellerProfile.id;
    }

    if (!sellerId) {
      const { data: adminUsers, error: adminError } = await supabase
        .from('user_roles')
        .select('user_id')
        .in('role', ['admin', 'rop'])
        .limit(1);

      if (adminError || !adminUsers || adminUsers.length === 0) {
        console.error('Unable to resolve an assignee for the lead:', adminError);
        return errorResponse(req, 'import-lead-from-sheets', 'no assignee', 500);
      }
      sellerId = adminUsers[0].user_id;
    }

    leadData.seller_id = sellerId;

    const { data: newLead, error: insertError } = await supabase
      .from('leads')
      .insert(leadData)
      .select('id')
      .single();

    if (insertError) {
      return errorResponse(req, 'import-lead-from-sheets', insertError, 500);
    }

    return jsonResponse(req, {
      success: true,
      message: 'Lead imported successfully',
      lead_id: newLead?.id,
    }, 200);
  } catch (error) {
    if (error instanceof ValidationError) {
      return jsonResponse(req, { success: false, error: error.message }, 400);
    }
    return errorResponse(req, 'import-lead-from-sheets', error, 400, 'Invalid request');
  }
});
