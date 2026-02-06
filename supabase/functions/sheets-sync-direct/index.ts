import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

// Status mapping to Uzbek
const statusMap: Record<string, string> = {
  pending: 'Jarayonda',
  delivered: 'Tugallandi',
  cancelled: 'Bekor qilindi',
};

// Format date to dd.MM.yyyy HH:mm (Tashkent timezone)
function formatDateUz(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Tashkent',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(d);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
  return `${get('day')}.${get('month')}.${get('year')} ${get('hour')}:${get('minute')}`;
}

// Create JWT for Google API authentication
async function createGoogleJWT(serviceAccountKey: any): Promise<string> {
  const header = { alg: 'RS256', typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    iss: serviceAccountKey.client_email,
    scope: 'https://www.googleapis.com/auth/spreadsheets',
    aud: 'https://oauth2.googleapis.com/token',
    exp: now + 3600,
    iat: now,
  };

  const encoder = new TextEncoder();
  const headerB64 = btoa(JSON.stringify(header)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  const payloadB64 = btoa(JSON.stringify(payload)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  const unsignedToken = `${headerB64}.${payloadB64}`;

  // Import private key
  const pemContents = serviceAccountKey.private_key
    .replace('-----BEGIN PRIVATE KEY-----', '')
    .replace('-----END PRIVATE KEY-----', '')
    .replace(/\n/g, '');
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
    encoder.encode(unsignedToken)
  );

  const signatureB64 = btoa(String.fromCharCode(...new Uint8Array(signature)))
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');

  return `${unsignedToken}.${signatureB64}`;
}

// Get access token from Google
async function getGoogleAccessToken(serviceAccountKey: any): Promise<string> {
  const jwt = await createGoogleJWT(serviceAccountKey);

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to get access token: ${errorText}`);
  }

  const data = await response.json();
  return data.access_token;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    console.log('Starting direct Google Sheets sync...');

    // Get environment variables
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const serviceAccountKeyStr = Deno.env.get('GOOGLE_SERVICE_ACCOUNT_KEY');
    const spreadsheetId = Deno.env.get('GOOGLE_SHEETS_SPREADSHEET_ID');

    if (!serviceAccountKeyStr) {
      throw new Error('GOOGLE_SERVICE_ACCOUNT_KEY is not configured');
    }
    if (!spreadsheetId) {
      throw new Error('GOOGLE_SHEETS_SPREADSHEET_ID is not configured');
    }

    const serviceAccountKey = JSON.parse(serviceAccountKeyStr);
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get access token
    console.log('Getting Google access token...');
    const accessToken = await getGoogleAccessToken(serviceAccountKey);
    console.log('Access token obtained successfully');

    // Fetch orders from Supabase
    console.log('Fetching orders from Supabase...');
    const { data: orders, error: ordersError } = await supabase
      .from('orders')
      .select(`
        id,
        order_number,
        customer_name,
        customer_phone,
        customer_phone2,
        region,
        district,
        total_amount,
        advance_payment,
        notes,
        status,
        created_at,
        updated_at,
        telegram_message_id,
        seller_id,
        order_items (
          product_name,
          quantity,
          price
        ),
        profiles:seller_id (
          full_name
        )
      `)
      .order('created_at', { ascending: false })
      .limit(1000);

    if (ordersError) {
      throw new Error(`Failed to fetch orders: ${ordersError.message}`);
    }

    console.log(`Fetched ${orders?.length || 0} orders`);

    // Format orders for Google Sheets (16 columns)
    // A: telegram_message_id, B: message, C: order_number, D: customer_name, E: customer_phone,
    // F: address, G: products, H: total_amount, I: advance_payment, J: remaining_payment,
    // K: status, L: seller_name, M: notes, N: created_at, O: customer_phone2, P: source
    const headers = [
      'telegram_message_id', 'message', 'order_number', 'Mijoz', 'Telefon',
      'Manzil', 'Mahsulotlar', 'Jami summa', 'Oldindan to\'lov', 'Qoldiq',
      'Status', 'Sotuvchi', 'Izoh', 'Buyurtma sanasi', 'Phone 2', 'Source'
    ];

    const rows = (orders || []).map((order: any) => {
      const items = order.order_items || [];
      const products = items
        .map((item: any) => item.product_name)
        .filter(Boolean);
      const productsStr = products.length > 0 ? `["${products.join('","')}"]` : '';

      const remainingPayment = (order.total_amount || 0) - (order.advance_payment || 0);
      const sellerName = order.profiles?.full_name || "Noma'lum";
      const statusUz = statusMap[order.status] || order.status || '';
      const address = `${order.region || ''}, ${order.district || ''}`.replace(/^, |, $/, '').trim();

      return [
        order.telegram_message_id || '',
        `Yangi buyurtma #${order.order_number}`,
        order.order_number,
        order.customer_name || '',
        order.customer_phone || '',
        address,
        productsStr,
        order.total_amount || 0,
        order.advance_payment || 0,
        remainingPayment,
        statusUz,
        sellerName,
        order.notes || '',
        formatDateUz(order.created_at),
        order.customer_phone2 || '',
        'WEB'
      ];
    });

    // Prepare data with headers
    const allData = [headers, ...rows];
    const sheetName = 'Zakazlar';

    // Clear existing data and write new data
    console.log(`Writing ${allData.length} rows to Google Sheets...`);

    // First, clear the sheet
    const clearResponse = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${sheetName}!A:P:clear`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      }
    );

    if (!clearResponse.ok) {
      const clearError = await clearResponse.text();
      console.warn('Clear response (may be okay if sheet is new):', clearError);
    }

    // Write the data
    const writeResponse = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${sheetName}!A1?valueInputOption=USER_ENTERED`,
      {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          range: `${sheetName}!A1`,
          majorDimension: 'ROWS',
          values: allData,
        }),
      }
    );

    if (!writeResponse.ok) {
      const writeError = await writeResponse.text();
      throw new Error(`Failed to write to Google Sheets: ${writeError}`);
    }

    const writeResult = await writeResponse.json();
    console.log('Write result:', writeResult);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Synced ${orders?.length || 0} orders to Google Sheets`,
        updatedCells: writeResult.updatedCells,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error: any) {
    console.error('Error in sheets-sync-direct:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
