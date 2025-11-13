import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { User, Phone, Mail, Calendar, TrendingUp, ShoppingCart } from "lucide-react";
import { format, startOfMonth, endOfMonth, subMonths } from "date-fns";

const Profile = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState<any>(null);
  const [stats, setStats] = useState({
    thisMonth: { orders: 0, revenue: 0 },
    lastMonth: { orders: 0, revenue: 0 },
    total: { orders: 0, revenue: 0 },
  });
  const [formData, setFormData] = useState({
    full_name: "",
    phone: "",
  });

  useEffect(() => {
    fetchProfile();
    fetchStats();
  }, []);

  const fetchProfile = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();

      if (error) throw error;

      setProfile(data);
      setFormData({
        full_name: data.full_name || "",
        phone: data.phone || "",
      });
    } catch (error) {
      console.error("Error fetching profile:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const thisMonthStart = startOfMonth(new Date());
      const thisMonthEnd = endOfMonth(new Date());
      const lastMonthStart = startOfMonth(subMonths(new Date(), 1));
      const lastMonthEnd = endOfMonth(subMonths(new Date(), 1));

      // This month
      const { data: thisMonthOrders } = await supabase
        .from("orders")
        .select("*")
        .eq("seller_id", user.id)
        .gte("order_date", format(thisMonthStart, "yyyy-MM-dd"))
        .lte("order_date", format(thisMonthEnd, "yyyy-MM-dd"));

      // Last month
      const { data: lastMonthOrders } = await supabase
        .from("orders")
        .select("*")
        .eq("seller_id", user.id)
        .gte("order_date", format(lastMonthStart, "yyyy-MM-dd"))
        .lte("order_date", format(lastMonthEnd, "yyyy-MM-dd"));

      // Total
      const { data: allOrders } = await supabase
        .from("orders")
        .select("*")
        .eq("seller_id", user.id);

      const calculateStats = (orders: any[]) => ({
        orders: orders?.length || 0,
        revenue: orders?.reduce((sum, o) => sum + parseFloat(String(o.total_amount)), 0) || 0,
      });

      setStats({
        thisMonth: calculateStats(thisMonthOrders || []),
        lastMonth: calculateStats(lastMonthOrders || []),
        total: calculateStats(allOrders || []),
      });
    } catch (error) {
      console.error("Error fetching stats:", error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { error } = await supabase
        .from("profiles")
        .update({
          full_name: formData.full_name,
          phone: formData.phone,
        })
        .eq("id", user.id);

      if (error) throw error;

      toast.success("Profil yangilandi!");
      fetchProfile();
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="text-center text-muted-foreground">Yuklanmoqda...</div>
      </DashboardLayout>
    );
  }

  const growth = stats.lastMonth.revenue > 0
    ? ((stats.thisMonth.revenue - stats.lastMonth.revenue) / stats.lastMonth.revenue) * 100
    : 0;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Profil</h2>
          <p className="text-muted-foreground mt-2">
            Shaxsiy ma'lumotlar va statistika
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Shaxsiy ma'lumotlar</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="full_name">
                    <User className="h-4 w-4 inline mr-2" />
                    To'liq ism
                  </Label>
                  <Input
                    id="full_name"
                    value={formData.full_name}
                    onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">
                    <Phone className="h-4 w-4 inline mr-2" />
                    Telefon
                  </Label>
                  <Input
                    id="phone"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>
                    <Mail className="h-4 w-4 inline mr-2" />
                    Email
                  </Label>
                  <Input value={profile?.id} disabled className="bg-muted" />
                </div>
                <div className="space-y-2">
                  <Label>
                    <Calendar className="h-4 w-4 inline mr-2" />
                    Ro'yxatdan o'tgan
                  </Label>
                  <Input
                    value={format(new Date(profile?.created_at), "dd.MM.yyyy")}
                    disabled
                    className="bg-muted"
                  />
                </div>
                <Button type="submit" className="w-full" disabled={saving}>
                  {saving ? "Saqlanmoqda..." : "Saqlash"}
                </Button>
              </form>
            </CardContent>
          </Card>

          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Joriy oy statistikasi</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <ShoppingCart className="h-5 w-5 text-primary" />
                    <span className="text-muted-foreground">Zakazlar</span>
                  </div>
                  <span className="text-2xl font-bold">{stats.thisMonth.orders}</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="h-5 w-5 text-success" />
                    <span className="text-muted-foreground">Daromad</span>
                  </div>
                  <span className="text-2xl font-bold">
                    {stats.thisMonth.revenue.toLocaleString()} so'm
                  </span>
                </div>
                <div className="pt-4 border-t">
                  <div className="flex items-center gap-2 text-sm">
                    <span className={growth >= 0 ? "text-success" : "text-destructive"}>
                      {growth >= 0 ? "+" : ""}{growth.toFixed(1)}%
                    </span>
                    <span className="text-muted-foreground">o'tgan oyga nisbatan</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Jami statistika</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Jami zakazlar</span>
                  <span className="text-xl font-bold">{stats.total.orders}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Jami daromad</span>
                  <span className="text-xl font-bold">
                    {stats.total.revenue.toLocaleString()} so'm
                  </span>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default Profile;
