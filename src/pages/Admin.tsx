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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Users, ShoppingCart } from "lucide-react";
import { toast } from "sonner";
import { useUserRoles } from "@/hooks/useUserRoles";
import { useNavigate } from "react-router-dom";
import { Copy } from "lucide-react";

const Admin = () => {
  const { isAdminOrRop, loading: roleLoading } = useUserRoles();
  const navigate = useNavigate();
  const [sellers, setSellers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [credentialsDialogOpen, setCredentialsDialogOpen] = useState(false);
  const [createdCredentials, setCreatedCredentials] = useState({ email: "", password: "" });
  const [formData, setFormData] = useState({
    email: "",
    password: "",
    full_name: "",
    phone: "",
    role: "sotuvchi" as "admin" | "rop" | "sotuvchi",
  });

  useEffect(() => {
    if (!roleLoading && !isAdminOrRop) {
      navigate("/");
      toast.error("Ruxsat yo'q");
    }
  }, [isAdminOrRop, roleLoading, navigate]);

  useEffect(() => {
    if (isAdminOrRop) {
      fetchSellers();
    }
  }, [isAdminOrRop]);

  const fetchSellers = async () => {
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select(`
          *,
          user_roles!inner(role)
        `)
        .eq("user_roles.role", "sotuvchi")
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Fetch order stats for each seller
      const sellersWithStats = await Promise.all(
        (data || []).map(async (seller) => {
          const { data: orders } = await supabase
            .from("orders")
            .select("*")
            .eq("seller_id", seller.id);

          const totalOrders = orders?.length || 0;
          const totalRevenue = orders?.reduce((sum, o) => sum + parseFloat(String(o.total_amount)), 0) || 0;

          return {
            ...seller,
            totalOrders,
            totalRevenue,
          };
        })
      );

      setSellers(sellersWithStats);
    } catch (error) {
      console.error("Error fetching sellers:", error);
      toast.error("Sotuvchilarni yuklashda xato");
    } finally {
      setLoading(false);
    }
  };

  const handleCreateSeller = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-user`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: formData.email,
          password: formData.password,
          full_name: formData.full_name,
          phone: formData.phone,
          role: formData.role,
        }),
      });

      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.error || 'Failed to create seller');
      }

      // Save credentials to show in dialog
      setCreatedCredentials({
        email: formData.email,
        password: formData.password,
      });
      
      toast.success(formData.role === "sotuvchi" ? "Sotuvchi yaratildi!" : formData.role === "rop" ? "ROP yaratildi!" : "Admin yaratildi!");
      setDialogOpen(false);
      setCredentialsDialogOpen(true);
      
      // Reset form
      setFormData({
        email: "",
        password: "",
        full_name: "",
        phone: "",
        role: "sotuvchi",
      });
      fetchSellers();
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setFormData({ email: "", password: "", full_name: "", phone: "", role: "sotuvchi" });
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Nusxalandi!");
  };

  if (roleLoading || loading) {
    return (
      <DashboardLayout>
        <div className="text-center text-muted-foreground">Yuklanmoqda...</div>
      </DashboardLayout>
    );
  }

  if (!isAdminOrRop) {
    return null;
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-3xl font-bold tracking-tight">Admin Panel</h2>
            <p className="text-muted-foreground mt-2">
              Sotuvchilarni boshqarish
            </p>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Yangi sotuvchi
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Yangi sotuvchi yaratish</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleCreateSeller} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="full_name">To'liq ism</Label>
                  <Input
                    id="full_name"
                    value={formData.full_name}
                    onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email (Login)</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Parol</Label>
                  <Input
                    id="password"
                    type="password"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    required
                    minLength={6}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">Telefon</Label>
                  <Input
                    id="phone"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="role">Rol</Label>
                  <Select
                    value={formData.role}
                    onValueChange={(value: "admin" | "rop" | "sotuvchi") =>
                      setFormData({ ...formData, role: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="admin">Admin</SelectItem>
                      <SelectItem value="rop">ROP</SelectItem>
                      <SelectItem value="sotuvchi">Sotuvchi</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button type="submit" className="w-full">
                  Yaratish
                </Button>
              </form>
            </DialogContent>
          </Dialog>

          {/* Credentials Display Dialog */}
          <Dialog open={credentialsDialogOpen} onOpenChange={setCredentialsDialogOpen}>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Yangi sotuvchi ma'lumotlari</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Email (Login)</Label>
                  <div className="flex items-center gap-2">
                    <Input 
                      value={createdCredentials.email} 
                      readOnly 
                      className="flex-1"
                    />
                    <Button
                      type="button"
                      size="icon"
                      variant="outline"
                      onClick={() => copyToClipboard(createdCredentials.email)}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Parol</Label>
                  <div className="flex items-center gap-2">
                    <Input 
                      value={createdCredentials.password} 
                      readOnly 
                      className="flex-1"
                    />
                    <Button
                      type="button"
                      size="icon"
                      variant="outline"
                      onClick={() => copyToClipboard(createdCredentials.password)}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <div className="bg-muted p-3 rounded-md">
                  <p className="text-sm text-muted-foreground">
                    ⚠️ Bu ma'lumotlarni xavfsiz joyda saqlang. Parolni qayta ko'ra olmaysiz.
                  </p>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Jami sotuvchilar
              </CardTitle>
              <Users className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{sellers.length}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Jami zakazlar
              </CardTitle>
              <ShoppingCart className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {sellers.reduce((sum, s) => sum + s.totalOrders, 0)}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Jami daromad
              </CardTitle>
              <ShoppingCart className="h-4 w-4 text-success" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {sellers.reduce((sum, s) => sum + s.totalRevenue, 0).toLocaleString()} so'm
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Sotuvchilar</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Ism</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Telefon</TableHead>
                    <TableHead>Zakazlar</TableHead>
                    <TableHead>Daromad</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sellers.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                        Sotuvchilar topilmadi
                      </TableCell>
                    </TableRow>
                  ) : (
                    sellers.map((seller) => (
                      <TableRow key={seller.id}>
                        <TableCell className="font-medium">{seller.full_name}</TableCell>
                        <TableCell>{seller.id}</TableCell>
                        <TableCell>{seller.phone || "-"}</TableCell>
                        <TableCell>{seller.totalOrders}</TableCell>
                        <TableCell>{seller.totalRevenue.toLocaleString()} so'm</TableCell>
                        <TableCell>
                          <Badge variant="default">Active</Badge>
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

export default Admin;
