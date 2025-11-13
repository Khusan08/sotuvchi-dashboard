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
import { Plus, Calendar } from "lucide-react";
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
  const [startDate, setStartDate] = useState<Date>();
  const [endDate, setEndDate] = useState<Date>();
  const [filterStatus, setFilterStatus] = useState<string>("all");
  
  const [items, setItems] = useState<Array<{
    product_name: string;
    quantity: string;
    price: string;
  }>>([
    { product_name: "", quantity: "1", price: "" }
  ]);
  
  const [formData, setFormData] = useState({
    customer_name: "",
    customer_phone: "",
  });

  useEffect(() => {
    fetchOrders();
  }, []);

  useEffect(() => {
    filterOrders();
  }, [orders, startDate, endDate, filterStatus]);

  const fetchOrders = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from("orders")
        .select("*")
        .eq("seller_id", user.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setOrders(data || []);
    } catch (error) {
      console.error("Error fetching orders:", error);
      toast.error("Zakazlarni yuklashda xato");
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

    if (filterStatus !== "all") {
      filtered = filtered.filter(order => order.status === filterStatus);
    }

    setFilteredOrders(filtered);
  };

  const addItem = () => {
    setItems([...items, { product_name: "", quantity: "1", price: "" }]);
  };

  const removeItem = (index: number) => {
    if (items.length > 1) {
      setItems(items.filter((_, i) => i !== index));
    }
  };

  const updateItem = (index: number, field: string, value: string) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], [field]: value };
    setItems(newItems);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Create multiple orders for each item
      const orders = items.map(item => {
        const quantity = parseInt(item.quantity);
        const price = parseFloat(item.price);
        const total = quantity * price;

        return {
          seller_id: user.id,
          customer_name: formData.customer_name,
          customer_phone: formData.customer_phone,
          product_name: item.product_name,
          quantity,
          price,
          total_amount: total,
          status: "pending",
        };
      });

      const { error } = await supabase.from("orders").insert(orders);

      if (error) throw error;

      toast.success(`${orders.length} ta zakaz qo'shildi!`);
      setDialogOpen(false);
      setFormData({
        customer_name: "",
        customer_phone: "",
      });
      setItems([{ product_name: "", quantity: "1", price: "" }]);
      fetchOrders();
    } catch (error: any) {
      toast.error(error.message);
    }
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
            <h2 className="text-3xl font-bold tracking-tight">Zakazlar</h2>
            <p className="text-muted-foreground mt-2">
              Barcha zakazlaringizni boshqaring
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

                <div className="space-y-3 border-t pt-4">
                  <div className="flex items-center justify-between">
                    <Label>Mahsulotlar</Label>
                    <Button type="button" size="sm" variant="outline" onClick={addItem}>
                      <Plus className="h-3 w-3 mr-1" />
                      Mahsulot qo'shish
                    </Button>
                  </div>
                  
                  {items.map((item, index) => (
                    <Card key={index} className="p-4">
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium">Mahsulot {index + 1}</span>
                          {items.length > 1 && (
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              onClick={() => removeItem(index)}
                            >
                              O'chirish
                            </Button>
                          )}
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor={`product_${index}`}>Mahsulot nomi</Label>
                          <Input
                            id={`product_${index}`}
                            value={item.product_name}
                            onChange={(e) => updateItem(index, "product_name", e.target.value)}
                            required
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-2">
                            <Label htmlFor={`quantity_${index}`}>Soni</Label>
                            <Input
                              id={`quantity_${index}`}
                              type="number"
                              min="1"
                              value={item.quantity}
                              onChange={(e) => updateItem(index, "quantity", e.target.value)}
                              required
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor={`price_${index}`}>Narxi (so'm)</Label>
                            <Input
                              id={`price_${index}`}
                              type="number"
                              min="0"
                              step="0.01"
                              value={item.price}
                              onChange={(e) => updateItem(index, "price", e.target.value)}
                              required
                            />
                          </div>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
                
                <Button type="submit" className="w-full">
                  Saqlash
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
                    <TableHead>Mahsulot</TableHead>
                    <TableHead>Soni</TableHead>
                    <TableHead>Narxi</TableHead>
                    <TableHead>Jami</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredOrders.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
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
                        <TableCell>{order.product_name}</TableCell>
                        <TableCell>{order.quantity}</TableCell>
                        <TableCell>{parseFloat(String(order.price)).toLocaleString()} so'm</TableCell>
                        <TableCell className="font-medium">
                          {parseFloat(String(order.total_amount)).toLocaleString()} so'm
                        </TableCell>
                        <TableCell>{getStatusBadge(order.status)}</TableCell>
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
