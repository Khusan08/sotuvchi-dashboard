import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Filter } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

const Leads = () => {
  const [leads, setLeads] = useState<any[]>([]);
  const [filteredLeads, setFilteredLeads] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterSource, setFilterSource] = useState<string>("all");
  
  const [formData, setFormData] = useState({
    customer_name: "",
    customer_phone: "",
    activity: "",
    employee: "",
    lead_type: "",
    notes: "",
    price: "",
  });

  useEffect(() => {
    fetchLeads();
  }, []);

  useEffect(() => {
    filterLeads();
  }, [leads, filterStatus, filterSource]);

  const fetchLeads = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from("leads")
        .select("*")
        .eq("seller_id", user.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setLeads(data || []);
    } catch (error) {
      console.error("Error fetching leads:", error);
      toast.error("Lidlarni yuklashda xato");
    } finally {
      setLoading(false);
    }
  };

  const filterLeads = () => {
    let filtered = [...leads];

    if (filterStatus !== "all") {
      filtered = filtered.filter(lead => lead.status === filterStatus);
    }

    if (filterSource !== "all") {
      filtered = filtered.filter(lead => lead.source === filterSource);
    }

    setFilteredLeads(filtered);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { error } = await supabase.from("leads").insert({
        seller_id: user.id,
        customer_name: formData.customer_name,
        customer_phone: formData.customer_phone,
        activity: formData.activity,
        employee: formData.employee,
        lead_type: formData.lead_type,
        notes: formData.notes,
        price: formData.price ? parseFloat(formData.price) : null,
        status: "new",
      });

      if (error) throw error;

      toast.success("Lid muvaffaqiyatli qo'shildi!");
      setDialogOpen(false);
      setFormData({
        customer_name: "",
        customer_phone: "",
        activity: "",
        employee: "",
        lead_type: "",
        notes: "",
        price: "",
      });
      fetchLeads();
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const updateLeadStatus = async (leadId: string, newStatus: string) => {
    try {
      const { error } = await supabase
        .from("leads")
        .update({ status: newStatus })
        .eq("id", leadId);

      if (error) throw error;

      toast.success("Lid statusi yangilandi!");
      fetchLeads();
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, any> = {
      new: { variant: "secondary", label: "Yangi" },
      contacted: { variant: "default", label: "Bog'lanildi" },
      qualified: { variant: "default", label: "Malakali" },
      converted: { variant: "default", label: "Konvert" },
      lost: { variant: "destructive", label: "Yo'qoldi" },
    };
    
    const config = variants[status] || variants.new;
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
            <h2 className="text-3xl font-bold tracking-tight">Lidlar</h2>
            <p className="text-muted-foreground mt-2">
              Barcha lidlaringizni boshqaring
            </p>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Yangi lid
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Yangi lid qo'shish</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="customer_name">Ism</Label>
                  <Input
                    id="customer_name"
                    value={formData.customer_name}
                    onChange={(e) => setFormData({ ...formData, customer_name: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="customer_phone">Nomer</Label>
                  <Input
                    id="customer_phone"
                    value={formData.customer_phone}
                    onChange={(e) => setFormData({ ...formData, customer_phone: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="activity">Faoliyat</Label>
                  <Input
                    id="activity"
                    value={formData.activity}
                    onChange={(e) => setFormData({ ...formData, activity: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="employee">Xodim</Label>
                  <Input
                    id="employee"
                    value={formData.employee}
                    onChange={(e) => setFormData({ ...formData, employee: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lead_type">Lead</Label>
                  <Input
                    id="lead_type"
                    value={formData.lead_type}
                    onChange={(e) => setFormData({ ...formData, lead_type: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="price">Narx</Label>
                  <Input
                    id="price"
                    type="number"
                    value={formData.price}
                    onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="notes">Izoh</Label>
                  <Textarea
                    id="notes"
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    rows={3}
                  />
                </div>
                <Button type="submit" className="w-full">
                  Saqlash
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4 mb-4">
              <Filter className="h-5 w-5 text-muted-foreground" />
              <div className="flex gap-4 flex-1">
                <Select value={filterStatus} onValueChange={setFilterStatus}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Barcha statuslar</SelectItem>
                    <SelectItem value="new">Yangi</SelectItem>
                    <SelectItem value="contacted">Bog'landi</SelectItem>
                    <SelectItem value="qualified">Malakali</SelectItem>
                    <SelectItem value="converted">O'tkazildi</SelectItem>
                    <SelectItem value="lost">Yo'qoldi</SelectItem>
                  </SelectContent>
                </Select>

                {filterStatus !== "all" && (
                  <Button 
                    variant="outline" 
                    onClick={() => setFilterStatus("all")}
                  >
                    Tozalash
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Ism</TableHead>
                    <TableHead>Nomer</TableHead>
                    <TableHead>Faoliyat</TableHead>
                    <TableHead>Xodim</TableHead>
                    <TableHead>Lead</TableHead>
                    <TableHead>Izoh</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Narx</TableHead>
                    <TableHead>Amallar</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredLeads.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={9} className="text-center text-muted-foreground py-8">
                        Lidlar topilmadi
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredLeads.map((lead) => (
                      <TableRow key={lead.id}>
                        <TableCell className="font-medium">{lead.customer_name}</TableCell>
                        <TableCell>{lead.customer_phone || "-"}</TableCell>
                        <TableCell>{lead.activity || "-"}</TableCell>
                        <TableCell>{lead.employee || "-"}</TableCell>
                        <TableCell>{lead.lead_type || "-"}</TableCell>
                        <TableCell className="max-w-xs truncate">{lead.notes || "-"}</TableCell>
                        <TableCell>{getStatusBadge(lead.status)}</TableCell>
                        <TableCell>{lead.price ? `${Number(lead.price).toLocaleString()} so'm` : "-"}</TableCell>
                        <TableCell>
                          <Select 
                            value={lead.status} 
                            onValueChange={(value) => updateLeadStatus(lead.id, value)}
                          >
                            <SelectTrigger className="w-32">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="new">Yangi</SelectItem>
                              <SelectItem value="contacted">Bog'landi</SelectItem>
                              <SelectItem value="qualified">Malakali</SelectItem>
                              <SelectItem value="converted">O'tkazildi</SelectItem>
                              <SelectItem value="lost">Yo'qoldi</SelectItem>
                            </SelectContent>
                          </Select>
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

export default Leads;
