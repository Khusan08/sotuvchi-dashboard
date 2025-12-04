import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarIcon, Package, TrendingDown, BarChart3, AlertTriangle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { format, subDays } from "date-fns";
import { toast } from "sonner";
import { useUserRoles } from "@/hooks/useUserRoles";
import { useNavigate } from "react-router-dom";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";

interface ProductStats {
  id: string;
  name: string;
  category: string | null;
  price: number;
  stock: number;
  totalSold: number;
  totalRevenue: number;
}

const LOW_STOCK_THRESHOLD = 10;

const Inventory = () => {
  const navigate = useNavigate();
  const { isAdmin, loading: rolesLoading } = useUserRoles();
  const [products, setProducts] = useState<ProductStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [startDate, setStartDate] = useState<Date>(subDays(new Date(), 30));
  const [endDate, setEndDate] = useState<Date>(new Date());
  const [chartData, setChartData] = useState<any[]>([]);

  useEffect(() => {
    if (!rolesLoading && !isAdmin) {
      navigate('/');
      toast.error("Bu sahifaga kirish huquqi yo'q");
    }
  }, [rolesLoading, isAdmin, navigate]);

  useEffect(() => {
    if (!rolesLoading && isAdmin) {
      fetchInventoryStats();
    }
  }, [rolesLoading, isAdmin, startDate, endDate]);

  const fetchInventoryStats = async () => {
    try {
      setLoading(true);
      
      // Fetch all products
      const { data: productsData, error: productsError } = await supabase
        .from("products")
        .select("*")
        .order("name");

      if (productsError) throw productsError;

      // Fetch order items within date range
      const { data: ordersData, error: ordersError } = await supabase
        .from("orders")
        .select("id, order_date, status")
        .gte("order_date", format(startDate, "yyyy-MM-dd"))
        .lte("order_date", format(endDate, "yyyy-MM-dd"))
        .neq("status", "cancelled");

      if (ordersError) throw ordersError;

      const orderIds = ordersData?.map(o => o.id) || [];

      let orderItems: any[] = [];
      if (orderIds.length > 0) {
        const { data: itemsData, error: itemsError } = await supabase
          .from("order_items")
          .select("*")
          .in("order_id", orderIds);

        if (itemsError) throw itemsError;
        orderItems = itemsData || [];
      }

      // Calculate stats per product
      const productStats: ProductStats[] = (productsData || []).map(product => {
        const productItems = orderItems.filter(item => 
          item.product_name.toLowerCase() === product.name.toLowerCase()
        );
        const totalSold = productItems.reduce((sum, item) => sum + item.quantity, 0);
        const totalRevenue = productItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);

        return {
          id: product.id,
          name: product.name,
          category: product.category,
          price: product.price,
          stock: product.stock || 0,
          totalSold,
          totalRevenue,
        };
      });

      // Sort by total sold descending
      productStats.sort((a, b) => b.totalSold - a.totalSold);
      setProducts(productStats);

      // Create chart data (top 10 products)
      const topProducts = productStats.slice(0, 10).map(p => ({
        name: p.name.length > 15 ? p.name.substring(0, 15) + '...' : p.name,
        fullName: p.name,
        sotilgan: p.totalSold,
        daromad: p.totalRevenue,
      }));
      setChartData(topProducts);

    } catch (error: any) {
      console.error("Error fetching inventory:", error);
      toast.error("Ma'lumotlarni yuklashda xatolik");
    } finally {
      setLoading(false);
    }
  };

  const totalSold = products.reduce((sum, p) => sum + p.totalSold, 0);
  const totalRevenue = products.reduce((sum, p) => sum + p.totalRevenue, 0);

  if (rolesLoading || loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <p className="text-muted-foreground">Yuklanmoqda...</p>
        </div>
      </DashboardLayout>
    );
  }

  if (!isAdmin) {
    return null;
  }

  const lowStockProducts = products.filter(p => p.stock <= LOW_STOCK_THRESHOLD && p.stock >= 0);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Ombor</h1>
          <p className="text-muted-foreground">Mahsulotlar statistikasi va sotuvlar</p>
        </div>

        {/* Low Stock Warning */}
        {lowStockProducts.length > 0 && (
          <Card className="border-destructive bg-destructive/10">
            <CardHeader>
              <CardTitle className="text-destructive flex items-center gap-2">
                <TrendingDown className="h-5 w-5" />
                Kam qolgan mahsulotlar ({lowStockProducts.length} ta)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {lowStockProducts.map(p => (
                  <Badge key={p.id} variant="destructive">
                    {p.name}: {p.stock} ta
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Filter Card */}
        <Card>
          <CardHeader>
            <CardTitle>Sanalar bo'yicha filtr</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-4 items-end">
              <div className="space-y-2">
                <Label>Tezkor filtr</Label>
                <div className="flex flex-wrap gap-2">
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => {
                      setStartDate(subDays(new Date(), 7));
                      setEndDate(new Date());
                    }}
                  >
                    1 hafta
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => {
                      setStartDate(subDays(new Date(), 10));
                      setEndDate(new Date());
                    }}
                  >
                    10 kun
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => {
                      setStartDate(subDays(new Date(), 20));
                      setEndDate(new Date());
                    }}
                  >
                    20 kun
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => {
                      setStartDate(subDays(new Date(), 30));
                      setEndDate(new Date());
                    }}
                  >
                    1 oy
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => {
                      setStartDate(subDays(new Date(), 365));
                      setEndDate(new Date());
                    }}
                  >
                    1 yil
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Boshlanish</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-[160px] justify-start">
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {format(startDate, "dd.MM.yyyy")}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar mode="single" selected={startDate} onSelect={(d) => d && setStartDate(d)} />
                  </PopoverContent>
                </Popover>
              </div>

              <div className="space-y-2">
                <Label>Tugash</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-[160px] justify-start">
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {format(endDate, "dd.MM.yyyy")}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar mode="single" selected={endDate} onSelect={(d) => d && setEndDate(d)} />
                  </PopoverContent>
                </Popover>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Stats Cards */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-full bg-primary/10">
                  <Package className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Jami mahsulotlar</p>
                  <p className="text-2xl font-bold">{products.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-full bg-green-500/10">
                  <TrendingDown className="h-6 w-6 text-green-500" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Jami sotilgan</p>
                  <p className="text-2xl font-bold">{totalSold} ta</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-full bg-blue-500/10">
                  <BarChart3 className="h-6 w-6 text-blue-500" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Jami daromad</p>
                  <p className="text-2xl font-bold">{totalRevenue.toLocaleString()} so'm</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Chart */}
        {chartData.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Top 10 sotilgan mahsulotlar</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" />
                    <YAxis dataKey="name" type="category" width={120} />
                    <Tooltip 
                      formatter={(value, name) => [
                        name === 'sotilgan' ? `${value} ta` : `${Number(value).toLocaleString()} so'm`,
                        name === 'sotilgan' ? 'Sotilgan' : 'Daromad'
                      ]}
                    />
                    <Legend />
                    <Bar dataKey="sotilgan" fill="hsl(var(--primary))" name="Sotilgan" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Products Table */}
        <Card>
          <CardHeader>
            <CardTitle>Mahsulotlar ro'yxati</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="border rounded-lg overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Mahsulot nomi</TableHead>
                    <TableHead>Kategoriya</TableHead>
                    <TableHead>Qoldiq</TableHead>
                    <TableHead>Narxi</TableHead>
                    <TableHead>Sotilgan (davr)</TableHead>
                    <TableHead>Daromad (davr)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {products.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground">
                        Mahsulotlar topilmadi
                      </TableCell>
                    </TableRow>
                  ) : (
                    products.map((product) => (
                      <TableRow key={product.id}>
                        <TableCell className="font-medium">{product.name}</TableCell>
                        <TableCell>{product.category || "-"}</TableCell>
                        <TableCell>
                          <span className={product.stock <= LOW_STOCK_THRESHOLD ? "text-destructive font-medium flex items-center gap-1" : "text-foreground"}>
                            {product.stock <= LOW_STOCK_THRESHOLD && <AlertTriangle className="h-3 w-3" />}
                            {product.stock} ta
                          </span>
                        </TableCell>
                        <TableCell>{product.price.toLocaleString()} so'm</TableCell>
                        <TableCell>
                          <span className={product.totalSold > 0 ? "text-green-600 font-medium" : "text-muted-foreground"}>
                            {product.totalSold} ta
                          </span>
                        </TableCell>
                        <TableCell className="font-medium">
                          {product.totalRevenue.toLocaleString()} so'm
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default Inventory;
