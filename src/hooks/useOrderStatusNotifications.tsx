import { useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface OrderPayload {
  new: {
    id: string;
    order_number: number;
    customer_name: string;
    status: string;
    seller_id: string;
  };
  old: {
    id: string;
    status: string;
    seller_id: string;
  };
}

export const useOrderStatusNotifications = () => {
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  useEffect(() => {
    const setupSubscription = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Subscribe to order changes for the current user
      channelRef.current = supabase
        .channel('order-status-changes')
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'orders',
            filter: `seller_id=eq.${user.id}`,
          },
          (payload: { new: any; old: any }) => {
            const newData = payload.new as OrderPayload['new'];
            const oldData = payload.old as OrderPayload['old'];

            // Check if status changed to cancelled or delivered
            if (oldData.status !== newData.status) {
              if (newData.status === 'cancelled') {
                toast.error(
                  `🚫 Zakaz #${newData.order_number} bekor qilindi!`,
                  {
                    description: `Mijoz: ${newData.customer_name}`,
                    duration: 10000,
                  }
                );
              } else if (newData.status === 'delivered') {
                toast.success(
                  `✅ Zakaz #${newData.order_number} tasdiqlandi!`,
                  {
                    description: `Mijoz: ${newData.customer_name}`,
                    duration: 10000,
                  }
                );
              }
            }
          }
        )
        .subscribe();
    };

    setupSubscription();

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
      }
    };
  }, []);
};
