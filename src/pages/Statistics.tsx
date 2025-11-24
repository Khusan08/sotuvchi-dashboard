import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { useUserRoles } from "@/hooks/useUserRoles";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";

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

      // If seller role, only show their own stats
      if (isSotuvchi && currentUserId) {
        ordersQuery = ordersQuery.eq("seller_id", currentUserId);
      } else if (selectedSeller !== "all") {
        ordersQuery = ordersQuery.eq("seller_id", selectedSeller);
      }

      const { data: orders, error } = await ordersQuery;

      if (error) throw error;

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

      // Prepare chart data
      const chartData = statsArray.map((seller) => ({
        name: seller.seller_name,
        "Kutilmoqda": seller.pending,
        "Yetkazildi": seller.delivered,
        "Bekor qilindi": seller.cancelled,
      }));

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

        {/* Stats Cards */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {statusData.map((stat) => (
            <Card key={stat.seller_id}>
              <CardHeader>
                <CardTitle className="text-lg font-semibold">
                  {stat.seller_name}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between items-center p-2 bg-muted/50 rounded">
                  <span className="text-sm font-medium">Jami zakazlar:</span>
                  <span className="text-lg font-bold">{stat.total}</span>
                </div>
                <button
                  onClick={() => handleViewOrders(stat.seller_id, stat.seller_name, "pending")}
                  className="w-full flex justify-between items-center p-2 bg-blue-500/10 rounded hover:bg-blue-500/20 transition-colors cursor-pointer"
                >
                  <span className="text-sm font-medium text-blue-600">Kutilmoqda:</span>
                  <div className="text-right">
                    <span className="text-lg font-bold text-blue-600">{stat.pending}</span>
                    <span className="text-xs text-blue-600 ml-2">({stat.pendingPercent}%)</span>
                  </div>
                </button>
                <button
                  onClick={() => handleViewOrders(stat.seller_id, stat.seller_name, "delivered")}
                  className="w-full flex justify-between items-center p-2 bg-green-500/10 rounded hover:bg-green-500/20 transition-colors cursor-pointer"
                >
                  <span className="text-sm font-medium text-green-600">Yetkazildi:</span>
                  <div className="text-right">
                    <span className="text-lg font-bold text-green-600">{stat.delivered}</span>
                    <span className="text-xs text-green-600 ml-2">({stat.deliveredPercent}%)</span>
                  </div>
                </button>
                <button
                  onClick={() => handleViewOrders(stat.seller_id, stat.seller_name, "cancelled")}
                  className="w-full flex justify-between items-center p-2 bg-red-500/10 rounded hover:bg-red-500/20 transition-colors cursor-pointer"
                >
                  <span className="text-sm font-medium text-red-600">Bekor qilindi:</span>
                  <div className="text-right">
                    <span className="text-lg font-bold text-red-600">{stat.cancelled}</span>
                    <span className="text-xs text-red-600 ml-2">({stat.cancelledPercent}%)</span>
                  </div>
                </button>
              </CardContent>
            </Card>
          ))}
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
                <Tooltip />
                <Legend />
                <Bar dataKey="Kutilmoqda" fill="#3b82f6" />
                <Bar dataKey="Yetkazildi" fill="#22c55e" />
                <Bar dataKey="Bekor qilindi" fill="#ef4444" />
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
