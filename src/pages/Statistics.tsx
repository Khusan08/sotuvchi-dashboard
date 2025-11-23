import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { useUserRoles } from "@/hooks/useUserRoles";
import { toast } from "sonner";

interface OrderStatusData {
  seller_id: string;
  seller_name: string;
  pending: number;
  delivered: number;
  cancelled: number;
  total: number;
}

const Statistics = () => {
  const [sellers, setSellers] = useState<any[]>([]);
  const [selectedSeller, setSelectedSeller] = useState<string>("all");
  const [statusData, setStatusData] = useState<OrderStatusData[]>([]);
  const [chartData, setChartData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string>("");
  const { isAdmin, isRop, isSotuvchi } = useUserRoles();

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
          });
        }

        const seller = sellerMap.get(sellerId);
        seller.total++;
        
        if (order.status === "pending") {
          seller.pending++;
        } else if (order.status === "delivered") {
          seller.delivered++;
        } else if (order.status === "cancelled") {
          seller.cancelled++;
        }
      });

      const statsArray: OrderStatusData[] = Array.from(sellerMap.values());
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
                <div className="flex justify-between items-center p-2 bg-blue-500/10 rounded">
                  <span className="text-sm font-medium text-blue-600">Kutilmoqda:</span>
                  <span className="text-lg font-bold text-blue-600">{stat.pending}</span>
                </div>
                <div className="flex justify-between items-center p-2 bg-green-500/10 rounded">
                  <span className="text-sm font-medium text-green-600">Yetkazildi:</span>
                  <span className="text-lg font-bold text-green-600">{stat.delivered}</span>
                </div>
                <div className="flex justify-between items-center p-2 bg-red-500/10 rounded">
                  <span className="text-sm font-medium text-red-600">Bekor qilindi:</span>
                  <span className="text-lg font-bold text-red-600">{stat.cancelled}</span>
                </div>
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
      </div>
    </DashboardLayout>
  );
};

export default Statistics;
