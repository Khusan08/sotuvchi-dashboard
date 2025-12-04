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
import { format, subDays, subMonths, subYears, startOfDay, endOfDay } from "date-fns";
import StatsCard from "@/components/StatsCard";
import EmployeeStatsCard from "@/components/EmployeeStatsCard";
import { ShoppingCart, TrendingUp, DollarSign, Target, CalendarIcon, Search, Trophy, Medal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";

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
  totalSales: number;
  averageCheck: number;
  totalLeads: number;
  conversionRate: number;
  orders?: any[];
  leadStages?: { [stageId: string]: { count: number; percent: number; stageName: string; leads: any[] } };
}

const Statistics = () => {
  const [sellers, setSellers] = useState<any[]>([]);
  const [selectedSeller, setSelectedSeller] = useState<string>("all");
  const [statusData, setStatusData] = useState<OrderStatusData[]>([]);
  const [chartData, setChartData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string>("");
  const { isAdmin, isRop, isSotuvchi } = useUserRoles();
  
  // Date range states
  const [startDate, setStartDate] = useState<Date | undefined>(subMonths(new Date(), 1));
  const [endDate, setEndDate] = useState<Date | undefined>(new Date());
  const [searchTerm, setSearchTerm] = useState("");
  
  // Summary statistics
  const [totalOrders, setTotalOrders] = useState(0);
  const [totalLeads, setTotalLeads] = useState(0);
  const [totalSales, setTotalSales] = useState(0);
  const [averageCheck, setAverageCheck] = useState(0);
  const [conversionRate, setConversionRate] = useState(0);
  const [stages, setStages] = useState<any[]>([]);
  
  // Orders dialog state
  const [ordersDialogOpen, setOrdersDialogOpen] = useState(false);
  const [selectedOrders, setSelectedOrders] = useState<any[]>([]);
  const [dialogTitle, setDialogTitle] = useState("");
  
  // Leads by stage dialog
  const [leadsDialogOpen, setLeadsDialogOpen] = useState(false);
  const [selectedStageLeads, setSelectedStageLeads] = useState<any[]>([]);
  const [leadsDialogTitle, setLeadsDialogTitle] = useState("");

  useEffect(() => {
    fetchCurrentUser();
    fetchStages();
    if (isAdmin || isRop) {
      fetchSellers();
    }
  }, [isAdmin, isRop]);

  const fetchStages = async () => {
    try {
      const { data, error } = await supabase
        .from("stages")
        .select("*")
        .order("display_order");
      
      if (error) throw error;
      setStages(data || []);
    } catch (error) {
      console.error("Error fetching stages:", error);
    }
  };

  const fetchCurrentUser = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      setCurrentUserId(user.id);
    }
  };

  useEffect(() => {
    fetchStatistics();
  }, [selectedSeller, currentUserId, startDate, endDate]);

  const setQuickFilter = (days: number | 'year') => {
    const end = new Date();
    let start: Date;
    
    if (days === 'year') {
      start = subYears(end, 1);
    } else {
      start = subDays(end, days);
    }
    
    setStartDate(start);
    setEndDate(end);
  };

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

      // Apply date range filter
      if (startDate) {
        const startISO = startOfDay(startDate).toISOString();
        ordersQuery = ordersQuery.gte("created_at", startISO);
        leadsQuery = leadsQuery.gte("created_at", startISO);
      }
      
      if (endDate) {
        const endISO = endOfDay(endDate).toISOString();
        ordersQuery = ordersQuery.lte("created_at", endISO);
        leadsQuery = leadsQuery.lte("created_at", endISO);
      }

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

      // Get leads data with stages for conversion and stage distribution calculation
      let leadsMap = new Map<string, number>();
      let leadsStageMap = new Map<string, Map<string, any[]>>();
      
      // Fetch leads for all sellers or specific seller with stage info
      let leadsQueryBuilder = supabase.from("leads").select("seller_id, id, stage, customer_name, customer_phone");
      
      if (isSotuvchi && currentUserId) {
        leadsQueryBuilder = leadsQueryBuilder.eq("seller_id", currentUserId);
      } else if (selectedSeller !== "all") {
        leadsQueryBuilder = leadsQueryBuilder.eq("seller_id", selectedSeller);
      }

      // Apply date range filter to leads
      if (startDate) {
        leadsQueryBuilder = leadsQueryBuilder.gte("created_at", startOfDay(startDate).toISOString());
      }
      if (endDate) {
        leadsQueryBuilder = leadsQueryBuilder.lte("created_at", endOfDay(endDate).toISOString());
      }
      
      const { data: leadsData } = await leadsQueryBuilder;
      
      leadsData?.forEach((lead) => {
        const count = leadsMap.get(lead.seller_id) || 0;
        leadsMap.set(lead.seller_id, count + 1);
        
        // Track leads by stage for each seller
        if (!leadsStageMap.has(lead.seller_id)) {
          leadsStageMap.set(lead.seller_id, new Map());
        }
        const sellerStages = leadsStageMap.get(lead.seller_id)!;
        if (!sellerStages.has(lead.stage)) {
          sellerStages.set(lead.stage, []);
        }
        sellerStages.get(lead.stage)!.push(lead);
      });

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
            totalSales: 0,
            orders: []
          });
        }

        const seller = sellerMap.get(sellerId);
        seller.total++;
        seller.totalSales += Number(order.total_amount);
        seller.orders.push(order);
        
        if (order.status === "pending") {
          seller.pending++;
        } else if (order.status === "delivered") {
          seller.delivered++;
        } else if (order.status === "cancelled") {
          seller.cancelled++;
        }
      });

      let statsArray: OrderStatusData[] = Array.from(sellerMap.values()).map((seller) => {
        const sellerLeads = leadsMap.get(seller.seller_id) || 0;
        const conversionRate = sellerLeads > 0 ? (seller.total / sellerLeads) * 100 : 0;
        
        // Calculate lead stage distribution
        const sellerStageLeads = leadsStageMap.get(seller.seller_id);
        const leadStages: { [stageId: string]: { count: number; percent: number; stageName: string; leads: any[] } } = {};
        
        if (sellerStageLeads && sellerLeads > 0) {
          stages.forEach((stage) => {
            const stageLeadsList = sellerStageLeads.get(stage.id) || [];
            leadStages[stage.id] = {
              count: stageLeadsList.length,
              percent: Math.round((stageLeadsList.length / sellerLeads) * 100),
              stageName: stage.name,
              leads: stageLeadsList
            };
          });
        }
        
        return {
          ...seller,
          pendingPercent: seller.total > 0 ? Math.round((seller.pending / seller.total) * 100) : 0,
          deliveredPercent: seller.total > 0 ? Math.round((seller.delivered / seller.total) * 100) : 0,
          cancelledPercent: seller.total > 0 ? Math.round((seller.cancelled / seller.total) * 100) : 0,
          averageCheck: seller.total > 0 ? seller.totalSales / seller.total : 0,
          totalLeads: sellerLeads,
          conversionRate: conversionRate,
          leadStages: leadStages
        };
      });

      // Apply search filter
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        statsArray = statsArray.filter(seller => 
          seller.seller_name.toLowerCase().includes(term) ||
          seller.orders.some((order: any) => 
            order.customer_name?.toLowerCase().includes(term) ||
            order.customer_phone?.toLowerCase().includes(term) ||
            order.region?.toLowerCase().includes(term) ||
            order.district?.toLowerCase().includes(term)
          )
        );
      }
      
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
        <div className="space-y-4">
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

          {/* Date Range and Search Filters */}
          <Card>
            <CardContent className="pt-6">
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {/* Date Range Pickers */}
                <div className="space-y-2">
                  <Label>Boshlanish sanasi</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left font-normal",
                          !startDate && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {startDate ? format(startDate, "dd.MM.yyyy") : "Sanani tanlang"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={startDate}
                        onSelect={setStartDate}
                        initialFocus
                        className="pointer-events-auto"
                      />
                    </PopoverContent>
                  </Popover>
                </div>

                <div className="space-y-2">
                  <Label>Tugash sanasi</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left font-normal",
                          !endDate && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {endDate ? format(endDate, "dd.MM.yyyy") : "Sanani tanlang"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={endDate}
                        onSelect={setEndDate}
                        initialFocus
                        className="pointer-events-auto"
                      />
                    </PopoverContent>
                  </Popover>
                </div>

                {/* Search Bar */}
                <div className="space-y-2">
                  <Label>Qidiruv</Label>
                  <div className="relative">
                    <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Qidirish..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-8"
                    />
                  </div>
                </div>
              </div>

              {/* Quick Filter Buttons */}
              <div className="flex flex-wrap gap-2 mt-4">
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => setQuickFilter(7)}
                >
                  1 Hafta
                </Button>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => setQuickFilter(10)}
                >
                  10 Kun
                </Button>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => setQuickFilter(20)}
                >
                  20 Kun
                </Button>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => setQuickFilter(30)}
                >
                  1 Oy
                </Button>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => setQuickFilter('year')}
                >
                  1 Yil
                </Button>
              </div>
            </CardContent>
          </Card>
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

        {/* Sales Ranking */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Trophy className="h-5 w-5 text-yellow-500" />
              Sotuv bo'yicha reyting
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {[...statusData]
                .sort((a, b) => b.totalSales - a.totalSales)
                .map((seller, index) => {
                  const getRankIcon = (rank: number) => {
                    if (rank === 0) return <Trophy className="h-5 w-5 text-yellow-500" />;
                    if (rank === 1) return <Medal className="h-5 w-5 text-gray-400" />;
                    if (rank === 2) return <Medal className="h-5 w-5 text-amber-600" />;
                    return <span className="w-5 h-5 flex items-center justify-center text-sm font-bold text-muted-foreground">{rank + 1}</span>;
                  };

                  return (
                    <div
                      key={seller.seller_id}
                      className={`flex items-center justify-between p-3 rounded-lg border ${
                        index === 0 ? 'bg-yellow-50 dark:bg-yellow-950/20 border-yellow-200 dark:border-yellow-800' :
                        index === 1 ? 'bg-gray-50 dark:bg-gray-950/20 border-gray-200 dark:border-gray-800' :
                        index === 2 ? 'bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800' :
                        'bg-card'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        {getRankIcon(index)}
                        <div>
                          <p className="font-medium">{seller.seller_name}</p>
                          <p className="text-xs text-muted-foreground">{seller.total} ta zakaz</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-lg">{seller.totalSales.toLocaleString()} so'm</p>
                        <p className="text-xs text-muted-foreground">O'rtacha: {Math.round(seller.averageCheck).toLocaleString()} so'm</p>
                      </div>
                    </div>
                  );
                })}
              {statusData.length === 0 && (
                <p className="text-center text-muted-foreground py-4">Ma'lumot topilmadi</p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Employee Stats Cards */}
        <div>
          <h3 className="text-xl font-semibold mb-4">Hodimlar statistikasi</h3>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {statusData.map((seller) => (
              <div key={seller.seller_id} className="space-y-4">
                <EmployeeStatsCard
                  sellerName={seller.seller_name}
                  totalOrders={seller.total}
                  totalLeads={seller.totalLeads}
                  totalSales={seller.totalSales}
                  averageCheck={seller.averageCheck}
                  conversionRate={seller.conversionRate}
                  pendingOrders={seller.pending}
                  deliveredOrders={seller.delivered}
                  cancelledOrders={seller.cancelled}
                  onViewOrders={(status) => handleViewOrders(seller.seller_id, seller.seller_name, status)}
                />
                
                {/* Lead Stage Distribution */}
                {seller.leadStages && Object.keys(seller.leadStages).length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-sm">Lid bosqichlari</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      {Object.entries(seller.leadStages).map(([stageId, stageData]) => (
                        stageData.count > 0 && (
                          <div
                            key={stageId}
                            className="flex items-center justify-between p-2 hover:bg-muted rounded-lg cursor-pointer transition-colors"
                            onClick={() => {
                              setSelectedStageLeads(stageData.leads);
                              setLeadsDialogTitle(`${seller.seller_name} - ${stageData.stageName} lidlari`);
                              setLeadsDialogOpen(true);
                            }}
                          >
                            <span className="text-sm">{stageData.stageName}</span>
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-muted-foreground">{stageData.count} ta</span>
                              <Badge variant="outline">{stageData.percent}%</Badge>
                            </div>
                          </div>
                        )
                      ))}
                    </CardContent>
                  </Card>
                )}
              </div>
            ))}
          </div>
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

        {/* Leads by Stage Dialog */}
        <Dialog open={leadsDialogOpen} onOpenChange={setLeadsDialogOpen}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{leadsDialogTitle}</DialogTitle>
            </DialogHeader>
            <div className="mt-4">
              {selectedStageLeads.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">Lidlar topilmadi</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Mijoz nomi</TableHead>
                      <TableHead>Telefon</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {selectedStageLeads.map((lead) => (
                      <TableRow key={lead.id}>
                        <TableCell className="font-medium">{lead.customer_name}</TableCell>
                        <TableCell>{lead.customer_phone || "—"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </div>
          </DialogContent>
        </Dialog>

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
