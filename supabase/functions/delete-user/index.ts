import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.81.1'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

async function sendTelegramNotification(botToken: string, chatId: string, message: string) {
  try {
    const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: message,
        parse_mode: 'HTML',
      }),
    });
    const result = await response.json();
    console.log('Telegram notification result:', result);
    return result;
  } catch (error) {
    console.error('Error sending Telegram notification:', error);
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const BOT_TOKEN = Deno.env.get('TELEGRAM_BOT_TOKEN')
    const ADMIN_CHAT_ID = Deno.env.get('ADMIN_TELEGRAM_CHAT_ID')

    // Verify the user making the request is an admin or rop
    const authHeader = req.headers.get('Authorization')!
    const token = authHeader.replace('Bearer ', '')
    const { data: { user } } = await supabaseClient.auth.getUser(token)

    if (!user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 401,
      })
    }

    // Check if user is admin or rop
    const { data: roleData } = await supabaseClient
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .in('role', ['admin', 'rop'])
      .maybeSingle()

    if (!roleData) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 403,
      })
    }

    // Get current user's name for notification
    const { data: currentUserProfile } = await supabaseClient
      .from('profiles')
      .select('full_name')
      .eq('id', user.id)
      .maybeSingle()

    // Get user ID to delete from request body
    const { user_id } = await req.json()

    if (!user_id) {
      return new Response(JSON.stringify({ error: 'User ID is required' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      })
    }

    // Get profile of user being deleted (before deletion)
    const { data: deletedUserProfile } = await supabaseClient
      .from('profiles')
      .select('full_name, phone, telegram_user_id')
      .eq('id', user_id)
      .maybeSingle()

    const deletedUserName = deletedUserProfile?.full_name || 'Noma\'lum'
    const deletedUserPhone = deletedUserProfile?.phone || '-'
    const deletedUserTelegramId = deletedUserProfile?.telegram_user_id

    // Delete the user using admin privileges
    const { error: deleteError } = await supabaseClient.auth.admin.deleteUser(user_id)

    if (deleteError) {
      console.error('Error deleting user:', deleteError)
      return new Response(JSON.stringify({ error: deleteError.message }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      })
    }

    // Send notification to admin Telegram chat
    if (BOT_TOKEN && ADMIN_CHAT_ID) {
      const adminName = currentUserProfile?.full_name || 'Admin'
      const now = new Date()
      const uzbekTime = now.toLocaleString('uz-UZ', { timeZone: 'Asia/Tashkent' })

      const notificationMessage = `🗑️ <b>Sotuvchi o'chirildi!</b>\n\n` +
        `👤 <b>Sotuvchi:</b> ${deletedUserName}\n` +
        `📞 <b>Telefon:</b> ${deletedUserPhone}\n` +
        `${deletedUserTelegramId ? `📱 <b>Telegram ID:</b> ${deletedUserTelegramId}\n` : ''}` +
        `━━━━━━━━━━━━━━━━━━━━\n` +
        `👮 <b>O'chirgan:</b> ${adminName}\n` +
        `🕐 <b>Vaqt:</b> ${uzbekTime}`

      await sendTelegramNotification(BOT_TOKEN, ADMIN_CHAT_ID, notificationMessage)
    }

    return new Response(JSON.stringify({ success: true, deletedUserName }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'An error occurred'
    console.error('Error in delete-user function:', errorMessage)
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    })
  }
})
