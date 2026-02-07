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

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    console.log('Starting Google Sheets sync via Apps Script...');

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const appsScriptUrl = Deno.env.get('GOOGLE_APPS_SCRIPT_URL');

    if (!appsScriptUrl) {
      throw new Error('GOOGLE_APPS_SCRIPT_URL is not configured');
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Parse request body for optional single order sync
    let body: any = {};
    try {
      body = await req.json();
    } catch { /* empty body is fine for full sync */ }

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

    // Headers matching user's sheet: 13 columns
    const headers = [
      'telegram_message_id', 'message', 'Yangi buyurtma', 'Mijoz', 'Telefon',
      'Manzil', 'Mahsulotlar', 'Jami summa', "Oldindan to'lov", 'Note',
      'Qoldiq', 'Status', 'Sotuvchi'
    ];

    const rows = (orders || []).map((order: any) => {
      const items = order.order_items || [];
      const products = items.map((item: any) => item.product_name).filter(Boolean);
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
        order.notes || '',
        remainingPayment,
        statusUz,
        sellerName
      ];
    });

    const allData = [headers, ...rows];

    // Send data to Google Apps Script
    console.log(`Sending ${allData.length} rows to Google Apps Script...`);
    const response = await fetch(appsScriptUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'syncAll',
        sheetName: 'Zakazlar',
        data: allData,
      }),
      redirect: 'follow',
    });

    const resultText = await response.text();
    console.log('Apps Script response status:', response.status);
    console.log('Apps Script response:', resultText);

    let result: any;
    try {
      result = JSON.parse(resultText);
    } catch {
      result = { raw: resultText };
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `Synced ${orders?.length || 0} orders to Google Sheets`,
        appsScriptResponse: result,
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
