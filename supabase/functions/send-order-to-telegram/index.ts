import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface OrderData {
  order_id?: string;
  order_number: number;
  customer_name: string;
  customer_phone: string;
  customer_phone2?: string;
  region?: string;
  district?: string;
  products: Array<{
    product_name: string;
    quantity: number;
    price: number;
  }>;
  total_amount: number;
  advance_payment?: number;
  notes?: string;
  seller_name: string;
  status?: string;
}

const formatMessage = (order: OrderData, isEdit: boolean = false) => {
  // Format products list
  const productsList = order.products
    .map((p, i) => `${i + 1}. ${p.product_name}`)
    .join('\n');

  // Calculate remaining amount
  const remainingAmount = order.total_amount - (order.advance_payment || 0);

  // Format current date and time
  const now = new Date();
  const orderDateTime = now.toLocaleString('uz-UZ', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Tashkent'
  });

  const statusEmoji = order.status === 'delivered' ? '✅' : order.status === 'cancelled' ? '❌' : '🔄';
  const statusText = order.status === 'delivered' ? 'Tugallandi' : order.status === 'cancelled' ? 'Bekor qilindi' : 'Jarayonda';

  const prefix = isEdit ? `✏️ <b>Tahrirlangan buyurtma #${order.order_number}</b>` : `🆕 <b>Yangi buyurtma #${order.order_number}</b>`;

  return `
${prefix}

👤 <b>Mijoz:</b> ${order.customer_name}
📞 <b>Telefon:</b> ${order.customer_phone}${order.customer_phone2 ? `\n📞 <b>Telefon 2:</b> ${order.customer_phone2}` : ''}
📍 <b>Manzil:</b> ${order.region || '-'}, ${order.district || '-'}

📦 <b>Mahsulotlar:</b>
${productsList}

💰 <b>Jami summa:</b> ${order.total_amount.toLocaleString()} so'm
💵 <b>Oldindan to'lov:</b> ${(order.advance_payment || 0).toLocaleString()} so'm
💳 <b>Qoldiq:</b> ${remainingAmount.toLocaleString()} so'm

${statusEmoji} <b>Status:</b> ${statusText}
👨‍💼 <b>Sotuvchi:</b> ${order.seller_name}
${order.notes ? `\n📝 <b>Izoh:</b> ${order.notes}` : ''}

📅 <b>${isEdit ? 'Yangilangan' : 'Buyurtma'} sanasi:</b> ${orderDateTime}
  `.trim();
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { order, action = 'create' }: { order: OrderData; action?: 'create' | 'edit' } = await req.json();

    const BOT_TOKEN = Deno.env.get('TELEGRAM_BOT_TOKEN');
    const CHAT_ID = Deno.env.get('TELEGRAM_CHAT_ID');
    const TOPIC_ID = Deno.env.get('TELEGRAM_TOPIC_ID');

    if (!BOT_TOKEN || !CHAT_ID || !TOPIC_ID) {
      throw new Error('Telegram credentials not configured');
    }

    const message = formatMessage(order, action === 'edit');

    console.log('Sending message to Telegram:', { CHAT_ID, TOPIC_ID, action });

    // Send message to Telegram topic
    const telegramResponse = await fetch(
      `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          chat_id: CHAT_ID,
          message_thread_id: parseInt(TOPIC_ID),
          text: message,
          parse_mode: 'HTML',
        }),
      }
    );

    const telegramData = await telegramResponse.json();
    console.log('Telegram response:', telegramData);

    if (!telegramResponse.ok) {
      throw new Error(`Telegram API error: ${JSON.stringify(telegramData)}`);
    }

    // Save message_id to orders table if order_id provided
    if (order.order_id && telegramData.result?.message_id) {
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
      const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
      const supabase = createClient(supabaseUrl, supabaseKey);

      await supabase
        .from('orders')
        .update({ telegram_message_id: telegramData.result.message_id })
        .eq('id', order.order_id);
    }

    return new Response(
      JSON.stringify({ success: true, data: telegramData, message_id: telegramData.result?.message_id }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error: any) {
    console.error('Error sending to Telegram:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
