import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Google Sheets API helper
async function appendToSheet(auth: any, spreadsheetId: string, range: string, values: any[][]) {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`;
  
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${auth.access_token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ values }),
  });

  if (!response.ok) {
    const error = await response.text();
    console.error('Google Sheets API error:', error);
    throw new Error(`Failed to append to sheet: ${error}`);
  }

  return await response.json();
}

// Get access token from service account
async function getAccessToken(serviceAccountKey: any) {
  const now = Math.floor(Date.now() / 1000);
  const expiry = now + 3600;

  const header = { alg: 'RS256', typ: 'JWT' };
  const payload = {
    iss: serviceAccountKey.client_email,
    scope: 'https://www.googleapis.com/auth/spreadsheets',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: expiry,
  };

  // Create JWT
  const encoder = new TextEncoder();
  const headerB64 = btoa(JSON.stringify(header)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  const payloadB64 = btoa(JSON.stringify(payload)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  
  const signatureInput = `${headerB64}.${payloadB64}`;
  
  // Import private key
  const privateKeyPem = serviceAccountKey.private_key;
  const pemHeader = '-----BEGIN PRIVATE KEY-----';
  const pemFooter = '-----END PRIVATE KEY-----';
  const pemContents = privateKeyPem.replace(pemHeader, '').replace(pemFooter, '').replace(/\s/g, '');
  const binaryKey = Uint8Array.from(atob(pemContents), c => c.charCodeAt(0));
  
  const cryptoKey = await crypto.subtle.importKey(
    'pkcs8',
    binaryKey,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign']
  );
  
  const signature = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    cryptoKey,
    encoder.encode(signatureInput)
  );
  
  const signatureB64 = btoa(String.fromCharCode(...new Uint8Array(signature)))
    .replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  
  const jwt = `${signatureInput}.${signatureB64}`;

  // Exchange JWT for access token
  const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
  });

  if (!tokenResponse.ok) {
    const error = await tokenResponse.text();
    console.error('Token exchange error:', error);
    throw new Error(`Failed to get access token: ${error}`);
  }

  return await tokenResponse.json();
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { type, data } = await req.json();
    
    console.log(`Push to sheets: type=${type}`);

    const serviceAccountKeyStr = Deno.env.get('GOOGLE_SERVICE_ACCOUNT_KEY');
    const spreadsheetId = Deno.env.get('GOOGLE_SHEETS_SPREADSHEET_ID');

    if (!serviceAccountKeyStr || !spreadsheetId) {
      console.error('Missing Google Sheets configuration');
      return new Response(
        JSON.stringify({ success: false, error: 'Google Sheets not configured' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    console.log('Service account key length:', serviceAccountKeyStr.length);
    console.log('First 50 chars:', serviceAccountKeyStr.substring(0, 50));
    
    let serviceAccountKey;
    try {
      serviceAccountKey = JSON.parse(serviceAccountKeyStr);
    } catch (parseError) {
      console.error('Failed to parse service account key:', parseError);
      console.error('Key value (first 100 chars):', serviceAccountKeyStr.substring(0, 100));
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid service account key format' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }
    const auth = await getAccessToken(serviceAccountKey);

    if (type === 'order') {
      const order = data;
      // Format: ID, Order Number, Customer, Phone, Phone2, Address, Products, Total, Advance, Remaining, Notes, Seller, Status, Created
      const products = (order.items || [])
        .map((item: any) => `${item.product_name} (${item.quantity}x${item.price?.toLocaleString() || 0})`)
        .join(', ');
      
      const remainingPayment = (order.total_amount || 0) - (order.advance_payment || 0);
      const address = `${order.region || ''}, ${order.district || ''}`.replace(/^, |, $/, '');
      
      const row = [
        order.id,
        order.order_number,
        order.customer_name,
        order.customer_phone || '',
        order.customer_phone2 || '',
        address,
        products,
        order.total_amount || 0,
        order.advance_payment || 0,
        remainingPayment,
        order.notes || '',
        order.seller_name || '',
        order.status,
        new Date(order.created_at || new Date()).toLocaleString('uz-UZ'),
      ];

      await appendToSheet(auth, spreadsheetId, 'Zakazlar!A:N', [row]);
      console.log('Order synced to Google Sheets:', order.order_number);
    } else if (type === 'lead') {
      const lead = data;
      // Format: ID, Name, Phone, Email, Type, Source, Stage, Status, Notes, Activity, Action Status, Delivery Status, Price, Seller, Created
      const row = [
        lead.id,
        lead.customer_name,
        lead.customer_phone || '',
        lead.customer_email || '',
        lead.lead_type || '',
        lead.source || '',
        lead.stage_name || '',
        lead.status,
        lead.notes || '',
        lead.activity || '',
        lead.action_status || '',
        lead.delivery_status || '',
        lead.price || 0,
        lead.seller_name || '',
        new Date(lead.created_at || new Date()).toLocaleString('uz-UZ'),
      ];

      await appendToSheet(auth, spreadsheetId, 'Lidlar!A:O', [row]);
      console.log('Lead synced to Google Sheets:', lead.customer_name);
    }

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );
  } catch (error: any) {
    console.error('Error in push-to-sheets:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
