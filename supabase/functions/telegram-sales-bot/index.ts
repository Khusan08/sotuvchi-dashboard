import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const BOT_TOKEN = Deno.env.get('TELEGRAM_BOT_TOKEN');
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    if (!BOT_TOKEN) {
      throw new Error('TELEGRAM_BOT_TOKEN not configured');
    }

    const supabase = createClient(supabaseUrl, supabaseKey);
    const body = await req.json();

    console.log('Received request:', JSON.stringify(body));

    // Handle Telegram webhook callback
    if (body.callback_query) {
      const callbackQuery = body.callback_query;
      const chatId = callbackQuery.message.chat.id;
      const data = callbackQuery.data;

      console.log(`Callback received: ${data} from chat ${chatId}`);

      // Answer the callback to remove loading state
      await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/answerCallbackQuery`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ callback_query_id: callbackQuery.id }),
      });

      let reportMessage = '';
      
      if (data === 'daily_report') {
        reportMessage = await generateReport(supabase, 'daily');
      } else if (data === 'monthly_report') {
        reportMessage = await generateReport(supabase, 'monthly');
      } else if (data.startsWith('custom_')) {
        // Handle custom date selection
        const dateStr = data.replace('custom_', '');
        reportMessage = await generateReport(supabase, 'custom', dateStr);
      } else if (data === 'pick_date') {
        // Show date picker buttons (last 31 days)
        const dateButtons = [];
        const now = new Date();
        for (let i = 0; i < 31; i++) {
          const date = new Date(now);
          date.setDate(date.getDate() - i);
          const dateStr = date.toISOString().split('T')[0];
          const dayName = date.toLocaleDateString('uz-UZ', { weekday: 'short', day: 'numeric', month: 'short' });
          dateButtons.push([{ text: dayName, callback_data: `custom_${dateStr}` }]);
        }
        dateButtons.push([{ text: '⬅️ Orqaga', callback_data: 'main_menu' }]);

        await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/editMessageText`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: chatId,
            message_id: callbackQuery.message.message_id,
            text: '📅 <b>Kunni tanlang:</b>',
            parse_mode: 'HTML',
            reply_markup: { inline_keyboard: dateButtons },
          }),
        });
        
        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      } else if (data === 'main_menu') {
        // Show main menu
        await sendMainMenu(BOT_TOKEN, chatId, callbackQuery.message.message_id);
        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      if (reportMessage) {
        // Edit the message with report
        await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/editMessageText`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: chatId,
            message_id: callbackQuery.message.message_id,
            text: reportMessage,
            parse_mode: 'HTML',
            reply_markup: {
              inline_keyboard: [
                [{ text: '⬅️ Orqaga', callback_data: 'main_menu' }],
              ],
            },
          }),
        });
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Handle /start or /hisobot command
    if (body.message?.text === '/start' || body.message?.text === '/hisobot') {
      const chatId = body.message.chat.id;
      await sendMainMenu(BOT_TOKEN, chatId);
      
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Regular API call for scheduled reports
    if (body.report_type) {
      const reportMessage = await generateReport(supabase, body.report_type);
      
      // Get all admin users with telegram_user_id
      const { data: adminUsers } = await supabase
        .from('user_roles')
        .select('user_id')
        .eq('role', 'admin');

      const adminUserIds = adminUsers?.map(u => u.user_id) || [];
      const { data: adminProfiles } = await supabase
        .from('profiles')
        .select('id, telegram_user_id, full_name')
        .in('id', adminUserIds)
        .not('telegram_user_id', 'is', null);

      if (adminProfiles) {
        for (const admin of adminProfiles) {
          await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chat_id: admin.telegram_user_id,
              text: reportMessage,
              parse_mode: 'HTML',
              reply_markup: {
                inline_keyboard: [
                  [
                    { text: '📊 Kunlik', callback_data: 'daily_report' },
                    { text: '📈 Oylik', callback_data: 'monthly_report' },
                  ],
                  [{ text: '📅 Boshqa kun', callback_data: 'pick_date' }],
                ],
              },
            }),
          });
        }
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ success: true, message: 'No action taken' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    console.error('Error in telegram-sales-bot:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});

async function sendMainMenu(botToken: string, chatId: number, messageId?: number) {
  const menuText = `📊 <b>Savdo Hisoboti</b>\n\nQuyidagi variantlardan birini tanlang:`;
  
  const keyboard = {
    inline_keyboard: [
      [
        { text: '📊 Kunlik hisobot', callback_data: 'daily_report' },
        { text: '📈 Oylik hisobot', callback_data: 'monthly_report' },
      ],
      [{ text: '📅 Boshqa kunni tanlash', callback_data: 'pick_date' }],
    ],
  };

  if (messageId) {
    await fetch(`https://api.telegram.org/bot${botToken}/editMessageText`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        message_id: messageId,
        text: menuText,
        parse_mode: 'HTML',
        reply_markup: keyboard,
      }),
    });
  } else {
    await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: menuText,
        parse_mode: 'HTML',
        reply_markup: keyboard,
      }),
    });
  }
}

async function generateReport(supabase: any, reportType: string, customDate?: string): Promise<string> {
  const now = new Date();
  const uzbekistanTime = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Tashkent' }));
  
  let startDate: Date;
  let endDate: Date;
  let periodName: string;
  
  if (reportType === 'monthly') {
    startDate = new Date(uzbekistanTime.getFullYear(), uzbekistanTime.getMonth(), 1);
    endDate = new Date(uzbekistanTime.getFullYear(), uzbekistanTime.getMonth() + 1, 0, 23, 59, 59);
    periodName = `${uzbekistanTime.toLocaleString('uz-UZ', { month: 'long', year: 'numeric' })} oylik`;
  } else if (reportType === 'custom' && customDate) {
    const selectedDate = new Date(customDate);
    startDate = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate());
    endDate = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate(), 23, 59, 59);
    periodName = selectedDate.toLocaleDateString('uz-UZ', { day: '2-digit', month: '2-digit', year: 'numeric' });
  } else {
    startDate = new Date(uzbekistanTime.getFullYear(), uzbekistanTime.getMonth(), uzbekistanTime.getDate());
    endDate = new Date(uzbekistanTime.getFullYear(), uzbekistanTime.getMonth(), uzbekistanTime.getDate(), 23, 59, 59);
    periodName = uzbekistanTime.toLocaleDateString('uz-UZ', { day: '2-digit', month: '2-digit', year: 'numeric' });
  }

  console.log(`Generating ${reportType} report from ${startDate.toISOString()} to ${endDate.toISOString()}`);

  // Fetch all sellers
  const { data: sellers } = await supabase
    .from('profiles')
    .select('id, full_name')
    .order('full_name');

  // Fetch orders for the period - all statuses for total, completed for stats
  const { data: allOrders } = await supabase
    .from('orders')
    .select('*')
    .gte('created_at', startDate.toISOString())
    .lte('created_at', endDate.toISOString());

  // Fetch sold leads for the period
  const { data: soldLeads } = await supabase
    .from('leads')
    .select(`
      id,
      price,
      seller_id,
      stage,
      stages:stage (name)
    `)
    .gte('updated_at', startDate.toISOString())
    .lte('updated_at', endDate.toISOString());

  // Calculate totals
  let totalSales = 0;
  let totalOrderCount = 0;
  let completedOrderCount = 0;
  let pendingOrderCount = 0;
  let cancelledOrderCount = 0;
  
  const sellerStats: Record<string, { 
    name: string; 
    orderCount: number; 
    completedOrders: number;
    orderTotal: number; 
    soldLeads: number; 
    leadTotal: number 
  }> = {};

  // Initialize seller stats
  sellers?.forEach((seller: any) => {
    sellerStats[seller.id] = {
      name: seller.full_name,
      orderCount: 0,
      completedOrders: 0,
      orderTotal: 0,
      soldLeads: 0,
      leadTotal: 0
    };
  });

  // Calculate order stats per seller
  allOrders?.forEach((order: any) => {
    totalOrderCount++;
    
    if (order.status === 'delivered' || order.status === 'completed') {
      completedOrderCount++;
      totalSales += Number(order.total_amount || 0);
      
      if (sellerStats[order.seller_id]) {
        sellerStats[order.seller_id].completedOrders += 1;
        sellerStats[order.seller_id].orderTotal += Number(order.total_amount || 0);
      }
    } else if (order.status === 'pending') {
      pendingOrderCount++;
    } else if (order.status === 'cancelled') {
      cancelledOrderCount++;
    }
    
    if (sellerStats[order.seller_id]) {
      sellerStats[order.seller_id].orderCount += 1;
    }
  });

  // Calculate sold leads stats per seller
  soldLeads?.forEach((lead: any) => {
    const stageName = (lead.stages as any)?.name;
    if (stageName === 'Sotildi' && lead.price) {
      totalSales += Number(lead.price || 0);
      if (sellerStats[lead.seller_id]) {
        sellerStats[lead.seller_id].soldLeads += 1;
        sellerStats[lead.seller_id].leadTotal += Number(lead.price || 0);
      }
    }
  });

  // Format message
  const formatNumber = (num: number) => num.toLocaleString('uz-UZ');
  
  let message = `📊 <b>${reportType === 'monthly' ? 'OYLIK' : 'KUNLIK'} SAVDO HISOBOTI</b>\n`;
  message += `📅 ${periodName}\n`;
  message += `━━━━━━━━━━━━━━━━━━━━\n\n`;
  
  message += `💰 <b>Jami savdo:</b> ${formatNumber(totalSales)} so'm\n`;
  message += `📦 <b>Jami buyurtmalar:</b> ${totalOrderCount} ta\n`;
  message += `   ✅ Bajarilgan: ${completedOrderCount} ta\n`;
  message += `   ⏳ Jarayonda: ${pendingOrderCount} ta\n`;
  message += `   ❌ Bekor: ${cancelledOrderCount} ta\n\n`;
  
  message += `👥 <b>Hodimlar bo'yicha:</b>\n\n`;

  // Sort sellers by total sales
  const sortedSellers = Object.values(sellerStats)
    .filter(s => s.orderTotal > 0 || s.leadTotal > 0 || s.orderCount > 0)
    .sort((a, b) => (b.orderTotal + b.leadTotal) - (a.orderTotal + a.leadTotal));

  if (sortedSellers.length === 0) {
    message += `<i>Bu davr uchun faoliyat yo'q</i>\n`;
  } else {
    sortedSellers.forEach((seller, index) => {
      const total = seller.orderTotal + seller.leadTotal;
      message += `${index + 1}. <b>${seller.name}</b>\n`;
      message += `   📦 Buyurtmalar: ${seller.orderCount} ta (${seller.completedOrders} bajarilgan)\n`;
      if (seller.soldLeads > 0) {
        message += `   🎯 Sotilgan lidlar: ${seller.soldLeads} ta\n`;
      }
      message += `   💵 Jami savdo: ${formatNumber(total)} so'm\n\n`;
    });
  }

  message += `━━━━━━━━━━━━━━━━━━━━\n`;
  message += `🕐 Hisobot vaqti: ${uzbekistanTime.toLocaleString('uz-UZ')}`;

  return message;
}
