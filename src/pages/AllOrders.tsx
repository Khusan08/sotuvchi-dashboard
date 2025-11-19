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
    region: '',
    district: '',
    advance_payment: 0,
    total_amount: 0,
    notes: '',
    items: [{ product_name: '', price: 0, quantity: 1 }]
  });
  const [products, setProducts] = useState<any[]>([]);
  const [availableDistricts, setAvailableDistricts] = useState<string[]>([]);
  const { isAdmin } = useUserRoles();

  useEffect(() => {
    fetchOrders();
    fetchProducts();
  }, []);

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

  useEffect(() => {
    const total = createFormData.items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    setCreateFormData(prev => ({ ...prev, total_amount: total }));
  }, [createFormData.items]);

  const fetchOrders = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: ordersData, error: ordersError } = await supabase
        .from("orders")
        .select("*")
        .eq("seller_id", user.id)
        .order("order_date", { ascending: false });

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

  const handleEdit = (order: Order) => {
    setEditingOrder(order);
    setEditFormData({
      status: order.status,
      notes: order.notes || "",
    });
    setEditDialogOpen(true);
  };

  const handleUpdateOrder = async () => {
    if (!editingOrder) return;

    try {
      const { error } = await supabase
        .from("orders")
        .update({
          status: editFormData.status,
          notes: editFormData.notes,
        })
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

      if (createFormData.items.some(item => !item.product_name.trim())) {
        toast.error("Barcha mahsulot nomlarini kiriting");
        return;
      }

      const totalAmount = createFormData.items.reduce(
        (sum, item) => sum + (item.price * item.quantity), 
        0
      );

      const { data: orderData, error: orderError } = await supabase
        .from('orders')
        .insert({
          customer_name: createFormData.customer_name,
          customer_phone: createFormData.customer_phone,
          region: createFormData.region,
          district: createFormData.district,
          advance_payment: createFormData.advance_payment,
          notes: createFormData.notes,
          total_amount: totalAmount,
          seller_id: user.id,
          status: 'pending'
        })
        .select()
        .single();

      if (orderError) throw orderError;

      const orderItems = createFormData.items.map(item => ({
        order_id: orderData.id,
        product_name: item.product_name,
        price: item.price,
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
        region: '',
        district: '',
        advance_payment: 0,
        total_amount: 0,
        notes: '',
        items: [{ product_name: '', price: 0, quantity: 1 }]
      });
      fetchOrders();
    } catch (error: any) {
      console.error('Error creating order:', error);
      toast.error("Buyurtma yaratishda xatolik: " + error.message);
    }
  };

  const addOrderItem = () => {
    setCreateFormData({
      ...createFormData,
      items: [...createFormData.items, { product_name: '', price: 0, quantity: 1 }]
    });
  };

  const removeOrderItem = (index: number) => {
    const newItems = createFormData.items.filter((_, i) => i !== index);
    setCreateFormData({ ...createFormData, items: newItems });
  };

  const updateOrderItem = (index: number, field: string, value: any) => {
    const newItems = [...createFormData.items];
    newItems[index] = { ...newItems[index], [field]: value };
    setCreateFormData({ ...createFormData, items: newItems });
  };

  const getStatusBadge = (status: string) => {
    const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
      pending: { label: "Kutilmoqda", variant: "secondary" },
      processing: { label: "Tayyorlanmoqda", variant: "default" },
      shipped: { label: "Yo'lda", variant: "outline" },
      delivered: { label: "Yetkazildi", variant: "default" },
      cancelled: { label: "Bekor qilindi", variant: "destructive" },
    };
    
    const config = statusConfig[status] || { label: status, variant: "secondary" };
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  if (loading) {
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
                    <SelectItem value="pending">Kutilmoqda</SelectItem>
                    <SelectItem value="processing">Tayyorlanmoqda</SelectItem>
                    <SelectItem value="shipped">Yo'lda</SelectItem>
                    <SelectItem value="delivered">Yetkazildi</SelectItem>
                    <SelectItem value="cancelled">Bekor qilindi</SelectItem>
                  </SelectContent>
                </Select>
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
                <TableHead>Mahsulotlar</TableHead>
                <TableHead>Manzil</TableHead>
                <TableHead>Jami summa</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Izoh</TableHead>
                {isAdmin && <TableHead>Amallar</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredOrders.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={isAdmin ? 9 : 8} className="text-center text-muted-foreground">
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
                    <TableCell>
                      <div className="space-y-1">
                        {order.items.map((item, idx) => (
                          <div key={idx} className="text-sm">
                            {item.product_name} x{item.quantity} = {(item.quantity * item.price).toLocaleString()} so'm
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
                    <TableCell>{getStatusBadge(order.status)}</TableCell>
                    <TableCell className="max-w-[200px] truncate">{order.notes}</TableCell>
                    {isAdmin && (
                      <TableCell>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleEdit(order)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => handleDeleteOrder(order.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    )}
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
                  <SelectItem value="pending">Kutilmoqda</SelectItem>
                  <SelectItem value="processing">Tayyorlanmoqda</SelectItem>
                  <SelectItem value="shipped">Yo'lda</SelectItem>
                  <SelectItem value="delivered">Yetkazildi</SelectItem>
                  <SelectItem value="cancelled">Bekor qilindi</SelectItem>
                </SelectContent>
              </Select>
            </div>
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
                <Label htmlFor="customer_name">Mijoz ismi *</Label>
                <Input
                  id="customer_name"
                  value={createFormData.customer_name}
                  onChange={(e) => setCreateFormData({ ...createFormData, customer_name: e.target.value })}
                  placeholder="Mijoz ismi"
                />
              </div>
              <div>
                <Label htmlFor="customer_phone">Telefon raqami</Label>
                <Input
                  id="customer_phone"
                  value={createFormData.customer_phone}
                  onChange={(e) => setCreateFormData({ ...createFormData, customer_phone: e.target.value })}
                  placeholder="+998 XX XXX XX XX"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="region">Viloyat</Label>
                <Select
                  value={createFormData.region}
                  onValueChange={(value) => setCreateFormData({ ...createFormData, region: value })}
                >
                  <SelectTrigger id="region">
                    <SelectValue placeholder="Viloyatni tanlang" />
                  </SelectTrigger>
                  <SelectContent>
                    {regions.map((region) => (
                      <SelectItem key={region} value={region}>
                        {region}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="district">Tuman</Label>
                <Select
                  value={createFormData.district}
                  onValueChange={(value) => setCreateFormData({ ...createFormData, district: value })}
                  disabled={!createFormData.region}
                >
                  <SelectTrigger id="district">
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
            <div>
              <Label>Mahsulotlar *</Label>
              {createFormData.items.map((item, index) => (
                <div key={index} className="grid grid-cols-12 gap-2 mb-2">
                  <Select
                    value={item.product_name}
                    onValueChange={(value) => {
                      const selectedProduct = products.find(p => p.name === value);
                      if (selectedProduct) {
                        updateOrderItem(index, 'product_name', value);
                        updateOrderItem(index, 'price', selectedProduct.price);
                      }
                    }}
                  >
                    <SelectTrigger className="col-span-5">
                      <SelectValue placeholder="Mahsulot tanlang" />
                    </SelectTrigger>
                    <SelectContent>
                      {products.map((product) => (
                        <SelectItem key={product.id} value={product.name}>
                          {product.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input
                    className="col-span-3"
                    type="number"
                    value={item.price}
                    onChange={(e) => updateOrderItem(index, 'price', Number(e.target.value))}
                    placeholder="Narxi"
                  />
                  <Input
                    className="col-span-3"
                    type="number"
                    value={item.quantity}
                    onChange={(e) => updateOrderItem(index, 'quantity', Number(e.target.value))}
                    placeholder="Soni"
                    min="1"
                  />
                  {createFormData.items.length > 1 && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="col-span-1"
                      onClick={() => removeOrderItem(index)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              ))}
              <Button variant="outline" size="sm" onClick={addOrderItem} className="mt-2">
                <Plus className="mr-2 h-4 w-4" />
                Mahsulot qo'shish
              </Button>
            </div>
            <div className="grid grid-cols-2 gap-4">
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
              <div>
                <Label>Jami summa</Label>
                <Input
                  type="number"
                  value={createFormData.total_amount}
                  disabled
                  className="bg-muted"
                />
              </div>
            </div>
            <div className="p-3 bg-muted rounded-md">
              <p className="text-sm font-medium">
                Qolgan summa: <span className="text-lg font-bold">{(createFormData.total_amount - createFormData.advance_payment).toLocaleString()} so'm</span>
              </p>
            </div>
            <div>
              <Label htmlFor="notes">Izoh</Label>
              <Textarea
                id="notes"
                value={createFormData.notes}
                onChange={(e) => setCreateFormData({ ...createFormData, notes: e.target.value })}
                placeholder="Qo'shimcha ma'lumot"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
              Bekor qilish
            </Button>
            <Button onClick={handleCreateOrder}>
              Yaratish
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
};

export default AllOrders;
