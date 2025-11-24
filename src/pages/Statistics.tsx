import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, Cell, LabelList } from "recharts";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { useUserRoles } from "@/hooks/useUserRoles";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import StatsCard from "@/components/StatsCard";
import { ShoppingCart, TrendingUp, DollarSign, Target } from "lucide-react";

interface OrderStatusData {
  seller_id: string;
  seller_name: string;
  pending: number;
  delivered: number;
  cancelled: number;
  total: number;
  pendingPercent: number;
  deliveredPercent: number;
  cancelledPercent: number;
}

const Statistics = () => {
  const [sellers, setSellers] = useState<any[]>([]);
  const [selectedSeller, setSelectedSeller] = useState<string>("all");
  const [statusData, setStatusData] = useState<OrderStatusData[]>([]);
  const [chartData, setChartData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string>("");
  const { isAdmin, isRop, isSotuvchi } = useUserRoles();
  
  // Summary statistics
  const [totalOrders, setTotalOrders] = useState(0);
  const [totalLeads, setTotalLeads] = useState(0);
  const [totalSales, setTotalSales] = useState(0);
  const [averageCheck, setAverageCheck] = useState(0);
  const [conversionRate, setConversionRate] = useState(0);
  
  // Orders dialog state
  const [ordersDialogOpen, setOrdersDialogOpen] = useState(false);
  const [selectedOrders, setSelectedOrders] = useState<any[]>([]);
  const [dialogTitle, setDialogTitle] = useState("");

  useEffect(() => {
    fetchCurrentUser();
    if (isAdmin || isRop) {
      fetchSellers();
    }
  }, [isAdmin, isRop]);

  const fetchCurrentUser = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      setCurrentUserId(user.id);
    }
  };

  useEffect(() => {
    fetchStatistics();
  }, [selectedSeller, currentUserId]);

  const fetchSellers = async () => {
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name")
        .eq("role", "seller")
        .order("full_name");

      if (error) throw error;
      setSellers(data || []);
    } catch (error: any) {
      toast.error("Sotuvchilarni yuklashda xatolik: " + error.message);
    }
  };

  const fetchStatistics = async () => {
    if (!currentUserId && isSotuvchi) return;
    
    try {
      setLoading(true);
      let ordersQuery = supabase
        .from("orders")
        .select(`
          *,
          profiles!orders_seller_id_fkey(full_name)
        `);

      let leadsQuery = supabase.from("leads").select("id", { count: "exact", head: true });

      // If seller role, only show their own stats
      if (isSotuvchi && currentUserId) {
        ordersQuery = ordersQuery.eq("seller_id", currentUserId);
        leadsQuery = leadsQuery.eq("seller_id", currentUserId);
      } else if (selectedSeller !== "all") {
        ordersQuery = ordersQuery.eq("seller_id", selectedSeller);
        leadsQuery = leadsQuery.eq("seller_id", selectedSeller);
      }

      const [{ data: orders, error: ordersError }, { count: leadsCount, error: leadsError }] = await Promise.all([
        ordersQuery,
        leadsQuery
      ]);

      if (ordersError) throw ordersError;
      if (leadsError) throw leadsError;

      // Calculate summary statistics
      const totalOrdersCount = orders?.length || 0;
      const totalLeadsCount = leadsCount || 0;
      const totalSalesAmount = orders?.reduce((sum, order) => sum + Number(order.total_amount), 0) || 0;
      const avgCheck = totalOrdersCount > 0 ? totalSalesAmount / totalOrdersCount : 0;
      const conversion = totalLeadsCount > 0 ? (totalOrdersCount / totalLeadsCount) * 100 : 0;

      setTotalOrders(totalOrdersCount);
      setTotalLeads(totalLeadsCount);
      setTotalSales(totalSalesAmount);
      setAverageCheck(avgCheck);
      setConversionRate(conversion);

      // Group by seller
      const sellerMap = new Map<string, any>();
      
      orders?.forEach((order) => {
        const sellerId = order.seller_id;
        const sellerName = order.profiles?.full_name || "Noma'lum";
        
        if (!sellerMap.has(sellerId)) {
          sellerMap.set(sellerId, {
            seller_id: sellerId,
            seller_name: sellerName,
            pending: 0,
            delivered: 0,
            cancelled: 0,
            total: 0,
            orders: []
          });
        }

        const seller = sellerMap.get(sellerId);
        seller.total++;
        seller.orders.push(order);
        
        if (order.status === "pending") {
          seller.pending++;
        } else if (order.status === "delivered") {
          seller.delivered++;
        } else if (order.status === "cancelled") {
          seller.cancelled++;
        }
      });

      const statsArray: OrderStatusData[] = Array.from(sellerMap.values()).map((seller) => ({
        ...seller,
        pendingPercent: seller.total > 0 ? Math.round((seller.pending / seller.total) * 100) : 0,
        deliveredPercent: seller.total > 0 ? Math.round((seller.delivered / seller.total) * 100) : 0,
        cancelledPercent: seller.total > 0 ? Math.round((seller.cancelled / seller.total) * 100) : 0,
      }));
      
      setStatusData(statsArray);

      // Prepare chart data with all 3 bars for each seller
      const chartData = statsArray.flatMap((seller) => [
        {
          name: seller.seller_name,
          status: "Kutilmoqda",
          value: seller.pending,
          percent: seller.pendingPercent,
          sellerId: seller.seller_id,
          statusKey: "pending",
          fill: "#3b82f6"
        },
        {
          name: seller.seller_name,
          status: "Yetkazildi",
          value: seller.delivered,
          percent: seller.deliveredPercent,
          sellerId: seller.seller_id,
          statusKey: "delivered",
          fill: "#22c55e"
        },
        {
          name: seller.seller_name,
          status: "Bekor qilindi",
          value: seller.cancelled,
          percent: seller.cancelledPercent,
          sellerId: seller.seller_id,
          statusKey: "cancelled",
          fill: "#ef4444"
        }
      ]);

      setChartData(chartData);
    } catch (error: any) {
      toast.error("Statistikani yuklashda xatolik: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleViewOrders = async (sellerId: string, sellerName: string, status: string) => {
    try {
      const { data: orders, error } = await supabase
        .from("orders")
        .select(`
          *,
          order_items(*)
        `)
        .eq("seller_id", sellerId)
        .eq("status", status)
        .order("created_at", { ascending: false });

      if (error) throw error;

      const statusLabels: Record<string, string> = {
        pending: "Kutilmoqda",
        delivered: "Yetkazildi",
        cancelled: "Bekor qilindi"
      };

      setSelectedOrders(orders || []);
      setDialogTitle(`${sellerName} - ${statusLabels[status]} zakazlar`);
      setOrdersDialogOpen(true);
    } catch (error: any) {
      toast.error("Zakazlarni yuklashda xatolik: " + error.message);
    }
  };

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case "pending":
        return "default";
      case "delivered":
        return "secondary";
      case "cancelled":
        return "destructive";
      default:
        return "outline";
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "pending":
        return "Kutilmoqda";
      case "delivered":
        return "Yetkazildi";
      case "cancelled":
        return "Bekor qilindi";
      default:
        return status;
    }
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="text-center text-muted-foreground">Yuklanmoqda...</div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex justify-between items-start">
          <div>
            <h2 className="text-3xl font-bold tracking-tight">Statistika</h2>
            <p className="text-muted-foreground mt-2">
              {isAdmin || isRop ? "Hodimlar bo'yicha zakaz holati statistikasi" : "Mening zakaz statistikam"}
            </p>
          </div>
          {(isAdmin || isRop) && (
            <div className="w-[250px]">
              <Label>Sotuvchi</Label>
              <Select value={selectedSeller} onValueChange={setSelectedSeller}>
                <SelectTrigger>
                  <SelectValue placeholder="Sotuvchini tanlang" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Barcha sotuvchilar</SelectItem>
                  {sellers.map((seller) => (
                    <SelectItem key={seller.id} value={seller.id}>
                      {seller.full_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        {/* Summary Statistics */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <StatsCard
            title="Jami zakazlar"
            value={totalOrders}
            icon={ShoppingCart}
            description="Umumiy buyurtmalar soni"
          />
          <StatsCard
            title="Jami lidlar"
            value={totalLeads}
            icon={Target}
            description="Umumiy lidlar soni"
          />
          <StatsCard
            title="Jami savdo"
            value={`${totalSales.toLocaleString()} so'm`}
            icon={DollarSign}
            description="Umumiy savdo hajmi"
          />
          <StatsCard
            title="O'rtacha chek"
            value={`${Math.round(averageCheck).toLocaleString()} so'm`}
            icon={TrendingUp}
            description={`Konversiya: ${conversionRate.toFixed(1)}%`}
          />
        </div>

        {/* Bar Chart - Order Status by Seller */}
        <Card>
          <CardHeader>
            <CardTitle>Hodimlar bo'yicha zakaz holati</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={400}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      return (
                        <div className="bg-background border rounded p-2 shadow-lg">
                          <p className="font-semibold">{payload[0].payload.name}</p>
                          <p className="text-sm">
                            {payload[0].payload.status}: {payload[0].payload.value} ({payload[0].payload.percent}%)
                          </p>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Bar dataKey="value" onClick={(data) => handleViewOrders(data.sellerId, data.name, data.statusKey)} cursor="pointer">
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} />
                  ))}
                  <LabelList
                    dataKey="percent"
                    position="top"
                    formatter={(value: number) => `${value}%`}
                    style={{ fontSize: '12px', fontWeight: 'bold' }}
                  />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Orders Dialog */}
        <Dialog open={ordersDialogOpen} onOpenChange={setOrdersDialogOpen}>
          <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{dialogTitle}</DialogTitle>
            </DialogHeader>
            <div className="mt-4">
              {selectedOrders.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">Zakazlar topilmadi</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Zakaz №</TableHead>
                      <TableHead>Mijoz</TableHead>
                      <TableHead>Telefon</TableHead>
                      <TableHead>Manzil</TableHead>
                      <TableHead>Summa</TableHead>
                      <TableHead>Holat</TableHead>
                      <TableHead>Sana</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {selectedOrders.map((order) => (
                      <TableRow key={order.id}>
                        <TableCell className="font-medium">#{order.order_number}</TableCell>
                        <TableCell>{order.customer_name}</TableCell>
                        <TableCell>{order.customer_phone || "—"}</TableCell>
                        <TableCell>
                          {order.region && order.district
                            ? `${order.region}, ${order.district}`
                            : "—"}
                        </TableCell>
                        <TableCell className="font-semibold">
                          {order.total_amount.toLocaleString()} so'm
                        </TableCell>
                        <TableCell>
                          <Badge variant={getStatusBadgeVariant(order.status)}>
                            {getStatusLabel(order.status)}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {format(new Date(order.order_date), "dd.MM.yyyy")}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
};

export default Statistics;
