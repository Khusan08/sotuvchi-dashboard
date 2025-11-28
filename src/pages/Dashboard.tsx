import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import DashboardLayout from "@/components/DashboardLayout";
import StatsCard from "@/components/StatsCard";
import { ShoppingCart, DollarSign, TrendingUp, Package, Users } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, Legend } from "recharts";
import { format, subDays, startOfMonth, endOfMonth } from "date-fns";
import { useUserRoles } from "@/hooks/useUserRoles";
import EmployeeStatsCard from "@/components/EmployeeStatsCard";

const Dashboard = () => {
  const navigate = useNavigate();
  const { isAdmin, isRop } = useUserRoles();
  const [stats, setStats] = useState({
    totalOrders: 0,
    totalRevenue: 0,
    averageOrder: 0,
    pendingOrders: 0,
    totalEmployees: 0,
  });
  const [chartData, setChartData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [employeeStats, setEmployeeStats] = useState<any[]>([]);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const monthStart = startOfMonth(new Date());
      const monthEnd = endOfMonth(new Date());

      // For admin/ROP, fetch all employees' data
      if (isAdmin || isRop) {
        const { data: employees, error: employeesError } = await supabase
          .from("profiles")
          .select("id, full_name")
          .eq("role", "seller");

        if (employeesError) throw employeesError;

        const { data: allOrders, error: ordersError } = await supabase
          .from("orders")
          .select("*")
          .gte("order_date", format(monthStart, "yyyy-MM-dd"))
          .lte("order_date", format(monthEnd, "yyyy-MM-dd"));

        if (ordersError) throw ordersError;

        const { data: allLeads, error: leadsError } = await supabase
          .from("leads")
          .select("seller_id");

        if (leadsError) throw leadsError;

        // Calculate stats per employee
        const employeeStatsData = employees?.map((employee) => {
          const employeeOrders = allOrders?.filter(o => o.seller_id === employee.id) || [];
          const employeeLeads = allLeads?.filter(l => l.seller_id === employee.id) || [];
          
          const totalOrders = employeeOrders.length;
          const totalSales = employeeOrders.reduce((sum, order) => sum + Number(order.total_amount), 0);
          const avgCheck = totalOrders > 0 ? totalSales / totalOrders : 0;
          const conversionRate = employeeLeads.length > 0 ? (totalOrders / employeeLeads.length) * 100 : 0;

          return {
            seller_id: employee.id,
            seller_name: employee.full_name,
            totalOrders,
            totalLeads: employeeLeads.length,
            totalSales,
            averageCheck: avgCheck,
            conversionRate,
            pendingOrders: employeeOrders.filter(o => o.status === 'pending').length,
            deliveredOrders: employeeOrders.filter(o => o.status === 'delivered').length,
            cancelledOrders: employeeOrders.filter(o => o.status === 'cancelled').length,
          };
        }) || [];

        setEmployeeStats(employeeStatsData);

        // Overall stats
        const totalOrders = allOrders?.length || 0;
        const totalRevenue = allOrders?.reduce((sum, order) => sum + Number(order.total_amount), 0) || 0;
        const averageOrder = totalOrders > 0 ? totalRevenue / totalOrders : 0;
        const pendingOrders = allOrders?.filter(o => o.status === 'pending').length || 0;

        setStats({
          totalOrders,
          totalRevenue,
          averageOrder,
          pendingOrders,
          totalEmployees: employees?.length || 0,
        });

        // Chart data for all orders
        const last7Days = Array.from({ length: 7 }, (_, i) => {
          const date = subDays(new Date(), 6 - i);
          const dateStr = format(date, "yyyy-MM-dd");
          const dayOrders = allOrders?.filter(o => o.order_date === dateStr) || [];
          const dayRevenue = dayOrders.reduce((sum, order) => sum + Number(order.total_amount), 0);
          
          return {
            name: format(date, "MMM dd"),
            revenue: dayRevenue,
            orders: dayOrders.length,
          };
        });

        setChartData(last7Days);
      } else {
        // Regular user - fetch only their data
        const { data: orders, error: ordersError } = await supabase
          .from("orders")
          .select("*")
          .eq("seller_id", user.id)
          .gte("order_date", format(monthStart, "yyyy-MM-dd"))
          .lte("order_date", format(monthEnd, "yyyy-MM-dd"));

        if (ordersError) throw ordersError;

        const { count: leadsCount, error: leadsError } = await supabase
          .from("leads")
          .select("id", { count: "exact", head: true })
          .eq("seller_id", user.id);

        if (leadsError) throw leadsError;

        const totalOrders = orders?.length || 0;
        const totalRevenue = orders?.reduce((sum, order) => sum + Number(order.total_amount), 0) || 0;
        const averageOrder = totalOrders > 0 ? totalRevenue / totalOrders : 0;
        const pendingOrders = orders?.filter(o => o.status === 'pending').length || 0;

        setStats({
          totalOrders,
          totalRevenue,
          averageOrder,
          pendingOrders,
          totalEmployees: 0,
        });

        const last7Days = Array.from({ length: 7 }, (_, i) => {
          const date = subDays(new Date(), 6 - i);
          const dateStr = format(date, "yyyy-MM-dd");
          const dayOrders = orders?.filter(o => o.order_date === dateStr) || [];
          const dayRevenue = dayOrders.reduce((sum, order) => sum + Number(order.total_amount), 0);
          
          return {
            name: format(date, "MMM dd"),
            revenue: dayRevenue,
            orders: dayOrders.length,
          };
        });

        setChartData(last7Days);
      }
    } catch (error) {
      console.error("Error fetching dashboard data:", error);
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
      <div className="space-y-8">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Dashboard</h2>
          <p className="text-muted-foreground mt-2">
            Oylik statistika va hisobotlar
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <div onClick={() => navigate('/all-orders')} className="cursor-pointer">
            <StatsCard
              title="Jami zakazlar"
              value={stats.totalOrders}
              icon={ShoppingCart}
              description="Joriy oyda"
            />
          </div>
          <StatsCard
            title="Jami daromad"
            value={`${stats.totalRevenue.toLocaleString()} so'm`}
            icon={DollarSign}
            description="Joriy oyda"
          />
          <StatsCard
            title="O'rtacha zakaz"
            value={`${Math.round(stats.averageOrder).toLocaleString()} so'm`}
            icon={TrendingUp}
            description="Har bir zakaz"
          />
          {(isAdmin || isRop) ? (
            <StatsCard
              title="Jami xodimlar"
              value={stats.totalEmployees}
              icon={Users}
              description="Faol sotuvchilar"
            />
          ) : (
            <StatsCard
              title="Kutilayotgan"
              value={stats.pendingOrders}
              icon={Package}
              description="Pending zakazlar"
            />
          )}
        </div>

        {/* Employee Statistics for Admin/ROP */}
        {(isAdmin || isRop) && employeeStats.length > 0 && (
          <div>
            <h3 className="text-xl font-semibold mb-4">Xodimlar ma'lumotlari</h3>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {employeeStats.map((employee) => (
                <EmployeeStatsCard
                  key={employee.seller_id}
                  sellerName={employee.seller_name}
                  totalOrders={employee.totalOrders}
                  totalLeads={employee.totalLeads}
                  totalSales={employee.totalSales}
                  averageCheck={employee.averageCheck}
                  conversionRate={employee.conversionRate}
                  pendingOrders={employee.pendingOrders}
                  deliveredOrders={employee.deliveredOrders}
                  cancelledOrders={employee.cancelledOrders}
                />
              ))}
            </div>
          </div>
        )}

        <Card>
          <CardHeader>
            <CardTitle>So'nggi 7 kun statistikasi</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="revenue" fill="hsl(var(--primary))" radius={[8, 8, 0, 0]} name="Daromad" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Zakazlar tendensiyasi</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line 
                  type="monotone" 
                  dataKey="orders" 
                  stroke="hsl(var(--primary))" 
                  strokeWidth={2}
                  name="Zakazlar"
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default Dashboard;
