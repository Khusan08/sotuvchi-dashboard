import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ServiceAccountCredentials {
  type: string;
  project_id: string;
  private_key_id: string;
  private_key: string;
  client_email: string;
  client_id: string;
  auth_uri: string;
  token_uri: string;
  auth_provider_x509_cert_url: string;
  client_x509_cert_url: string;
}

// Create JWT for Google API authentication
async function createJWT(credentials: ServiceAccountCredentials): Promise<string> {
  const header = {
    alg: 'RS256',
    typ: 'JWT',
  };

  const now = Math.floor(Date.now() / 1000);
  const payload = {
    iss: credentials.client_email,
    scope: 'https://www.googleapis.com/auth/spreadsheets',
    aud: 'https://oauth2.googleapis.com/token',
    exp: now + 3600,
    iat: now,
  };

  const encoder = new TextEncoder();
  const headerB64 = btoa(JSON.stringify(header)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  const payloadB64 = btoa(JSON.stringify(payload)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');

  const signatureInput = `${headerB64}.${payloadB64}`;

  // Import the private key
  const privateKey = credentials.private_key.replace(/\\n/g, '\n');
  const pemHeader = '-----BEGIN PRIVATE KEY-----';
  const pemFooter = '-----END PRIVATE KEY-----';
  const pemContents = privateKey.substring(
    privateKey.indexOf(pemHeader) + pemHeader.length,
    privateKey.indexOf(pemFooter)
  ).replace(/\s/g, '');

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

  return `${signatureInput}.${signatureB64}`;
}

// Get access token from Google
async function getAccessToken(credentials: ServiceAccountCredentials): Promise<string> {
  const jwt = await createJWT(credentials);

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  });

  const data = await response.json();
  if (!response.ok) {
    console.error('Token error:', data);
    throw new Error(`Failed to get access token: ${data.error_description || data.error}`);
  }

  return data.access_token;
}

// Append or update row in Google Sheets
async function appendToSheet(
  accessToken: string,
  spreadsheetId: string,
  sheetName: string,
  values: string[][]
): Promise<void> {
  const range = `${sheetName}!A:Z`;
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ values }),
  });

  if (!response.ok) {
    const error = await response.text();
    console.error('Sheets append error:', error);
    throw new Error(`Failed to append to sheet: ${error}`);
  }
}

// Update existing row in Google Sheets
async function updateSheetRow(
  accessToken: string,
  spreadsheetId: string,
  sheetName: string,
  rowNumber: number,
  values: string[]
): Promise<void> {
  const range = `${sheetName}!A${rowNumber}:Z${rowNumber}`;
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}?valueInputOption=USER_ENTERED`;

  const response = await fetch(url, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ values: [values] }),
  });

  if (!response.ok) {
    const error = await response.text();
    console.error('Sheets update error:', error);
    throw new Error(`Failed to update sheet: ${error}`);
  }
}

// Find row by ID in Google Sheets
async function findRowById(
  accessToken: string,
  spreadsheetId: string,
  sheetName: string,
  id: string
): Promise<number | null> {
  const range = `${sheetName}!A:A`;
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}`;

  const response = await fetch(url, {
    headers: { 'Authorization': `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    return null;
  }

  const data = await response.json();
  const values = data.values || [];

  for (let i = 0; i < values.length; i++) {
    if (values[i][0] === id) {
      return i + 1; // Sheets are 1-indexed
    }
  }

  return null;
}

Deno.serve(async (req) => {
  console.log('Sync to sheets function called');

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const serviceAccountKey = Deno.env.get('GOOGLE_SERVICE_ACCOUNT_KEY');
    const spreadsheetId = Deno.env.get('GOOGLE_SHEETS_SPREADSHEET_ID');

    if (!serviceAccountKey || !spreadsheetId) {
      throw new Error('Missing Google Sheets configuration');
    }

    const credentials: ServiceAccountCredentials = JSON.parse(serviceAccountKey);
    const body = await req.json();
    
    console.log('Received sync request:', JSON.stringify(body, null, 2));

    const { type, record, old_record } = body;

    if (!type || !record) {
      throw new Error('Missing type or record in request');
    }

    const accessToken = await getAccessToken(credentials);

    if (type === 'lead') {
      const sheetName = 'Leads';
      const values = [
        record.id || '',
        record.customer_name || '',
        record.customer_phone || '',
        record.customer_email || '',
        record.activity || '',
        record.source || '',
        record.stage || '',
        record.lead_quality || '',
        record.notes || '',
        record.price?.toString() || '',
        record.seller_name || '',
        record.created_at || '',
        record.updated_at || '',
      ];

      // Check if row exists
      const existingRow = await findRowById(accessToken, spreadsheetId, sheetName, record.id);
      
      if (existingRow) {
        await updateSheetRow(accessToken, spreadsheetId, sheetName, existingRow, values);
        console.log(`Updated lead ${record.id} at row ${existingRow}`);
      } else {
        await appendToSheet(accessToken, spreadsheetId, sheetName, [values]);
        console.log(`Appended new lead ${record.id}`);
      }
    } else if (type === 'order') {
      const sheetName = 'Orders';
      const values = [
        record.id || '',
        record.order_number?.toString() || '',
        record.customer_name || '',
        record.customer_phone || '',
        record.region || '',
        record.district || '',
        record.status || '',
        record.total_amount?.toString() || '',
        record.advance_payment?.toString() || '',
        record.notes || '',
        record.seller_name || '',
        record.order_date || '',
        record.created_at || '',
        record.updated_at || '',
      ];

      // Check if row exists
      const existingRow = await findRowById(accessToken, spreadsheetId, sheetName, record.id);
      
      if (existingRow) {
        await updateSheetRow(accessToken, spreadsheetId, sheetName, existingRow, values);
        console.log(`Updated order ${record.id} at row ${existingRow}`);
      } else {
        await appendToSheet(accessToken, spreadsheetId, sheetName, [values]);
        console.log(`Appended new order ${record.id}`);
      }
    } else {
      throw new Error(`Unknown type: ${type}`);
    }

    return new Response(
      JSON.stringify({ success: true, message: `${type} synced to Google Sheets` }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );
  } catch (error) {
    console.error('Error in sync-to-sheets function:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    );
  }
});
