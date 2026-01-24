import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Using 'any' types since Supabase returns dynamic data
// The actual response shape may differ from static typing

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const url = new URL(req.url);
    const type = url.searchParams.get('type') || 'orders';
    const since = url.searchParams.get('since'); // ISO date string for incremental sync
    const limit = parseInt(url.searchParams.get('limit') || '1000');

    console.log(`Sheets sync webhook called: type=${type}, since=${since}, limit=${limit}`);

    if (type === 'orders') {
      // Fetch orders with items and seller info
      let query = supabase
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
          updated_at,
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
        .limit(limit);

      if (since) {
        query = query.gte('updated_at', since);
      }

      const { data: orders, error } = await query;

      if (error) {
        console.error('Error fetching orders:', error);
        throw error;
      }

      // Format orders for Google Sheets
      const formattedOrders = (orders || []).map((order: any) => {
        const items = order.order_items || [];
        const products = items
          .map((item: any) => `${item.product_name} (${item.quantity}x${item.price?.toLocaleString() || 0})`)
          .join(', ');

        const remainingPayment = (order.total_amount || 0) - (order.advance_payment || 0);
        const sellerName = order.profiles?.full_name || 'Noma\'lum';

        return {
          id: order.id,
          order_number: order.order_number,
          customer_name: order.customer_name,
          customer_phone: order.customer_phone || '',
          customer_phone2: order.customer_phone2 || '',
          address: `${order.region || ''}, ${order.district || ''}`.replace(/^, |, $/, ''),
          products: products,
          total_amount: order.total_amount || 0,
          advance_payment: order.advance_payment || 0,
          remaining_payment: remainingPayment,
          notes: order.notes || '',
          seller_name: sellerName,
          status: order.status,
          created_at: order.created_at,
          updated_at: order.updated_at,
        };
      });

      return new Response(
        JSON.stringify({ 
          success: true, 
          type: 'orders',
          count: formattedOrders.length,
          data: formattedOrders 
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      );
    } else if (type === 'leads') {
      // Fetch leads with seller info
      let query = supabase
        .from('leads')
        .select(`
          id,
          customer_name,
          customer_phone,
          customer_email,
          lead_type,
          source,
          stage,
          status,
          notes,
          activity,
          action_status,
          delivery_status,
          price,
          created_at,
          updated_at,
          seller_id,
          profiles:seller_id (
            full_name
          ),
          stages:stage (
            name
          )
        `)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (since) {
        query = query.gte('updated_at', since);
      }

      const { data: leads, error } = await query;

      if (error) {
        console.error('Error fetching leads:', error);
        throw error;
      }

      // Format leads for Google Sheets
      const formattedLeads = (leads || []).map((lead: any) => ({
        id: lead.id,
        customer_name: lead.customer_name,
        customer_phone: lead.customer_phone || '',
        customer_email: lead.customer_email || '',
        lead_type: lead.lead_type || '',
        source: lead.source || '',
        stage_name: lead.stages?.name || '',
        status: lead.status,
        notes: lead.notes || '',
        activity: lead.activity || '',
        action_status: lead.action_status || '',
        delivery_status: lead.delivery_status || '',
        price: lead.price || 0,
        seller_name: lead.profiles?.full_name || 'Belgilanmagan',
        created_at: lead.created_at,
        updated_at: lead.updated_at,
      }));

      return new Response(
        JSON.stringify({ 
          success: true, 
          type: 'leads',
          count: formattedLeads.length,
          data: formattedLeads 
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      );
    } else {
      throw new Error('Invalid type. Use "orders" or "leads"');
    }
  } catch (error: any) {
    console.error('Error in sheets sync webhook:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
