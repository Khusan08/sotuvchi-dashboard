import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  console.log('My Zvonki webhook called:', req.method);

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method === 'POST' || req.method === 'GET') {
    try {
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
      const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
      const supabase = createClient(supabaseUrl, supabaseKey);

      let callData: any = {};

      // My Zvonki can send data via GET params or POST body
      if (req.method === 'GET') {
        const url = new URL(req.url);
        callData = {
          phone: url.searchParams.get('caller_id') || url.searchParams.get('phone') || url.searchParams.get('from'),
          caller_name: url.searchParams.get('caller_name') || url.searchParams.get('name'),
          call_id: url.searchParams.get('call_id') || url.searchParams.get('id'),
          call_type: url.searchParams.get('call_type') || url.searchParams.get('type'),
          duration: url.searchParams.get('duration'),
          status: url.searchParams.get('status'),
          campaign: url.searchParams.get('campaign') || url.searchParams.get('utm_campaign'),
          source: url.searchParams.get('source') || url.searchParams.get('utm_source'),
        };
      } else {
        const body = await req.json();
        console.log('Received My Zvonki webhook data:', JSON.stringify(body, null, 2));
        
        // Parse event type from My Zvonki
        const eventType = body.event || body.action || body.type;
        
        callData = {
          phone: body.caller_id || body.phone || body.from || body.ani,
          caller_name: body.caller_name || body.name || '',
          call_id: body.call_id || body.id || body.uuid,
          call_type: body.call_type || body.type || body.direction,
          duration: body.duration || body.talk_time || body.billsec || 0,
          status: body.status || body.call_status || body.disposition,
          campaign: body.campaign || body.utm_campaign,
          source: body.source || body.utm_source,
          event: eventType,
        };
        
        // Determine call status based on event and disposition
        if (eventType === 'call.finish' || eventType === 'call_finish') {
          const disposition = (body.disposition || body.status || '').toLowerCase();
          if (disposition.includes('answer') || disposition === 'answered' || body.billsec > 0) {
            callData.call_status = 'answered';
          } else if (disposition.includes('busy')) {
            callData.call_status = 'busy';
          } else if (disposition.includes('no_answer') || disposition === 'noanswer') {
            callData.call_status = 'no_answer';
          } else if (disposition.includes('cancel') || disposition.includes('reject')) {
            callData.call_status = 'missed';
          } else {
            callData.call_status = 'missed';
          }
        } else if (eventType === 'call.start' || eventType === 'call_start') {
          callData.call_status = 'ringing';
        } else if (eventType === 'call.answer' || eventType === 'call_answer') {
          callData.call_status = 'in_progress';
        }
      }

      console.log('Parsed call data:', callData);

      // Skip if no phone number
      if (!callData.phone) {
        console.log('No phone number in webhook data');
        return new Response(
          JSON.stringify({ success: true, message: 'No phone number provided' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
        );
      }

      // Clean phone number
      const cleanPhone = callData.phone.replace(/\D/g, '');

      // Check if lead with this phone already exists
      const { data: existingLead } = await supabase
        .from('leads')
        .select('id, call_status')
        .or(`customer_phone.eq.${callData.phone},customer_phone.eq.+${cleanPhone},customer_phone.eq.${cleanPhone}`)
        .limit(1);

      if (existingLead && existingLead.length > 0) {
        // Update existing lead with call status if it's a call.finish event
        if (callData.call_status && callData.event === 'call.finish') {
          await supabase
            .from('leads')
            .update({
              call_status: callData.call_status,
              call_duration: parseInt(callData.duration) || 0,
              call_id: callData.call_id,
              updated_at: new Date().toISOString()
            })
            .eq('id', existingLead[0].id);
          console.log('Updated existing lead call status:', callData.call_status);
        }
        return new Response(
          JSON.stringify({ success: true, message: 'Lead updated with call status' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
        );
      }

      // Assign to first available admin/rop user
      const { data: adminUsers, error: adminError } = await supabase
        .from('user_roles')
        .select('user_id')
        .in('role', ['admin', 'rop'])
        .limit(1);

      if (adminError || !adminUsers || adminUsers.length === 0) {
        console.error('No admin or ROP users found');
        throw new Error('No admin or ROP users found to assign the lead');
      }

      // Create new lead with call status
      const newLead = {
        customer_name: callData.caller_name || `Qo'ng'iroq: ${callData.phone}`,
        customer_phone: callData.phone,
        lead_type: 'Yangi lid',
        activity: 'new',
        source: callData.source || 'My Zvonki',
        notes: callData.campaign ? `Kampaniya: ${callData.campaign}` : null,
        status: 'new',
        seller_id: adminUsers[0].user_id,
        call_status: callData.call_status || 'ringing',
        call_duration: parseInt(callData.duration) || 0,
        call_id: callData.call_id,
      };

      console.log('Inserting lead:', newLead);

      const { data: insertedLead, error: insertError } = await supabase
        .from('leads')
        .insert(newLead)
        .select()
        .single();

      if (insertError) {
        console.error('Error inserting lead:', insertError);
        throw insertError;
      }

      console.log('Lead successfully created:', insertedLead);

      // Send Telegram notification to all admins
      const BOT_TOKEN = Deno.env.get('TELEGRAM_BOT_TOKEN');
      if (BOT_TOKEN) {
        const { data: adminProfiles } = await supabase
          .from('profiles')
          .select('id, telegram_user_id, full_name')
          .in('id', adminUsers.map((u: any) => u.user_id))
          .not('telegram_user_id', 'is', null);

        if (adminProfiles && adminProfiles.length > 0) {
          const message = `📞 <b>Yangi qo'ng'iroq!</b>\n\n` +
            `👤 <b>Ism:</b> ${newLead.customer_name}\n` +
            `📞 <b>Telefon:</b> ${newLead.customer_phone}\n` +
            `📍 <b>Manba:</b> ${newLead.source}\n` +
            `⏱ <b>Davomiyligi:</b> ${callData.duration || 'N/A'} sek\n` +
            `━━━━━━━━━━━━━━━━━━━━\n` +
            `🕐 ${new Date().toLocaleString('uz-UZ', { timeZone: 'Asia/Tashkent' })}`;

          for (const admin of adminProfiles) {
            try {
              await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  chat_id: admin.telegram_user_id,
                  text: message,
                  parse_mode: 'HTML',
                }),
              });
              console.log(`Notification sent to ${admin.full_name}`);
            } catch (telegramError) {
              console.error(`Failed to send notification to ${admin.full_name}:`, telegramError);
            }
          }
        }
      }

      return new Response(
        JSON.stringify({ success: true, lead_id: insertedLead.id }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    } catch (error) {
      console.error('Error processing webhook:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      return new Response(
        JSON.stringify({ success: false, error: errorMessage }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }
  }

  return new Response('Method not allowed', { status: 405 });
});
