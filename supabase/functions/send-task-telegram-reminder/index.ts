import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
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
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const TELEGRAM_BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN");
    const TELEGRAM_CHAT_ID = Deno.env.get("TELEGRAM_CHAT_ID");
    const TELEGRAM_TOPIC_ID = Deno.env.get("TELEGRAM_TOPIC_ID");

    if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
      throw new Error("Telegram credentials not configured");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { task_id, task_title, task_description, due_date, seller_id, customer_name }: TaskReminderData = await req.json();

    console.log("Sending task reminder for:", task_id, task_title);

    // Get seller info
    const { data: sellerData } = await supabase
      .from("profiles")
      .select("full_name, phone")
      .eq("id", seller_id)
      .single();

    const sellerName = sellerData?.full_name || "Noma'lum";
    const dueDateTime = new Date(due_date);
    const formattedDate = dueDateTime.toLocaleDateString("uz-UZ", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    });

    // Format Telegram message
    let message = `🔔 <b>TASK ESLATMASI</b>\n\n`;
    message += `👤 <b>Xodim:</b> ${sellerName}\n`;
    message += `📋 <b>Vazifa:</b> ${task_title}\n`;
    
    if (task_description) {
      message += `📝 <b>Tavsif:</b> ${task_description}\n`;
    }
    
    if (customer_name) {
      message += `👥 <b>Mijoz:</b> ${customer_name}\n`;
    }
    
    message += `⏰ <b>Muddat:</b> ${formattedDate}\n\n`;
    message += `⚠️ <i>Siz bu mijozga aloqaga chiqishingiz kerak!</i>`;

    // Build Telegram API URL
    const telegramUrl = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
    
    const body: any = {
      chat_id: TELEGRAM_CHAT_ID,
      text: message,
      parse_mode: "HTML",
    };

    if (TELEGRAM_TOPIC_ID) {
      body.message_thread_id = parseInt(TELEGRAM_TOPIC_ID);
    }

    const telegramResponse = await fetch(telegramUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    const telegramResult = await telegramResponse.json();

    if (!telegramResult.ok) {
      console.error("Telegram API error:", telegramResult);
      throw new Error(`Telegram error: ${telegramResult.description}`);
    }

    console.log("Task reminder sent successfully");

    return new Response(
      JSON.stringify({ success: true, message_id: telegramResult.result?.message_id }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error: any) {
    console.error("Error sending task reminder:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
});
