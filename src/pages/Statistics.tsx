import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, Legend } from "recharts";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { useUserRoles } from "@/hooks/useUserRoles";
import { toast } from "sonner";

interface SellerStats {
  seller_id: string;
  seller_name: string;
  total_orders: number;
  total_revenue: number;
  completed_orders: number;
  cancelled_orders: number;
  conversion_rate: number;
  average_order_value: number;
}

const Statistics = () => {
  const [sellers, setSellers] = useState<any[]>([]);
  const [selectedSeller, setSelectedSeller] = useState<string>("all");
  const [stats, setStats] = useState<SellerStats[]>([]);
  const [chartData, setChartData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const { isAdmin, isRop } = useUserRoles();

  useEffect(() => {
    if (isAdmin || isRop) {
      fetchSellers();
    }
  }, [isAdmin, isRop]);

  useEffect(() => {
    fetchStatistics();
  }, [selectedSeller]);

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
    try {
      setLoading(true);
      let ordersQuery = supabase
        .from("orders")
        .select(`
          *,
          profiles!orders_seller_id_fkey(full_name)
        `);

      if (selectedSeller !== "all") {
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
            total_orders: 0,
            total_revenue: 0,
            completed_orders: 0,
            cancelled_orders: 0,
            orders: [],
          });
        }

        const seller = sellerMap.get(sellerId);
        seller.total_orders++;
        seller.total_revenue += Number(order.total_amount);
        seller.orders.push(order);
        
        if (order.status === "delivered") {
          seller.completed_orders++;
        } else if (order.status === "cancelled") {
          seller.cancelled_orders++;
        }
      });

      const sellerStats: SellerStats[] = Array.from(sellerMap.values()).map((seller) => ({
        seller_id: seller.seller_id,
        seller_name: seller.seller_name,
        total_orders: seller.total_orders,
        total_revenue: seller.total_revenue,
        completed_orders: seller.completed_orders,
        cancelled_orders: seller.cancelled_orders,
        conversion_rate: seller.total_orders > 0 
          ? (seller.completed_orders / seller.total_orders) * 100 
          : 0,
        average_order_value: seller.total_orders > 0 
          ? seller.total_revenue / seller.total_orders 
          : 0,
      }));

      setStats(sellerStats);

      // Prepare chart data
      const chartData = sellerStats.map((seller) => ({
        name: seller.seller_name,
        zakazlar: seller.total_orders,
        daromad: Math.round(seller.total_revenue / 1000), // in thousands
        tugallandi: seller.completed_orders,
        bekorqilindi: seller.cancelled_orders,
      }));

      setChartData(chartData);
    } catch (error: any) {
      toast.error("Statistikani yuklashda xatolik: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  if (!isAdmin && !isRop) {
    return (
      <DashboardLayout>
        <div className="text-center text-muted-foreground">
          Bu sahifaga kirish huquqingiz yo'q
        </div>
      </DashboardLayout>
    );
  }

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
              Hodimlar bo'yicha batafsil statistika
            </p>
          </div>
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
        </div>

        {/* Stats Cards */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {stats.map((stat) => (
            <Card key={stat.seller_id}>
              <CardHeader>
                <CardTitle className="text-sm font-medium">
                  {stat.seller_name}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Jami zakazlar:</span>
                  <span className="font-semibold">{stat.total_orders}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Jami savdo:</span>
                  <span className="font-semibold">{stat.total_revenue.toLocaleString()} so'm</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Tugallandi:</span>
                  <span className="font-semibold text-green-600">{stat.completed_orders}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Bekor qilindi:</span>
                  <span className="font-semibold text-red-600">{stat.cancelled_orders}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Konversiya:</span>
                  <span className="font-semibold">{stat.conversion_rate.toFixed(1)}%</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">O'rtacha zakaz:</span>
                  <span className="font-semibold">{Math.round(stat.average_order_value).toLocaleString()} so'm</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Bar Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Zakazlar va daromad (ming so'mda)</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={350}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="zakazlar" fill="#8884d8" name="Zakazlar" />
                <Bar dataKey="daromad" fill="#82ca9d" name="Daromad (ming so'm)" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Line Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Tugallangan va bekor qilingan zakazlar</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={350}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line 
                  type="monotone" 
                  dataKey="tugallandi" 
                  stroke="#22c55e" 
                  strokeWidth={2}
                  name="Tugallandi"
                />
                <Line 
                  type="monotone" 
                  dataKey="bekorqilindi" 
                  stroke="#ef4444" 
                  strokeWidth={2}
                  name="Bekor qilindi"
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default Statistics;
