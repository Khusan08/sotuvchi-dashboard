import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import DashboardLayout from "@/components/DashboardLayout";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Calendar, Search, Edit, Trash2, Plus, X } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useUserRoles } from "@/hooks/useUserRoles";
import { useUserRole } from "@/hooks/useUserRole";
import { Textarea } from "@/components/ui/textarea";
import { regions, regionsData } from "@/lib/regions";

interface OrderItem {
  product_name: string;
  quantity: number;
  price: number;
}

interface Order {
  id: string;
  order_number: number;
  order_date: string;
  customer_name: string;
  customer_phone: string;
  total_amount: number;
  advance_payment: number;
  status: string;
  items: OrderItem[];
  region?: string;
  district?: string;
  notes?: string;
  seller_name?: string;
  seller_phone?: string;
}

const AllOrders = () => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [filteredOrders, setFilteredOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [startDate, setStartDate] = useState<Date>();
  const [endDate, setEndDate] = useState<Date>();
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingOrder, setEditingOrder] = useState<Order | null>(null);
  const [editFormData, setEditFormData] = useState({
    status: "",
    notes: "",
  });
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [createFormData, setCreateFormData] = useState({
    customer_name: '',
    customer_phone: '',
    customer_phone2: '',
    region: '',
    district: '',
    advance_payment: 0,
    total_amount: 0,
    notes: '',
    items: [{ product_name: '', quantity: 1 }] as Array<{ product_name: string; quantity: number }>
  });
  const [products, setProducts] = useState<any[]>([]);
  const [availableDistricts, setAvailableDistricts] = useState<string[]>([]);
  const { isAdmin, isRop, loading: rolesLoading } = useUserRoles();
  const { isSotuvchi } = useUserRole();

  useEffect(() => {
    if (!rolesLoading) {
      fetchOrders();
      fetchProducts();
    }
  }, [rolesLoading, isAdmin, isRop]);

  useEffect(() => {
    filterOrders();
  }, [orders, startDate, endDate, searchQuery, filterStatus]);

  useEffect(() => {
    if (createFormData.region) {
      setAvailableDistricts(regionsData[createFormData.region] || []);
      setCreateFormData(prev => ({ ...prev, district: '' }));
    } else {
      setAvailableDistricts([]);
    }
  }, [createFormData.region]);

  const calculateItemPrice = () => {
    const totalQuantity = createFormData.items.reduce((sum, item) => sum + item.quantity, 0);
    return totalQuantity > 0 ? createFormData.total_amount / totalQuantity : 0;
  };

  const fetchOrders = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Fetch orders based on role
      let ordersQuery = supabase
        .from("orders")
        .select(`
          *,
          profiles!orders_seller_id_fkey(full_name, phone)
        `)
        .order("order_date", { ascending: false });

      // If not admin or rop, only show own orders
      if (!isAdmin && !isRop) {
        ordersQuery = ordersQuery.eq("seller_id", user.id);
      }

      const { data: ordersData, error: ordersError } = await ordersQuery;

      if (ordersError) throw ordersError;

      const ordersWithItems = await Promise.all(
        (ordersData || []).map(async (order) => {
          const { data: itemsData } = await supabase
            .from("order_items")
            .select("*")
            .eq("order_id", order.id);

          return {
            ...order,
            items: itemsData || [],
            seller_name: order.profiles?.full_name || "Noma'lum",
            seller_phone: order.profiles?.phone || "",
          };
        })
      );

      setOrders(ordersWithItems);
    } catch (error: any) {
      toast.error("Xatolik: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchProducts = async () => {
    try {
      const { data, error } = await supabase
        .from("products")
        .select("*")
        .order("name");

      if (error) throw error;
      setProducts(data || []);
    } catch (error: any) {
      toast.error("Mahsulotlarni yuklashda xatolik: " + error.message);
    }
  };

  const filterOrders = () => {
    let filtered = [...orders];

    if (startDate) {
      filtered = filtered.filter(order => 
        new Date(order.order_date) >= startDate
      );
    }

    if (endDate) {
      filtered = filtered.filter(order => 
        new Date(order.order_date) <= endDate
      );
    }

    if (filterStatus !== "all") {
      filtered = filtered.filter(order => order.status === filterStatus);
    }

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(order =>
        order.customer_name.toLowerCase().includes(query) ||
        order.customer_phone?.toLowerCase().includes(query) ||
        order.order_number.toString().includes(query)
      );
    }

    setFilteredOrders(filtered);
  };

  const calculateTotalSales = () => {
    return filteredOrders.reduce((total, order) => total + Number(order.total_amount), 0);
  };

  const addProductToOrder = (product: any) => {
    const existingIndex = createFormData.items.findIndex(item => item.product_name === product.name);
    
    if (existingIndex >= 0) {
      const newItems = [...createFormData.items];
      newItems[existingIndex].quantity += 1;
      setCreateFormData({
        ...createFormData,
        items: newItems
      });
    } else {
      const newItems = [...createFormData.items.filter(item => item.product_name !== ''), {
        product_name: product.name,
        quantity: 1
      }];
      setCreateFormData({
        ...createFormData,
        items: newItems
      });
    }
  };

  const removeOrderItem = (index: number) => {
    const newItems = createFormData.items.filter((_, i) => i !== index);
    if (newItems.length === 0) {
      newItems.push({ product_name: '', quantity: 1 });
    }
    setCreateFormData({
      ...createFormData,
      items: newItems
    });
  };

  const handleEdit = (order: Order) => {
    setEditingOrder(order);
    setEditFormData({
      status: order.status,
      notes: order.notes || "",
    });
    setEditDialogOpen(true);
  };

  const handleQuickStatusUpdate = async (orderId: string, newStatus: string) => {
    try {
      const { error } = await supabase
        .from("orders")
        .update({ status: newStatus })
        .eq("id", orderId);

      if (error) throw error;

      toast.success("Status yangilandi!");
      fetchOrders();
    } catch (error: any) {
      toast.error("Xatolik: " + error.message);
    }
  };

  const handleUpdateOrder = async () => {
    if (!editingOrder) return;

    try {
      const updateData: any = {
        notes: editFormData.notes,
      };
      
      if (isAdmin) {
        updateData.status = editFormData.status;
      }

      const { error } = await supabase
        .from("orders")
        .update(updateData)
        .eq("id", editingOrder.id);

      if (error) throw error;

      toast.success("Zakaz muvaffaqiyatli yangilandi!");
      setEditDialogOpen(false);
      fetchOrders();
    } catch (error: any) {
      toast.error("Xatolik: " + error.message);
    }
  };

  const handleDeleteOrder = async (orderId: string) => {
    if (!confirm("Haqiqatan ham bu zakazni o'chirmoqchimisiz?")) return;

    try {
      // First delete order items
      const { error: itemsError } = await supabase
        .from("order_items")
        .delete()
        .eq("order_id", orderId);

      if (itemsError) throw itemsError;

      // Then delete the order
      const { error: orderError } = await supabase
        .from("orders")
        .delete()
        .eq("id", orderId);

      if (orderError) throw orderError;

      toast.success("Zakaz muvaffaqiyatli o'chirildi!");
      fetchOrders();
    } catch (error: any) {
      toast.error("Xatolik: " + error.message);
    }
  };

  const handleCreateOrder = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error("Tizimga kiring");
        return;
      }

      if (!createFormData.customer_name.trim()) {
        toast.error("Mijoz ismini kiriting");
        return;
      }

      if (!createFormData.total_amount || createFormData.total_amount <= 0) {
        toast.error("Umumiy summani kiriting");
        return;
      }

      const validItems = createFormData.items.filter(item => item.product_name && item.quantity > 0);
      
      if (validItems.length === 0) {
        toast.error("Kamida bitta mahsulot tanlang");
        return;
      }

      const itemPrice = calculateItemPrice();

      const { data: orderData, error: orderError } = await supabase
        .from('orders')
        .insert({
          customer_name: createFormData.customer_name,
          customer_phone: createFormData.customer_phone,
          customer_phone2: createFormData.customer_phone2,
          region: createFormData.region,
          district: createFormData.district,
          advance_payment: createFormData.advance_payment,
          notes: createFormData.notes,
          total_amount: createFormData.total_amount,
          seller_id: user.id,
          status: 'pending'
        })
        .select()
        .single();

      if (orderError) throw orderError;

      const orderItems = validItems.map(item => ({
        order_id: orderData.id,
        product_name: item.product_name,
        price: itemPrice,
        quantity: item.quantity
      }));

      const { error: itemsError } = await supabase
        .from('order_items')
        .insert(orderItems);

      if (itemsError) throw itemsError;

      toast.success("Buyurtma muvaffaqiyatli yaratildi");
      setCreateDialogOpen(false);
      setCreateFormData({
        customer_name: '',
        customer_phone: '',
        customer_phone2: '',
        region: '',
        district: '',
        advance_payment: 0,
        total_amount: 0,
        notes: '',
        items: [{ product_name: '', quantity: 1 }]
      });
      fetchOrders();
    } catch (error: any) {
      console.error('Error creating order:', error);
      toast.error("Buyurtma yaratishda xatolik: " + error.message);
    }
  };

  const updateOrderItem = (index: number, field: string, value: any) => {
    const newItems = [...createFormData.items];
    newItems[index] = { ...newItems[index], [field]: value };
    setCreateFormData({ ...createFormData, items: newItems });
  };

  const getStatusBadge = (status: string) => {
    const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
      pending: { label: "Jarayonda", variant: "secondary" },
      delivered: { label: "Tugallandi", variant: "default" },
      cancelled: { label: "Bekor qilindi", variant: "destructive" },
    };
    
    const config = statusConfig[status] || { label: status, variant: "secondary" };
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  if (loading || rolesLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <p className="text-muted-foreground">Yuklanmoqda...</p>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold">Barcha zakazlar</h1>
            <p className="text-muted-foreground">Jami {orders.length} ta zakaz</p>
          </div>
          <div className="flex gap-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Qidirish..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 w-[200px] sm:w-[300px]"
              />
            </div>
            <Button onClick={() => setCreateDialogOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Yaratish
            </Button>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Filtr</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-4">
              <div>
                <Label className="mb-2 block">Tezkor filtr</Label>
                <div className="flex flex-wrap gap-2">
                  <Button 
                    variant={!startDate && !endDate ? "default" : "outline"} 
                    size="sm"
                    onClick={() => {
                      setStartDate(undefined);
                      setEndDate(undefined);
                    }}
                  >
                    Hammasi
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => {
                      const today = new Date();
                      setStartDate(today);
                      setEndDate(today);
                    }}
                  >
                    Kunlik
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => {
                      const today = new Date();
                      const weekAgo = new Date(today);
                      weekAgo.setDate(weekAgo.getDate() - 7);
                      setStartDate(weekAgo);
                      setEndDate(today);
                    }}
                  >
                    Haftalik
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => {
                      const today = new Date();
                      const tenDaysAgo = new Date(today);
                      tenDaysAgo.setDate(tenDaysAgo.getDate() - 10);
                      setStartDate(tenDaysAgo);
                      setEndDate(today);
                    }}
                  >
                    10 kunlik
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => {
                      const today = new Date();
                      const twentyDaysAgo = new Date(today);
                      twentyDaysAgo.setDate(twentyDaysAgo.getDate() - 20);
                      setStartDate(twentyDaysAgo);
                      setEndDate(today);
                    }}
                  >
                    20 kunlik
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => {
                      const today = new Date();
                      const monthAgo = new Date(today);
                      monthAgo.setMonth(monthAgo.getMonth() - 1);
                      setStartDate(monthAgo);
                      setEndDate(today);
                    }}
                  >
                    Oylik
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => {
                      const today = new Date();
                      const yearAgo = new Date(today);
                      yearAgo.setFullYear(yearAgo.getFullYear() - 1);
                      setStartDate(yearAgo);
                      setEndDate(today);
                    }}
                  >
                    Yillik
                  </Button>
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Boshlanish sanasi</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="w-full justify-start">
                        <Calendar className="mr-2 h-4 w-4" />
                        {startDate ? format(startDate, "PPP") : "Tanlang"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <CalendarComponent mode="single" selected={startDate} onSelect={setStartDate} />
                    </PopoverContent>
                  </Popover>
                </div>
                <div className="space-y-2">
                  <Label>Tugash sanasi</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="w-full justify-start">
                        <Calendar className="mr-2 h-4 w-4" />
                        {endDate ? format(endDate, "PPP") : "Tanlang"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <CalendarComponent mode="single" selected={endDate} onSelect={setEndDate} />
                    </PopoverContent>
                  </Popover>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="status-filter">Status</Label>
                  <Select value={filterStatus} onValueChange={setFilterStatus}>
                    <SelectTrigger id="status-filter">
                      <SelectValue placeholder="Statusni tanlang" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Hammasi</SelectItem>
                      <SelectItem value="pending">Jarayonda</SelectItem>
                      <SelectItem value="delivered">Tugallandi</SelectItem>
                      <SelectItem value="cancelled">Bekor qilindi</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
            {(startDate || endDate || filterStatus !== "all") && (
              <Button 
                variant="outline" 
                onClick={() => { 
                  setStartDate(undefined); 
                  setEndDate(undefined); 
                  setFilterStatus("all"); 
                }}
              >
                Filtrni tozalash
              </Button>
            )}
          </CardContent>
        </Card>

        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ID</TableHead>
                <TableHead>Sana</TableHead>
                <TableHead>Mijoz</TableHead>
                {(isAdmin || isRop) && <TableHead>Sotuvchi</TableHead>}
                <TableHead>Mahsulotlar</TableHead>
                <TableHead>Manzil</TableHead>
                <TableHead>Jami summa</TableHead>
                <TableHead>Avans</TableHead>
                <TableHead>Qolgan</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Izoh</TableHead>
                <TableHead>Amallar</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredOrders.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={(isAdmin || isRop) ? 12 : 11} className="text-center text-muted-foreground">
                    Zakazlar topilmadi
                  </TableCell>
                </TableRow>
              ) : (
                filteredOrders.map((order) => (
                  <TableRow key={order.id}>
                    <TableCell className="font-mono text-sm">{order.order_number}</TableCell>
                    <TableCell>{new Date(order.order_date).toLocaleDateString("uz-UZ")}</TableCell>
                    <TableCell>
                      <div className="font-medium">{order.customer_name}</div>
                      <div className="text-sm text-muted-foreground">{order.customer_phone}</div>
                    </TableCell>
                    {(isAdmin || isRop) && (
                      <TableCell>
                        <div className="font-medium">{order.seller_name}</div>
                        <div className="text-sm text-muted-foreground">{order.seller_phone}</div>
                      </TableCell>
                    )}
                    <TableCell>
                      <div className="space-y-1">
                        {order.items.map((item, idx) => (
                          <div key={idx} className="text-sm">
                            {item.product_name}
                          </div>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell>
                      {order.region && order.district && (
                        <div className="text-sm">
                          <div>{order.region}</div>
                          <div className="text-muted-foreground">{order.district}</div>
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="font-semibold">
                      {Number(order.total_amount).toLocaleString()} so'm
                    </TableCell>
                    <TableCell className="font-medium text-blue-600">
                      {Number(order.advance_payment || 0).toLocaleString()} so'm
                    </TableCell>
                    <TableCell className="font-medium text-orange-600">
                      {(Number(order.total_amount) - Number(order.advance_payment || 0)).toLocaleString()} so'm
                    </TableCell>
                    <TableCell>
                      {isAdmin ? (
                        <Select
                          value={order.status}
                          onValueChange={(value) => handleQuickStatusUpdate(order.id, value)}
                        >
                          <SelectTrigger className="w-[140px]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="pending">Jarayonda</SelectItem>
                            <SelectItem value="delivered">Tugallandi</SelectItem>
                            <SelectItem value="cancelled">Bekor qilindi</SelectItem>
                          </SelectContent>
                        </Select>
                      ) : (
                        getStatusBadge(order.status)
                      )}
                    </TableCell>
                    <TableCell className="max-w-[200px] truncate">{order.notes}</TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleEdit(order)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        {isAdmin && (
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => handleDeleteOrder(order.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {filteredOrders.length > 0 && (
          <Card>
            <CardContent className="p-6">
              <div className="grid grid-cols-2 gap-6">
                <div className="flex flex-col">
                  <span className="text-sm text-muted-foreground mb-1">Jami zakazlar</span>
                  <span className="text-2xl font-bold text-primary">
                    {filteredOrders.length} ta
                  </span>
                </div>
                <div className="flex flex-col">
                  <span className="text-sm text-muted-foreground mb-1">Jami savdo</span>
                  <span className="text-2xl font-bold text-primary">
                    {calculateTotalSales().toLocaleString()} so'm
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Zakazni tahrirlash</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {isAdmin && (
              <div className="space-y-2">
                <Label htmlFor="edit-status">Status</Label>
                <Select
                  value={editFormData.status}
                  onValueChange={(value) => setEditFormData({ ...editFormData, status: value })}
                >
                  <SelectTrigger id="edit-status">
                    <SelectValue placeholder="Statusni tanlang" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">Jarayonda</SelectItem>
                    <SelectItem value="delivered">Tugallandi</SelectItem>
                    <SelectItem value="cancelled">Bekor qilindi</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="edit-notes">Izoh</Label>
              <Textarea
                id="edit-notes"
                value={editFormData.notes}
                onChange={(e) => setEditFormData({ ...editFormData, notes: e.target.value })}
                placeholder="Qo'shimcha izoh..."
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
              Bekor qilish
            </Button>
            <Button onClick={handleUpdateOrder}>
              Saqlash
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Order Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Yangi buyurtma yaratish</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="create_customer_name">Mijoz ismi *</Label>
                <Input
                  id="create_customer_name"
                  value={createFormData.customer_name}
                  onChange={(e) => setCreateFormData({ ...createFormData, customer_name: e.target.value })}
                  placeholder="Ism Familiya"
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label htmlFor="create_customer_phone">Telefon 1</Label>
                  <Input
                    id="create_customer_phone"
                    value={createFormData.customer_phone}
                    onChange={(e) => setCreateFormData({ ...createFormData, customer_phone: e.target.value })}
                    placeholder="+998 XX XXX XX XX"
                  />
                </div>
                <div>
                  <Label htmlFor="create_customer_phone2">Telefon 2</Label>
                  <Input
                    id="create_customer_phone2"
                    value={createFormData.customer_phone2}
                    onChange={(e) => setCreateFormData({ ...createFormData, customer_phone2: e.target.value })}
                    placeholder="+998 XX XXX XX XX"
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="create_region">Viloyat</Label>
                <Select
                  value={createFormData.region}
                  onValueChange={(value) => setCreateFormData({ ...createFormData, region: value, district: '' })}
                >
                  <SelectTrigger id="create_region">
                    <SelectValue placeholder="Viloyatni tanlang" />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.keys(regionsData).map((regionName) => (
                      <SelectItem key={regionName} value={regionName}>
                        {regionName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="create_district">Tuman</Label>
                <Select
                  value={createFormData.district}
                  onValueChange={(value) => setCreateFormData({ ...createFormData, district: value })}
                  disabled={!createFormData.region}
                >
                  <SelectTrigger id="create_district">
                    <SelectValue placeholder="Tumanni tanlang" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableDistricts.map((district) => (
                      <SelectItem key={district} value={district}>
                        {district}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-4 border-t pt-4">
              <div>
                <Label>Mahsulotlarni tanlang *</Label>
                <p className="text-xs text-muted-foreground mb-2">Mahsulotni tanlang yoki qo'lda kiriting</p>
              </div>
              
              {/* Product selection grid */}
              <div className="grid grid-cols-2 gap-3 max-h-[200px] overflow-y-auto p-1 border rounded-md">
                {products.map((product) => (
                  <Card 
                    key={product.id}
                    className="cursor-pointer hover:border-primary transition-colors overflow-hidden"
                    onClick={() => addProductToOrder(product)}
                  >
                    <CardContent className="p-3">
                      <h4 className="font-medium text-sm line-clamp-1">{product.name}</h4>
                    </CardContent>
                  </Card>
                ))}
              </div>

              {/* Selected products */}
              {createFormData.items.length > 0 && createFormData.items.some(item => item.product_name) && (
                <div className="space-y-2 border-t pt-4">
                  <Label>Tanlangan mahsulotlar</Label>
                  {createFormData.items.filter(item => item.product_name).map((item, index) => (
                    <div key={index} className="flex gap-2 items-center">
                      <div className="flex-1">
                        <Input
                          placeholder="Mahsulot nomi"
                          value={item.product_name}
                          onChange={(e) => updateOrderItem(index, 'product_name', e.target.value)}
                        />
                      </div>
                      <div className="w-24">
                        <Input
                          type="number"
                          placeholder="Soni"
                          value={item.quantity}
                          onChange={(e) => updateOrderItem(index, 'quantity', parseInt(e.target.value) || 1)}
                          min="1"
                        />
                      </div>
                      {createFormData.items.length > 1 && (
                        <Button
                          type="button"
                          variant="destructive"
                          size="icon"
                          onClick={() => removeOrderItem(index)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  ))}
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setCreateFormData({
                      ...createFormData,
                      items: [...createFormData.items, { product_name: '', quantity: 1 }]
                    })}
                    className="w-full"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Mahsulot qo'shish
                  </Button>
                </div>
              )}
            </div>

            <div>
              <Label htmlFor="total_amount">Umumiy summa (so'm) *</Label>
              <Input
                id="total_amount"
                type="number"
                value={createFormData.total_amount}
                onChange={(e) => setCreateFormData({ ...createFormData, total_amount: parseFloat(e.target.value) || 0 })}
                placeholder="Umumiy summani kiriting"
                min="0"
                required
              />
              {createFormData.total_amount > 0 && createFormData.items.filter(i => i.product_name).length > 0 && (
                <p className="text-xs text-muted-foreground mt-1">
                  Har bir mahsulot narxi: {calculateItemPrice().toLocaleString()} so'm
                </p>
              )}
            </div>

            <div>
              <Label htmlFor="advance_payment">Oldindan to'lov</Label>
              <Input
                id="advance_payment"
                type="number"
                value={createFormData.advance_payment}
                onChange={(e) => setCreateFormData({ ...createFormData, advance_payment: Number(e.target.value) })}
                placeholder="0"
              />
            </div>

            {createFormData.total_amount > 0 && (
              <div className="p-3 bg-muted rounded-md">
                <p className="text-sm font-medium">
                  Jami: {createFormData.total_amount.toLocaleString()} so'm
                </p>
                {createFormData.advance_payment > 0 && (
                  <p className="text-sm text-muted-foreground">
                    Qoldiq: {(createFormData.total_amount - createFormData.advance_payment).toLocaleString()} so'm
                  </p>
                )}
              </div>
            )}

            <div>
              <Label htmlFor="notes">Izoh</Label>
              <Textarea
                id="notes"
                value={createFormData.notes}
                onChange={(e) => setCreateFormData({ ...createFormData, notes: e.target.value })}
                placeholder="Qo'shimcha ma'lumot"
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setCreateDialogOpen(false)}>
              Bekor qilish
            </Button>
            <Button type="button" onClick={handleCreateOrder}>
              Yaratish
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
};

export default AllOrders;
