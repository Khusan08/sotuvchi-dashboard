import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus, Calendar, Pencil } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const Orders = () => {
  const [orders, setOrders] = useState<any[]>([]);
  const [filteredOrders, setFilteredOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingOrder, setEditingOrder] = useState<any>(null);
  const [startDate, setStartDate] = useState<Date>();
  const [endDate, setEndDate] = useState<Date>();
  const [filterStatus, setFilterStatus] = useState<string>("all");
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
  }, [orders, startDate, endDate, filterStatus]);

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

      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      const { data: ordersData, error: ordersError } = await supabase
        .from("orders")
        .select("*")
        .eq("seller_id", user.id)
        .gte("order_date", format(sevenDaysAgo, "yyyy-MM-dd"))
        .order("created_at", { ascending: false });

      if (ordersError) throw ordersError;

      // Fetch order items for each order
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
    } catch (error) {
      console.error("Error fetching orders:", error);
      toast.error("Zakazlarni yuklashda xato");
    } finally {
      setLoading(false);
    }
  };

  const updateOrderStatus = async (orderId: string, newStatus: string) => {
    try {
      const { error } = await supabase
        .from("orders")
        .update({ status: newStatus })
        .eq("id", orderId);

      if (error) throw error;

      toast.success("Zakaz statusi yangilandi!");
      fetchOrders();
    } catch (error: any) {
      toast.error(error.message);
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

    setFilteredOrders(filtered);
  };

  const addProductToOrder = (product: any) => {
    const existingIndex = items.findIndex(item => item.product_id === product.id);
    
    if (existingIndex >= 0) {
      // Increase quantity if product already added
      const newItems = [...items];
      newItems[existingIndex].quantity = (parseInt(newItems[existingIndex].quantity) + 1).toString();
      setItems(newItems);
    } else {
      // Add new product
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

  const handleEdit = (order: any) => {
    setEditingOrder(order);
    setFormData({
      customer_name: order.customer_name,
      customer_phone: order.customer_phone || "",
      advance_payment: order.advance_payment?.toString() || "0",
    });
    setItems(order.items.map((item: any) => ({
      product_id: item.product_id || "",
      product_name: item.product_name,
      quantity: item.quantity.toString(),
      price: item.price.toString(),
    })));
    setDialogOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const totalAmount = items.reduce((sum, item) => {
        return sum + (parseInt(item.quantity) * parseFloat(item.price));
      }, 0);

      const advancePayment = parseFloat(formData.advance_payment) || 0;

      if (editingOrder) {
        // Update existing order
        const { error: orderError } = await supabase
          .from("orders")
          .update({
            customer_name: formData.customer_name,
            customer_phone: formData.customer_phone,
            total_amount: totalAmount,
            advance_payment: advancePayment,
          })
          .eq("id", editingOrder.id);

        if (orderError) throw orderError;

        // Delete old items
        await supabase
          .from("order_items")
          .delete()
          .eq("order_id", editingOrder.id);

        // Create new items
        const orderItems = items.map(item => ({
          order_id: editingOrder.id,
          product_name: item.product_name,
          quantity: parseInt(item.quantity),
          price: parseFloat(item.price),
        }));

        const { error: itemsError } = await supabase
          .from("order_items")
          .insert(orderItems);

        if (itemsError) throw itemsError;

        toast.success("Zakaz yangilandi!");
      } else {
        // Create single order
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

        // Create order items
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
      }
      
      setDialogOpen(false);
      setEditingOrder(null);
      setFormData({
        customer_name: "",
        customer_phone: "",
        advance_payment: "",
      });
      setItems([]);
      fetchOrders();
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const closeDialog = () => {
    setDialogOpen(false);
    setEditingOrder(null);
    setFormData({
      customer_name: "",
      customer_phone: "",
      advance_payment: "",
    });
    setItems([]);
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, any> = {
      pending: { variant: "secondary", label: "Kutilmoqda" },
      completed: { variant: "default", label: "Bajarildi" },
      cancelled: { variant: "destructive", label: "Bekor qilindi" },
    };
    
    const config = variants[status] || variants.pending;
    return <Badge variant={config.variant}>{config.label}</Badge>;
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
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold">Zakazlar (oxirgi 7 kun)</h1>
            <p className="text-muted-foreground mt-1">
              {filteredOrders.length} ta zakaz
            </p>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Yangi zakaz
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Yangi zakaz qo'shish</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="customer_name">Mijoz ismi</Label>
                  <Input
                    id="customer_name"
                    value={formData.customer_name}
                    onChange={(e) => setFormData({ ...formData, customer_name: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="customer_phone">Telefon</Label>
                  <Input
                    id="customer_phone"
                    value={formData.customer_phone}
                    onChange={(e) => setFormData({ ...formData, customer_phone: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="advance_payment">Avans to'lovi (so'm)</Label>
                  <Input
                    id="advance_payment"
                    type="number"
                    min="0"
                    step="0.01"
                    value={formData.advance_payment}
                    onChange={(e) => setFormData({ ...formData, advance_payment: e.target.value })}
                    placeholder="0"
                  />
                </div>

                <div className="space-y-4 border-t pt-4">
                  <Label>Mahsulotlarni tanlang</Label>
                  
                  {/* Product selection grid */}
                  <div className="grid grid-cols-2 gap-3 max-h-[300px] overflow-y-auto p-1">
                    {products.map((product) => (
                      <Card 
                        key={product.id}
                        className="cursor-pointer hover:border-primary transition-colors overflow-hidden"
                        onClick={() => addProductToOrder(product)}
                      >
                        {product.image_url ? (
                          <div className="aspect-square relative overflow-hidden bg-muted">
                            <img 
                              src={product.image_url} 
                              alt={product.name}
                              className="w-full h-full object-cover"
                            />
                          </div>
                        ) : (
                          <div className="aspect-square bg-muted flex items-center justify-center">
                            <span className="text-muted-foreground text-xs">Rasm yo'q</span>
                          </div>
                        )}
                        <CardContent className="p-3">
                          <h4 className="font-medium text-sm line-clamp-1">{product.name}</h4>
                          <p className="text-xs text-primary font-semibold mt-1">
                            {product.price.toLocaleString()} so'm
                          </p>
                        </CardContent>
                      </Card>
                    ))}
                  </div>

                  {/* Selected products */}
                  {items.length > 0 && (
                    <div className="space-y-2 border-t pt-4">
                      <Label>Tanlangan mahsulotlar</Label>
                      {items.map((item, index) => (
                        <Card key={index} className="p-3">
                          <div className="space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="text-sm font-medium">{item.product_name}</span>
                              <Button
                                type="button"
                                size="sm"
                                variant="ghost"
                                onClick={() => removeItem(index)}
                              >
                                O'chirish
                              </Button>
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                              <div className="space-y-1">
                                <Label htmlFor={`quantity_${index}`} className="text-xs">Soni</Label>
                                <Input
                                  id={`quantity_${index}`}
                                  type="number"
                                  min="1"
                                  value={item.quantity}
                                  onChange={(e) => updateItem(index, "quantity", e.target.value)}
                                  className="h-8"
                                  required
                                />
                              </div>
                              <div className="space-y-1">
                                <Label className="text-xs">Jami</Label>
                                <div className="h-8 flex items-center text-sm font-semibold">
                                  {(parseInt(item.quantity) * parseFloat(item.price)).toLocaleString()} so'm
                                </div>
                              </div>
                            </div>
                          </div>
                        </Card>
                      ))}
                    </div>
                  )}

                  {/* Summary */}
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
                            <span className="font-semibold text-primary">
                              -{parseFloat(formData.advance_payment).toLocaleString()} so'm
                            </span>
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
                
                <Button type="submit" className="w-full" disabled={items.length === 0}>
                  {editingOrder ? "Yangilash" : "Saqlash"}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
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
                <Label>Status</Label>
                <Select value={filterStatus} onValueChange={setFilterStatus}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Barchasi</SelectItem>
                    <SelectItem value="pending">Kutilmoqda</SelectItem>
                    <SelectItem value="completed">Bajarildi</SelectItem>
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

        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Sana</TableHead>
                    <TableHead>Mijoz</TableHead>
                    <TableHead>Mahsulotlar</TableHead>
                    <TableHead>Jami summa</TableHead>
                    <TableHead>Avans</TableHead>
                    <TableHead>Qolgan</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Amallar</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredOrders.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                        Zakazlar topilmadi
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredOrders.map((order) => (
                      <TableRow key={order.id}>
                        <TableCell>{format(new Date(order.order_date), "dd.MM.yyyy")}</TableCell>
                        <TableCell>
                          <div>
                            <div className="font-medium">{order.customer_name}</div>
                            {order.customer_phone && (
                              <div className="text-sm text-muted-foreground">{order.customer_phone}</div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            {order.items && order.items.length > 0 ? (
                              order.items.map((item: any, idx: number) => (
                                <div key={idx} className="text-sm">
                                  {item.product_name} x{item.quantity} = {(item.quantity * item.price).toLocaleString()} so'm
                                </div>
                              ))
                            ) : (
                              <span className="text-muted-foreground">Ma'lumot yo'q</span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="font-medium">
                          {parseFloat(String(order.total_amount)).toLocaleString()} so'm
                        </TableCell>
                        <TableCell>
                          {parseFloat(String(order.advance_payment || 0)).toLocaleString()} so'm
                        </TableCell>
                        <TableCell className="font-semibold">
                          {(parseFloat(String(order.total_amount)) - parseFloat(String(order.advance_payment || 0))).toLocaleString()} so'm
                        </TableCell>
                        <TableCell>
                          <Select 
                            value={order.status} 
                            onValueChange={(value) => updateOrderStatus(order.id, value)}
                          >
                            <SelectTrigger className="w-[140px]">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="pending">Kutilmoqda</SelectItem>
                              <SelectItem value="completed">Bajarildi</SelectItem>
                              <SelectItem value="cancelled">Bekor qilindi</SelectItem>
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleEdit(order)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
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

export default Orders;
