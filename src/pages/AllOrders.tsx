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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Calendar, Plus, Trash2, Search } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

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
  const [dialogOpen, setDialogOpen] = useState(false);
  const [startDate, setStartDate] = useState<Date>();
  const [endDate, setEndDate] = useState<Date>();
  const [searchQuery, setSearchQuery] = useState("");
  const [products, setProducts] = useState<any[]>([]);
  const [items, setItems] = useState<Array<{
    product_id: string;
    product_name: string;
    quantity: string;
    price: string;
  }>>([]);
  const [formData, setFormData] = useState({
    customer_name: "",
    customer_phone: "",
    advance_payment: "",
  });

  useEffect(() => {
    fetchOrders();
    fetchProducts();
  }, []);

  useEffect(() => {
    filterOrders();
  }, [orders, startDate, endDate, searchQuery]);

  const fetchProducts = async () => {
    try {
      const { data, error } = await supabase
        .from("products")
        .select("*")
        .order("name");
      
      if (error) throw error;
      setProducts(data || []);
    } catch (error) {
      console.error("Error fetching products:", error);
    }
  };

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

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(order => 
        order.customer_name.toLowerCase().includes(query) ||
        order.customer_phone?.toLowerCase().includes(query) ||
        order.region?.toLowerCase().includes(query) ||
        order.district?.toLowerCase().includes(query) ||
        order.order_number.toString().includes(query)
      );
    }

    setFilteredOrders(filtered);
  };

  const addProductToOrder = (product: any) => {
    const existingIndex = items.findIndex(item => item.product_id === product.id);
    
    if (existingIndex >= 0) {
      const newItems = [...items];
      newItems[existingIndex].quantity = (parseInt(newItems[existingIndex].quantity) + 1).toString();
      setItems(newItems);
    } else {
      setItems([...items, {
        product_id: product.id,
        product_name: product.name,
        quantity: "1",
        price: product.price.toString()
      }]);
    }
  };

  const removeItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const updateItem = (index: number, field: string, value: string) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], [field]: value };
    setItems(newItems);
  };

  const calculateTotal = () => {
    return items.reduce((sum, item) => {
      return sum + (parseInt(item.quantity) * parseFloat(item.price));
    }, 0);
  };

  const calculateRemaining = () => {
    const total = calculateTotal();
    const advance = parseFloat(formData.advance_payment) || 0;
    return Math.max(0, total - advance);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const totalAmount = calculateTotal();
      const advancePayment = parseFloat(formData.advance_payment) || 0;

      const { data: orderData, error: orderError } = await supabase
        .from("orders")
        .insert({
          seller_id: user.id,
          customer_name: formData.customer_name,
          customer_phone: formData.customer_phone,
          total_amount: totalAmount,
          advance_payment: advancePayment,
          status: "pending",
        })
        .select()
        .single();

      if (orderError) throw orderError;

      const orderItems = items.map(item => ({
        order_id: orderData.id,
        product_name: item.product_name,
        quantity: parseInt(item.quantity),
        price: parseFloat(item.price),
      }));

      const { error: itemsError } = await supabase
        .from("order_items")
        .insert(orderItems);

      if (itemsError) throw itemsError;

      toast.success("Zakaz qo'shildi!");
      closeDialog();
      fetchOrders();
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const closeDialog = () => {
    setDialogOpen(false);
    setFormData({ customer_name: "", customer_phone: "", advance_payment: "" });
    setItems([]);
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      pending: "secondary",
      processing: "default",
      completed: "outline",
      cancelled: "destructive",
    };

    const labels: Record<string, string> = {
      pending: "Kutilmoqda",
      processing: "Jarayonda",
      completed: "Bajarildi",
      cancelled: "Bekor qilindi",
    };

    return (
      <Badge variant={variants[status] || "default"}>
        {labels[status] || status}
      </Badge>
    );
  };

  const calculateTotalSales = () => {
    return filteredOrders.reduce((sum, order) => sum + Number(order.total_amount), 0);
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <div className="text-lg">Yuklanmoqda...</div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex justify-between items-center gap-4">
          <div className="flex-1">
            <h1 className="text-3xl font-bold">Barcha zakazlar</h1>
            <p className="text-muted-foreground mt-1">Barcha vaqtdagi {orders.length} ta zakaz</p>
          </div>
          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="Qidirish..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          <Dialog open={dialogOpen} onOpenChange={(open) => { if (!open) closeDialog(); else setDialogOpen(open); }}>
            <DialogTrigger asChild>
              <Button onClick={closeDialog}><Plus className="h-4 w-4 mr-2" />Yangi zakaz</Button>
            </DialogTrigger>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
              <DialogHeader><DialogTitle>Yangi zakaz yaratish</DialogTitle></DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="customer_name">Mijoz ismi</Label>
                    <Input id="customer_name" value={formData.customer_name} onChange={(e) => setFormData({ ...formData, customer_name: e.target.value })} required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="customer_phone">Telefon</Label>
                    <Input id="customer_phone" value={formData.customer_phone} onChange={(e) => setFormData({ ...formData, customer_phone: e.target.value })} />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="advance_payment">Avans to'lovi (so'm)</Label>
                  <Input id="advance_payment" type="number" min="0" step="0.01" value={formData.advance_payment} onChange={(e) => setFormData({ ...formData, advance_payment: e.target.value })} />
                </div>
                <div className="space-y-3">
                  <Label>Mahsulotlar</Label>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2 max-h-48 overflow-y-auto p-2 border rounded-lg">
                    {products.map((product) => (
                      <Button key={product.id} type="button" variant="outline" className="h-auto py-3 flex flex-col items-start" onClick={() => addProductToOrder(product)}>
                        <span className="font-medium text-sm">{product.name}</span>
                        <span className="text-xs text-muted-foreground">{parseFloat(product.price).toLocaleString()} so'm</span>
                      </Button>
                    ))}
                  </div>
                  {items.length > 0 && (
                    <div className="space-y-2 mt-4">
                      {items.map((item, index) => (
                        <Card key={index}>
                          <CardContent className="p-4">
                            <div className="flex items-center gap-2">
                              <Button type="button" variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => removeItem(index)}>
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                              <div className="grid grid-cols-4 gap-2 flex-1 items-center">
                                <div className="space-y-1 col-span-1">
                                  <Label className="text-xs">Mahsulot</Label>
                                  <div className="text-sm font-medium line-clamp-1">{item.product_name}</div>
                                </div>
                                <div className="space-y-1">
                                  <Label htmlFor={`price-${index}`} className="text-xs">Narxi</Label>
                                  <Input id={`price-${index}`} type="number" min="0" step="0.01" value={item.price} onChange={(e) => updateItem(index, "price", e.target.value)} className="h-8" required />
                                </div>
                                <div className="space-y-1">
                                  <Label htmlFor={`quantity-${index}`} className="text-xs">Soni</Label>
                                  <Input id={`quantity-${index}`} type="number" min="1" value={item.quantity} onChange={(e) => updateItem(index, "quantity", e.target.value)} className="h-8" required />
                                </div>
                                <div className="space-y-1">
                                  <Label className="text-xs">Jami</Label>
                                  <div className="h-8 flex items-center text-sm font-semibold">{(parseInt(item.quantity) * parseFloat(item.price)).toLocaleString()} so'm</div>
                                </div>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}
                  {items.length > 0 && (
                    <div className="space-y-2 bg-muted p-4 rounded-lg">
                      <div className="flex justify-between text-sm">
                        <span>Jami summa:</span>
                        <span className="font-semibold">{calculateTotal().toLocaleString()} so'm</span>
                      </div>
                      {formData.advance_payment && parseFloat(formData.advance_payment) > 0 && (
                        <>
                          <div className="flex justify-between text-sm">
                            <span>Avans:</span>
                            <span className="font-semibold text-primary">-{parseFloat(formData.advance_payment).toLocaleString()} so'm</span>
                          </div>
                          <div className="flex justify-between text-base font-bold border-t pt-2">
                            <span>Qolgan summa:</span>
                            <span className="text-primary">{calculateRemaining().toLocaleString()} so'm</span>
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </div>
                <Button type="submit" className="w-full" disabled={items.length === 0}>Saqlash</Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>
        <Card>
          <CardHeader><CardTitle>Filtr</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Boshlanish sanasi</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full justify-start"><Calendar className="mr-2 h-4 w-4" />{startDate ? format(startDate, "PPP") : "Tanlang"}</Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0"><CalendarComponent mode="single" selected={startDate} onSelect={setStartDate} /></PopoverContent>
                </Popover>
              </div>
              <div className="space-y-2">
                <Label>Tugash sanasi</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full justify-start"><Calendar className="mr-2 h-4 w-4" />{endDate ? format(endDate, "PPP") : "Tanlang"}</Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0"><CalendarComponent mode="single" selected={endDate} onSelect={setEndDate} /></PopoverContent>
                </Popover>
              </div>
            </div>
            {(startDate || endDate) && (
              <Button variant="outline" onClick={() => { setStartDate(undefined); setEndDate(undefined); }}>Filtrni tozalash</Button>
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
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredOrders.length === 0 ? (
                <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground">Zakazlar topilmadi</TableCell></TableRow>
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
                          <div key={idx} className="text-sm">{item.product_name} x{item.quantity} = {(item.quantity * item.price).toLocaleString()} so'm</div>
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
                    <TableCell className="font-semibold">{Number(order.total_amount).toLocaleString()} so'm</TableCell>
                    <TableCell>{getStatusBadge(order.status)}</TableCell>
                    <TableCell className="max-w-[200px] truncate">{order.notes}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
        {filteredOrders.length > 0 && (
          <Card>
            <CardContent className="p-6">
              <div className="flex justify-between items-center">
                <span className="text-lg font-semibold">Jami savdo:</span>
                <span className="text-2xl font-bold text-primary">{calculateTotalSales().toLocaleString()} so'm</span>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
};

export default AllOrders;
