import { useOrderStatusNotifications } from '@/hooks/useOrderStatusNotifications';

export const OrderStatusNotificationProvider = ({ children }: { children: React.ReactNode }) => {
  useOrderStatusNotifications();
  return <>{children}</>;
};
