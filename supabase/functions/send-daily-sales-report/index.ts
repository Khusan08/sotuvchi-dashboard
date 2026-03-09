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

    // Fetch ALL profiles with telegram_user_id (not just admins)
    const { data: allProfiles, error: profilesError } = await supabase
      .from('profiles')
      .select('id, telegram_user_id, full_name')
      .not('telegram_user_id', 'is', null);

    if (profilesError) throw profilesError;

    if (!allProfiles || allProfiles.length === 0) {
      console.log('No users with Telegram ID configured');
      return new Response(
        JSON.stringify({ success: true, message: 'No users with Telegram ID' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    console.log(`Found ${allProfiles.length} user(s) with Telegram ID`);

    // Get request body to check report type
    let reportType = 'daily';
    try {
      const body = await req.json();
      reportType = body.report_type || 'daily';
    } catch {
      // Default to daily if no body
    }

    const now = new Date();
    const uzbekistanTime = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Tashkent' }));
    
    let startDate: Date;
    let periodName: string;
    
    if (reportType === 'monthly') {
      startDate = new Date(uzbekistanTime.getFullYear(), uzbekistanTime.getMonth(), 1);
      periodName = `${uzbekistanTime.toLocaleString('uz-UZ', { month: 'long', year: 'numeric' })} oylik`;
    } else {
      startDate = new Date(uzbekistanTime.getFullYear(), uzbekistanTime.getMonth(), uzbekistanTime.getDate());
      periodName = uzbekistanTime.toLocaleDateString('uz-UZ', { day: '2-digit', month: '2-digit', year: 'numeric' });
    }

    console.log(`Generating ${reportType} report from ${startDate.toISOString()}`);

    // Fetch all sellers
    const { data: sellers, error: sellersError } = await supabase
      .from('profiles')
      .select('id, full_name')
      .order('full_name');

    if (sellersError) throw sellersError;

    // Fetch orders for the period
    const { data: orders, error: ordersError } = await supabase
      .from('orders')
      .select('*')
      .gte('created_at', startDate.toISOString())
      .eq('status', 'completed');

    if (ordersError) throw ordersError;

    // Fetch sold leads for the period
    const { data: soldLeads, error: leadsError } = await supabase
      .from('leads')
      .select(`
        id,
        price,
        seller_id,
        stage,
        stages:stage (name)
      `)
      .gte('updated_at', startDate.toISOString());

    if (leadsError) throw leadsError;

    // Calculate totals
    let totalSales = 0;
    const sellerStats: Record<string, { name: string; orderCount: number; orderTotal: number; soldLeads: number; leadTotal: number }> = {};

    sellers?.forEach(seller => {
      sellerStats[seller.id] = {
        name: seller.full_name,
        orderCount: 0,
        orderTotal: 0,
        soldLeads: 0,
        leadTotal: 0
      };
    });

    orders?.forEach(order => {
      totalSales += Number(order.total_amount || 0);
      if (sellerStats[order.seller_id]) {
        sellerStats[order.seller_id].orderCount += 1;
        sellerStats[order.seller_id].orderTotal += Number(order.total_amount || 0);
      }
    });

    soldLeads?.forEach(lead => {
      const stageName = (lead.stages as any)?.name;
      if (stageName === 'Sotildi' && lead.price) {
        totalSales += Number(lead.price || 0);
        if (sellerStats[lead.seller_id]) {
          sellerStats[lead.seller_id].soldLeads += 1;
          sellerStats[lead.seller_id].leadTotal += Number(lead.price || 0);
        }
      }
    });

    const formatNumber = (num: number) => num.toLocaleString('uz-UZ');
    
    let message = `📊 <b>${reportType === 'monthly' ? 'OYLIK' : 'KUNLIK'} SAVDO HISOBOTI</b>\n`;
    message += `📅 ${periodName}\n`;
    message += `━━━━━━━━━━━━━━━━━━━━\n\n`;
    message += `💰 <b>Jami savdo:</b> ${formatNumber(totalSales)} so'm\n\n`;
    message += `👥 <b>Sotuvchilar bo'yicha:</b>\n\n`;

    const sortedSellers = Object.values(sellerStats)
      .filter(s => s.orderTotal > 0 || s.leadTotal > 0)
      .sort((a, b) => (b.orderTotal + b.leadTotal) - (a.orderTotal + a.leadTotal));

    if (sortedSellers.length === 0) {
      message += `<i>Bu davr uchun savdo yo'q</i>\n`;
    } else {
      sortedSellers.forEach((seller, index) => {
        const total = seller.orderTotal + seller.leadTotal;
        message += `${index + 1}. <b>${seller.name}</b>\n`;
        if (seller.orderCount > 0) {
          message += `   📦 Buyurtmalar: ${seller.orderCount} ta (${formatNumber(seller.orderTotal)} so'm)\n`;
        }
        if (seller.soldLeads > 0) {
          message += `   🎯 Sotilgan lidlar: ${seller.soldLeads} ta (${formatNumber(seller.leadTotal)} so'm)\n`;
        }
        message += `   💵 Jami: ${formatNumber(total)} so'm\n\n`;
      });
    }

    message += `━━━━━━━━━━━━━━━━━━━━\n`;
    message += `🕐 Hisobot vaqti: ${uzbekistanTime.toLocaleString('uz-UZ')}`;

    // Send to ALL users with telegram_user_id
    const results = [];
    for (const profile of allProfiles) {
      console.log(`Sending report to: ${profile.full_name} (${profile.telegram_user_id})`);
      
      try {
        const telegramResponse = await fetch(
          `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chat_id: profile.telegram_user_id,
              text: message,
              parse_mode: 'HTML',
            }),
          }
        );

        const telegramData = await telegramResponse.json();
        console.log(`Telegram response for ${profile.full_name}:`, telegramData);
        
        results.push({
          user: profile.full_name,
          success: telegramResponse.ok,
          data: telegramData
        });
      } catch (err: any) {
        console.error(`Error sending to ${profile.full_name}:`, err);
        results.push({
          user: profile.full_name,
          success: false,
          error: err.message
        });
      }
    }

    return new Response(
      JSON.stringify({ success: true, results }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );
  } catch (error: any) {
    console.error('Error sending daily sales report:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
