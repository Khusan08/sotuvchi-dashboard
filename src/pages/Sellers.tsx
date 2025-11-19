import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, Users } from "lucide-react";
import { toast } from "sonner";
import { useUserRoles } from "@/hooks/useUserRoles";
import { useNavigate } from "react-router-dom";

interface Seller {
  id: string;
  full_name: string;
  phone: string | null;
  created_at: string;
  roles: string[];
}

const Sellers = () => {
  const [sellers, setSellers] = useState<Seller[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    full_name: "",
    email: "",
    password: "",
    phone: "",
    role: "sotuvchi" as "admin" | "rop" | "sotuvchi"
  });
  const { isAdminOrRop, loading: rolesLoading } = useUserRoles();
  const navigate = useNavigate();

  useEffect(() => {
    if (!rolesLoading && !isAdminOrRop) {
      navigate("/");
      toast.error("Sizda bu sahifaga kirish huquqi yo'q");
      return;
    }
    if (isAdminOrRop) {
      fetchSellers();
    }
  }, [isAdminOrRop, rolesLoading, navigate]);

  const fetchSellers = async () => {
    try {
      const { data: profilesData, error: profilesError } = await supabase
        .from("profiles")
        .select("*")
        .order("created_at", { ascending: false });

      if (profilesError) throw profilesError;

      // Fetch roles for each user
      const sellersWithRoles = await Promise.all(
        (profilesData || []).map(async (profile) => {
          const { data: rolesData } = await supabase
            .from("user_roles")
            .select("role")
            .eq("user_id", profile.id);

          return {
            ...profile,
            roles: rolesData?.map(r => r.role) || []
          };
        })
      );

      setSellers(sellersWithRoles);
    } catch (error: any) {
      toast.error("Xatolik: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      // Create user via Supabase Auth
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
        options: {
          data: {
            full_name: formData.full_name,
            phone: formData.phone,
          }
        }
      });

      if (authError) throw authError;

      if (authData.user) {
        // Update profile with phone
        await supabase
          .from("profiles")
          .update({ phone: formData.phone })
          .eq("id", authData.user.id);

        // Assign role if not sotuvchi (default role is assigned by trigger)
        if (formData.role !== "sotuvchi") {
          await supabase
            .from("user_roles")
            .delete()
            .eq("user_id", authData.user.id);

          await supabase
            .from("user_roles")
            .insert({ user_id: authData.user.id, role: formData.role });
        }

        toast.success("Hodim muvaffaqiyatli qo'shildi!");
        setDialogOpen(false);
        setFormData({ full_name: "", email: "", password: "", phone: "", role: "sotuvchi" });
        fetchSellers();
      }
    } catch (error: any) {
      toast.error("Xatolik: " + error.message);
    }
  };

  const handleDelete = async (sellerId: string) => {
    if (!confirm("Haqiqatan ham bu hodimni o'chirmoqchimisiz?")) return;

    try {
      const { error } = await supabase.auth.admin.deleteUser(sellerId);
      
      if (error) throw error;

      toast.success("Hodim muvaffaqiyatli o'chirildi!");
      fetchSellers();
    } catch (error: any) {
      toast.error("Xatolik: " + error.message);
    }
  };

  const getRoleBadge = (roles: string[]) => {
    return roles.map((role, idx) => {
      const roleConfig: Record<string, { label: string; variant: "default" | "secondary" | "outline" }> = {
        admin: { label: "Admin", variant: "default" },
        rop: { label: "ROP", variant: "secondary" },
        sotuvchi: { label: "Sotuvchi", variant: "outline" }
      };
      const config = roleConfig[role] || { label: role, variant: "outline" };
      return <Badge key={idx} variant={config.variant} className="mr-1">{config.label}</Badge>;
    });
  };

  if (rolesLoading || loading) {
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
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-3">
            <Users className="h-8 w-8 text-primary" />
            <div>
              <h1 className="text-3xl font-bold">Hodimlar</h1>
              <p className="text-muted-foreground">Jami {sellers.length} ta hodim</p>
            </div>
          </div>

          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Yangi hodim
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Yangi hodim qo'shish</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
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
                  <Label htmlFor="email">Email</Label>
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
                    placeholder="+998901234567"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="role">Lavozim</Label>
                  <select
                    id="role"
                    value={formData.role}
                    onChange={(e) => setFormData({ ...formData, role: e.target.value as any })}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  >
                    <option value="sotuvchi">Sotuvchi</option>
                    <option value="rop">ROP</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>
                <Button type="submit" className="w-full">Saqlash</Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Ism</TableHead>
                  <TableHead>Telefon</TableHead>
                  <TableHead>Lavozim</TableHead>
                  <TableHead>Qo'shilgan sana</TableHead>
                  <TableHead className="text-right">Amallar</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sellers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                      Hodimlar topilmadi
                    </TableCell>
                  </TableRow>
                ) : (
                  sellers.map((seller) => (
                    <TableRow key={seller.id}>
                      <TableCell className="font-medium">{seller.full_name}</TableCell>
                      <TableCell>{seller.phone || "-"}</TableCell>
                      <TableCell>{getRoleBadge(seller.roles)}</TableCell>
                      <TableCell>{new Date(seller.created_at).toLocaleDateString("uz-UZ")}</TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(seller.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default Sellers;
