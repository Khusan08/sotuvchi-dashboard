import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Stage IDs where overdue tasks should move leads to "Muhim"
const ELIGIBLE_STAGE_IDS = [
  "10187623-6ecf-47d0-8f99-23a5ff7333b0", // Aniq javob ol
];

const MUHIM_STAGE_ID = "1aa6d478-0e36-4642-b5c5-e2a6b6985c08";

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log('Checking for overdue tasks...');

    // Get all overdue tasks with pending status that have leads
    const { data: overdueTasks, error: tasksError } = await supabase
      .from('tasks')
      .select(`
        id,
        title,
        due_date,
        lead_id,
        status,
        seller_id,
        leads!inner (
          id,
          customer_name,
          stage,
          seller_id
        )
      `)
      .eq('status', 'pending')
      .not('lead_id', 'is', null)
      .lt('due_date', new Date().toISOString());

    if (tasksError) {
      console.error('Error fetching overdue tasks:', tasksError);
      throw tasksError;
    }

    console.log(`Found ${overdueTasks?.length || 0} overdue tasks with leads`);

    const movedLeads: string[] = [];

    for (const task of overdueTasks || []) {
      const lead = task.leads as any;
      
      // Check if lead is in eligible stage (Aniq javob ol)
      if (ELIGIBLE_STAGE_IDS.includes(lead.stage)) {
        console.log(`Moving lead "${lead.customer_name}" from stage ${lead.stage} to Muhim`);
        
        // Move lead to "Muhim" stage
        const { error: updateError } = await supabase
          .from('leads')
          .update({ stage: MUHIM_STAGE_ID })
          .eq('id', lead.id);

        if (updateError) {
          console.error(`Error updating lead ${lead.id}:`, updateError);
        } else {
          movedLeads.push(lead.customer_name);
          
          // Add a comment about the automatic move
          await supabase
            .from('lead_comments')
            .insert({
              lead_id: lead.id,
              user_id: task.seller_id || lead.seller_id,
              comment: `Vazifa muddati tugadi ("${task.title}"). Lid avtomatik ravishda "Muhim" bosqichiga o'tkazildi.`
            });
        }
      }
    }

    console.log(`Moved ${movedLeads.length} leads to Muhim stage`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        movedLeads: movedLeads.length,
        leads: movedLeads 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );
  } catch (error: any) {
    console.error('Error checking overdue tasks:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});