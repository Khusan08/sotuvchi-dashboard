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

type TelegramSendMessageResponse =
  | { ok: true; result: { message_id: number } & Record<string, unknown> }
  | { ok: false; error_code?: number; description?: string };

const normalizeChatId = (value: string | undefined | null) => (value ?? '').trim();

const getAltChatId = (chatId: string) => {
  const trimmed = chatId.trim();
  if (!trimmed) return null;
  // If it looks like a plain group id, try supergroup id and vice versa.
  if (trimmed.startsWith('-100')) {
    const rest = trimmed.slice(4);
    if (!rest) return null;
    return `-${rest}`;
  }
  if (trimmed.startsWith('-')) {
    const rest = trimmed.slice(1);
    if (!rest) return null;
    return `-100${rest}`;
  }
  return null;
};

const sendTelegramMessage = async (args: {
  botToken: string;
  chatId: string;
  text: string;
  parseMode?: 'HTML' | 'MarkdownV2';
  messageThreadId?: number;
}) => {
  const payload: Record<string, unknown> = {
    chat_id: args.chatId,
    text: args.text,
    parse_mode: args.parseMode ?? 'HTML',
  };

  if (typeof args.messageThreadId === 'number') {
    payload.message_thread_id = args.messageThreadId;
  }

  const res = await fetch(`https://api.telegram.org/bot${args.botToken}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  const data = (await res.json()) as TelegramSendMessageResponse;
  return { res, data };
};

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

const formatAdminSalesMessage = (order: OrderData, dailySales: { total: number; bySeller: Record<string, number> }) => {
  const now = new Date();
  const dateStr = now.toLocaleDateString('uz-UZ', { timeZone: 'Asia/Tashkent' });
  
  let sellersList = Object.entries(dailySales.bySeller)
    .sort((a, b) => b[1] - a[1])
    .map(([name, amount]) => `   • ${name}: ${amount.toLocaleString()} so'm`)
    .join('\n');

  return `
🔔 <b>Yangi zakaz!</b>

💰 <b>Summa:</b> ${order.total_amount.toLocaleString()} so'm
👨‍💼 <b>Sotuvchi:</b> ${order.seller_name}
👤 <b>Mijoz:</b> ${order.customer_name}

━━━━━━━━━━━━━━━━━━━━
📊 <b>Bugungi (${dateStr}) savdo:</b>

💵 <b>Jami:</b> ${dailySales.total.toLocaleString()} so'm

👥 <b>Hodimlar bo'yicha:</b>
${sellersList || '   Hali savdo yo\'q'}
━━━━━━━━━━━━━━━━━━━━
  `.trim();
};

const formatStatusChangeMessage = (
  orderNumber: number, 
  customerName: string, 
  newStatus: string,
  sellerName: string
) => {
  const statusEmoji = newStatus === 'delivered' ? '✅' : '❌';
  const statusText = newStatus === 'delivered' ? 'Tasdiqlandi' : 'Bekor qilindi';
  
  const now = new Date();
  const dateTime = now.toLocaleString('uz-UZ', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Tashkent'
  });

  return `
${statusEmoji} <b>Zakaz statusi o'zgardi!</b>

📋 <b>Zakaz raqami:</b> #${orderNumber}
👤 <b>Mijoz:</b> ${customerName}
${statusEmoji} <b>Yangi status:</b> ${statusText}

📅 <b>O'zgargan vaqt:</b> ${dateTime}
  `.trim();
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { order, action = 'create', statusChange }: { 
      order?: OrderData; 
      action?: 'create' | 'edit' | 'status_change';
      statusChange?: {
        order_number: number;
        customer_name: string;
        new_status: string;
        seller_id: string;
        seller_name: string;
      };
    } = await req.json();

    const BOT_TOKEN = normalizeChatId(Deno.env.get('TELEGRAM_BOT_TOKEN'));
    const CHAT_ID = normalizeChatId(Deno.env.get('TELEGRAM_CHAT_ID'));
    const CHAT_ID_2 = normalizeChatId(Deno.env.get('TELEGRAM_CHAT_ID_2'));
    const TOPIC_ID = normalizeChatId(Deno.env.get('TELEGRAM_TOPIC_ID'));
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    if (!BOT_TOKEN || !CHAT_ID || !TOPIC_ID) {
      throw new Error('Telegram credentials not configured');
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Handle status change notification to seller
    if (action === 'status_change' && statusChange) {
      console.log('Sending status change notification to seller:', statusChange);

      // Get seller's telegram_user_id
      const { data: sellerProfile, error: sellerError } = await supabase
        .from('profiles')
        .select('telegram_user_id, full_name')
        .eq('id', statusChange.seller_id)
        .single();

      if (sellerError) {
        console.error('Error fetching seller profile:', sellerError);
      }

      if (sellerProfile?.telegram_user_id) {
        const statusMessage = formatStatusChangeMessage(
          statusChange.order_number,
          statusChange.customer_name,
          statusChange.new_status,
          statusChange.seller_name
        );

        const { data: sellerData } = await sendTelegramMessage({
          botToken: BOT_TOKEN,
          chatId: String(sellerProfile.telegram_user_id).trim(),
          text: statusMessage,
          parseMode: 'HTML',
        });
        console.log('Seller status notification response:', sellerData);

        return new Response(
          JSON.stringify({ success: true, data: sellerData }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
          }
        );
      } else {
        console.log('Seller has no Telegram ID configured');
        return new Response(
          JSON.stringify({ success: true, message: 'Seller has no Telegram ID' }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
          }
        );
      }
    }

    // Regular order message flow
    if (!order) {
      throw new Error('Order data is required');
    }

    const message = formatMessage(order, action === 'edit');

    console.log('Sending message to Telegram topic:', { CHAT_ID, CHAT_ID_2, TOPIC_ID, action });

    // Send message to Telegram topic (primary group)
    const { res: telegramResponse, data: telegramData } = await sendTelegramMessage({
      botToken: BOT_TOKEN,
      chatId: CHAT_ID,
      messageThreadId: parseInt(TOPIC_ID),
      text: message,
      parseMode: 'HTML',
    });
    console.log('Telegram topic response:', telegramData);

    if (!telegramResponse.ok || !telegramData.ok) {
      throw new Error(`Telegram API error: ${JSON.stringify(telegramData)}`);
    }

    const telegramMessageId = telegramData.result?.message_id;

    // Send message to second Telegram group (without topic)
    if (CHAT_ID_2) {
      console.log('Sending message to second Telegram group:', CHAT_ID_2);
      try {
        const attempt1 = await sendTelegramMessage({
          botToken: BOT_TOKEN,
          chatId: CHAT_ID_2,
          text: message,
          parseMode: 'HTML',
        });
        console.log('Second Telegram group response:', attempt1.data);

        const attempt1FailedChatNotFound =
          !attempt1.data.ok &&
          typeof attempt1.data.description === 'string' &&
          attempt1.data.description.toLowerCase().includes('chat not found');

        if (attempt1FailedChatNotFound) {
          const alt = getAltChatId(CHAT_ID_2);
          if (alt && alt !== CHAT_ID_2) {
            console.log('Retrying second Telegram group with alternative chat id:', alt);
            const attempt2 = await sendTelegramMessage({
              botToken: BOT_TOKEN,
              chatId: alt,
              text: message,
              parseMode: 'HTML',
            });
            console.log('Second Telegram group response (alt):', attempt2.data);
          }
        }
      } catch (err) {
        console.error('Error sending to second Telegram group:', err);
      }
    }

    // Save message_id to orders table if order_id provided
    if (order.order_id && telegramMessageId) {
      await supabase
        .from('orders')
        .update({ telegram_message_id: telegramMessageId })
        .eq('id', order.order_id);
    }

    // Send personal notification to all admins when a new order is created
    if (action === 'create') {
      console.log('Sending personal notifications to admins...');

      // Get today's sales data
      const today = new Date();
      const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
      startOfDay.setHours(0, 0, 0, 0);
      
      const { data: todayOrders, error: ordersError } = await supabase
        .from('orders')
        .select(`
          total_amount,
          seller_id,
          profiles:seller_id (full_name)
        `)
        .gte('created_at', startOfDay.toISOString())
        .neq('status', 'cancelled');

      if (ordersError) {
        console.error('Error fetching today orders:', ordersError);
      }

      // Calculate daily sales
      const dailySales = {
        total: 0,
        bySeller: {} as Record<string, number>
      };

      if (todayOrders) {
        for (const o of todayOrders) {
          dailySales.total += o.total_amount || 0;
          const sellerName = (o.profiles as any)?.full_name || 'Noma\'lum';
          dailySales.bySeller[sellerName] = (dailySales.bySeller[sellerName] || 0) + (o.total_amount || 0);
        }
      }

      // Fetch all admin users with telegram_user_id
      const { data: adminUsers, error: adminError } = await supabase
        .from('user_roles')
        .select('user_id')
        .eq('role', 'admin');

      if (adminError) {
        console.error('Error fetching admin users:', adminError);
      }

      if (adminUsers && adminUsers.length > 0) {
        const adminUserIds = adminUsers.map(u => u.user_id);
        const { data: adminProfiles, error: profilesError } = await supabase
          .from('profiles')
          .select('id, telegram_user_id, full_name')
          .in('id', adminUserIds)
          .not('telegram_user_id', 'is', null);

        if (profilesError) {
          console.error('Error fetching admin profiles:', profilesError);
        }

        if (adminProfiles && adminProfiles.length > 0) {
          const adminMessage = formatAdminSalesMessage(order, dailySales);

          for (const admin of adminProfiles) {
            console.log(`Sending notification to admin: ${admin.full_name} (${admin.telegram_user_id})`);
            
            try {
              const { data: adminData } = await sendTelegramMessage({
                botToken: BOT_TOKEN,
                chatId: String(admin.telegram_user_id).trim(),
                text: adminMessage,
                parseMode: 'HTML',
              });
              console.log(`Admin notification response for ${admin.full_name}:`, adminData);
            } catch (err) {
              console.error(`Error sending to admin ${admin.full_name}:`, err);
            }
          }
        } else {
          console.log('No admin users with Telegram ID configured');
        }
      }
    }

    return new Response(
      JSON.stringify({ success: true, data: telegramData, message_id: telegramMessageId }),
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
