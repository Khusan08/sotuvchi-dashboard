import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface TaskReminderData {
  task_id: string;
  task_title: string;
  task_description?: string;
  due_date: string;
  seller_id: string;
  customer_name?: string;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { task }: { task: TaskReminderData } = await req.json();
    console.log('Received task reminder request:', task);

    const BOT_TOKEN = Deno.env.get('TELEGRAM_BOT_TOKEN');
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    if (!BOT_TOKEN) {
      throw new Error('TELEGRAM_BOT_TOKEN not configured');
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get seller's profile with telegram_user_id
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('full_name, telegram_user_id')
      .eq('id', task.seller_id)
      .single();

    if (profileError) {
      console.error('Error fetching profile:', profileError);
      throw new Error('Failed to fetch seller profile');
    }

    if (!profile?.telegram_user_id) {
      console.log('No telegram_user_id found for seller:', task.seller_id);
      return new Response(
        JSON.stringify({ success: false, error: 'Seller has no telegram_user_id configured' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    const dueDate = new Date(task.due_date).toLocaleString('uz-UZ', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'Asia/Tashkent'
    });

    const message = `
⏰ <b>Vazifa eslatmasi!</b>

👤 <b>Xodim:</b> ${profile.full_name}
📋 <b>Vazifa:</b> ${task.task_title}
${task.customer_name ? `👥 <b>Mijoz:</b> ${task.customer_name}` : ''}
${task.task_description ? `📝 <b>Tavsif:</b> ${task.task_description}` : ''}
📅 <b>Muddat:</b> ${dueDate}

⚠️ Mijoz bilan bog'lanishingiz kerak!
    `.trim();

    console.log('Sending personal message to:', profile.telegram_user_id);

    // Send personal message to seller's Telegram
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
    console.log('Telegram response:', telegramData);

    if (!telegramResponse.ok) {
      throw new Error(`Telegram API error: ${JSON.stringify(telegramData)}`);
    }

    return new Response(
      JSON.stringify({ success: true, data: telegramData }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );
  } catch (error: any) {
    console.error('Error sending task reminder:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
