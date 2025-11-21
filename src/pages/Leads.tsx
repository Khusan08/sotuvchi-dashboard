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
import { Plus, Filter, Copy } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { useUserRoles } from "@/hooks/useUserRoles";

const ACTIVITY_OPTIONS = [
  "Sotildi",
  "Telegramdan malumot",
  "Sifatsiz",
  "Qayta aloqa",
  "Hozir gaplasha olmaydi",
  "Tadbirkor emas",
  "Qimatlik qildi",
  "Keyin oladi",
  "Sotib olib bo'lgan",
  "Ko'tarmadi",
  "O'chirilgan",
];

const LEAD_TYPE_OPTIONS = ["Yangi lid", "Baza"];

const TIME_FILTER_OPTIONS = [
  { value: "all", label: "Barchasi" },
  { value: "1week", label: "1 haftalik" },
  { value: "10days", label: "10 kunlik" },
  { value: "20days", label: "20 kunlik" },
  { value: "monthly", label: "Oylik" },
  { value: "yearly", label: "Yillik" },
];

const Leads = () => {
  const [leads, setLeads] = useState<any[]>([]);
  const [filteredLeads, setFilteredLeads] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [filterActivity, setFilterActivity] = useState<string>("all");
  const [filterLeadType, setFilterLeadType] = useState<string>("all");
  const [filterTimeRange, setFilterTimeRange] = useState<string>("all");
  const [sellers, setSellers] = useState<any[]>([]);
  const [reassignDialogOpen, setReassignDialogOpen] = useState(false);
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);
  const [newSellerId, setNewSellerId] = useState<string>("");
  const { isAdminOrRop } = useUserRoles();
  const [showWebhookInfo, setShowWebhookInfo] = useState(false);
  
  const facebookWebhookUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/facebook-leads-webhook`;

  const copyWebhookUrl = () => {
    navigator.clipboard.writeText(facebookWebhookUrl);
    toast.success("Webhook URL ko'chirildi!");
  };
  
  const [formData, setFormData] = useState({
    customer_name: "",
    customer_phone: "",
    activity: "",
    employee: "",
    lead_type: "Yangi lid",
    price: "",
    notes: "",
  });

  useEffect(() => {
    fetchLeads();
    fetchSellers();
  }, []);

  useEffect(() => {
    filterLeads();
  }, [leads, filterActivity, filterLeadType, filterTimeRange]);

  const fetchLeads = async () => {
    try {
      const { data, error } = await supabase
        .from("leads")
        .select(`
          *,
          profiles:seller_id (
            full_name
          )
        `)
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

  const fetchSellers = async () => {
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name")
        .order("full_name");

      if (error) throw error;
      setSellers(data || []);
    } catch (error) {
      console.error("Error fetching sellers:", error);
    }
  };

  const filterLeads = () => {
    let filtered = [...leads];

    if (filterActivity !== "all") {
      filtered = filtered.filter(lead => lead.activity === filterActivity);
    }

    if (filterLeadType !== "all") {
      filtered = filtered.filter(lead => lead.lead_type === filterLeadType);
    }

    if (filterTimeRange !== "all") {
      const now = new Date();
      let startDate = new Date();

      switch (filterTimeRange) {
        case "1week":
          startDate.setDate(now.getDate() - 7);
          break;
        case "10days":
          startDate.setDate(now.getDate() - 10);
          break;
        case "20days":
          startDate.setDate(now.getDate() - 20);
          break;
        case "monthly":
          startDate.setMonth(now.getMonth() - 1);
          break;
        case "yearly":
          startDate.setFullYear(now.getFullYear() - 1);
          break;
      }

      filtered = filtered.filter(lead => new Date(lead.created_at) >= startDate);
    }

    setFilteredLeads(filtered);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.employee) {
      toast.error("Iltimos, xodimni tanlang");
      return;
    }

    try {
      const { error } = await supabase.from("leads").insert({
        seller_id: formData.employee,
        customer_name: formData.customer_name,
        customer_phone: formData.customer_phone,
        activity: formData.activity,
        employee: sellers.find(s => s.id === formData.employee)?.full_name || "",
        lead_type: formData.lead_type,
        notes: formData.notes || null,
        price: formData.price ? parseFloat(formData.price) : null,
      });

      if (error) throw error;

      toast.success("Lid muvaffaqiyatli qo'shildi!");
      setDialogOpen(false);
      setFormData({
        customer_name: "",
        customer_phone: "",
        activity: "",
        employee: "",
        lead_type: "Yangi lid",
        price: "",
        notes: "",
      });
      fetchLeads();
    } catch (error) {
      console.error("Error creating lead:", error);
      toast.error("Lid qo'shishda xato");
    }
  };

  const handleReassign = async () => {
    if (!selectedLeadId || !newSellerId) {
      toast.error("Iltimos, xodimni tanlang");
      return;
    }

    try {
      const sellerName = sellers.find(s => s.id === newSellerId)?.full_name || "";
      
      const { error } = await supabase
        .from("leads")
        .update({
          seller_id: newSellerId,
          employee: sellerName,
        })
        .eq("id", selectedLeadId);

      if (error) throw error;

      toast.success("Lid muvaffaqiyatli o'tkazildi!");
      setReassignDialogOpen(false);
      setSelectedLeadId(null);
      setNewSellerId("");
      fetchLeads();
    } catch (error) {
      console.error("Error reassigning lead:", error);
      toast.error("Lidni o'tkazishda xato");
    }
  };

  const handleActivityUpdate = async (leadId: string, newActivity: string, currentPrice: number | null) => {
    try {
      const updateData: any = {
        activity: newActivity,
      };

      // If changing to "Sotildi" and no price, keep current price
      // If changing away from "Sotildi", keep the price as is
      if (newActivity === "Sotildi" && !currentPrice) {
        // Optionally, you can prompt for price or keep it null
      }

      const { error } = await supabase
        .from("leads")
        .update(updateData)
        .eq("id", leadId);

      if (error) throw error;

      toast.success("Amal muvaffaqiyatli yangilandi!");
      fetchLeads();
    } catch (error) {
      console.error("Error updating activity:", error);
      toast.error("Amal yangilashda xato");
    }
  };

  const handlePriceUpdate = async (leadId: string, newPrice: string) => {
    try {
      const { error } = await supabase
        .from("leads")
        .update({
          price: newPrice ? parseFloat(newPrice) : null,
        })
        .eq("id", leadId);

      if (error) throw error;

      toast.success("Narx muvaffaqiyatli yangilandi!");
      fetchLeads();
    } catch (error) {
      console.error("Error updating price:", error);
      toast.error("Narx yangilashda xato");
    }
  };

  const handleNotesUpdate = async (leadId: string, newNotes: string) => {
    try {
      const { error } = await supabase
        .from("leads")
        .update({
          notes: newNotes || null,
        })
        .eq("id", leadId);

      if (error) throw error;

      toast.success("Izoh muvaffaqiyatli yangilandi!");
      fetchLeads();
    } catch (error) {
      console.error("Error updating notes:", error);
      toast.error("Izoh yangilashda xato");
    }
  };

  const handleLeadTypeUpdate = async (leadId: string, newLeadType: string) => {
    try {
      const { error } = await supabase
        .from("leads")
        .update({
          lead_type: newLeadType,
        })
        .eq("id", leadId);

      if (error) throw error;

      toast.success("Lead turi muvaffaqiyatli yangilandi!");
      fetchLeads();
    } catch (error) {
      console.error("Error updating lead type:", error);
      toast.error("Lead turi yangilashda xato");
    }
  };

  const handleEmployeeUpdate = async (leadId: string, sellerId: string) => {
    try {
      const seller = sellers.find(s => s.id === sellerId);
      const { error } = await supabase
        .from("leads")
        .update({
          seller_id: sellerId,
          employee: seller?.full_name || null,
        })
        .eq("id", leadId);

      if (error) throw error;

      toast.success("Xodim muvaffaqiyatli yangilandi!");
      fetchLeads();
    } catch (error) {
      console.error("Error updating employee:", error);
      toast.error("Xodim yangilashda xato");
    }
  };

  const getActivityBadge = (activity: string) => {
    const colors: { [key: string]: string } = {
      "Sotildi": "bg-green-500",
      "Telegramdan malumot": "bg-blue-500",
      "Sifatsiz": "bg-red-500",
      "Qayta aloqa": "bg-yellow-500",
      "Hozir gaplasha olmaydi": "bg-orange-500",
      "Tadbirkor emas": "bg-gray-500",
      "Qimatlik qildi": "bg-purple-500",
      "Keyin oladi": "bg-indigo-500",
      "Sotib olib bo'lgan": "bg-pink-500",
    };

    return colors[activity] || "bg-gray-500";
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex justify-center items-center h-64">
          <div className="text-lg">Yuklanmoqda...</div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">Lidlar</h1>
        <p className="text-muted-foreground">Barcha lidlarni boshqarish</p>
      </div>

      <div className="flex gap-4 mb-6 flex-wrap items-center">
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Yangi lid
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Yangi lid qo'shish</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="customer_name">Mijoz ismi *</Label>
                  <Input
                    id="customer_name"
                    value={formData.customer_name}
                    onChange={(e) => setFormData({ ...formData, customer_name: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="customer_phone">Telefon raqami *</Label>
                  <Input
                    id="customer_phone"
                    value={formData.customer_phone}
                    onChange={(e) => setFormData({ ...formData, customer_phone: e.target.value })}
                    required
                  />
                </div>
              </div>


              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="employee">Xodim *</Label>
                  <Select
                    value={formData.employee}
                    onValueChange={(value) => setFormData({ ...formData, employee: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Xodimni tanlang" />
                    </SelectTrigger>
                    <SelectContent>
                      {sellers.map((seller) => (
                        <SelectItem key={seller.id} value={seller.id}>
                          {seller.full_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="lead_type">Lead turi *</Label>
                  <Select
                    value={formData.lead_type}
                    onValueChange={(value) => setFormData({ ...formData, lead_type: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {LEAD_TYPE_OPTIONS.map((type) => (
                        <SelectItem key={type} value={type}>
                          {type}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="activity">Amal</Label>
                  <Select
                    value={formData.activity}
                    onValueChange={(value) => setFormData({ ...formData, activity: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Amalni tanlang" />
                    </SelectTrigger>
                    <SelectContent>
                      {ACTIVITY_OPTIONS.map((activity) => (
                        <SelectItem key={activity} value={activity}>
                          {activity}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="price">Narx (so'm)</Label>
                  <Input
                    id="price"
                    type="number"
                    value={formData.price}
                    onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="notes">Izoh</Label>
                <Textarea
                  id="notes"
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  rows={3}
                />
              </div>

              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                  Bekor qilish
                </Button>
                <Button type="submit">Saqlash</Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>

        <div className="flex gap-2 items-center flex-wrap">
          <Filter className="h-4 w-4 text-muted-foreground" />
          
          <Select value={filterTimeRange} onValueChange={setFilterTimeRange}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Vaqt bo'yicha" />
            </SelectTrigger>
            <SelectContent>
              {TIME_FILTER_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={filterActivity} onValueChange={setFilterActivity}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Amal bo'yicha" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Barchasi</SelectItem>
              {ACTIVITY_OPTIONS.map((activity) => (
                <SelectItem key={activity} value={activity}>
                  {activity}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={filterLeadType} onValueChange={setFilterLeadType}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Lead turi" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Barchasi</SelectItem>
              {LEAD_TYPE_OPTIONS.map((type) => (
                <SelectItem key={type} value={type}>
                  {type}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {isAdminOrRop && (
        <Card className="mb-6 bg-muted/50">
          <CardContent className="p-6">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="text-lg font-semibold mb-1">Facebook Lead Ads Integratsiyasi</h3>
                <p className="text-sm text-muted-foreground">
                  Facebook Lead Ads'dan lidlarni avtomatik import qilish
                </p>
              </div>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => setShowWebhookInfo(!showWebhookInfo)}
              >
                {showWebhookInfo ? "Yashirish" : "Ko'rsatish"}
              </Button>
            </div>

            {showWebhookInfo && (
              <div className="space-y-4">
                <div>
                  <Label className="text-sm font-medium mb-2 block">Webhook URL</Label>
                  <div className="flex gap-2">
                    <Input 
                      value={facebookWebhookUrl} 
                      readOnly 
                      className="font-mono text-sm bg-background"
                    />
                    <Button 
                      variant="outline" 
                      size="icon"
                      onClick={copyWebhookUrl}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                <div className="bg-background p-4 rounded-md space-y-4">
                  <div>
                    <h4 className="font-semibold text-sm mb-3">📋 Facebook Lead Ads integratsiyasini sozlash:</h4>
                    <ol className="list-decimal list-inside space-y-3 text-sm">
                      <li className="text-foreground">
                        <strong>Meta Business Suite</strong>ga kiring: 
                        <a href="https://business.facebook.com" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline ml-1">
                          business.facebook.com
                        </a>
                      </li>
                      
                      <li className="text-foreground">
                        <strong>Instant Forms</strong> (yoki Lead forms) sahifasiga o'ting
                      </li>
                      
                      <li className="text-foreground">
                        O'zingizning formangizni tanlang (masalan: "daraja new", "DarajaLid" va h.k.)
                      </li>
                      
                      <li className="text-foreground">
                        <strong>"Lead Integration"</strong> yoki <strong>"Integrations"</strong> bo'limini oching
                      </li>
                      
                      <li className="text-foreground">
                        <strong>"New integration"</strong> tugmasini bosing
                      </li>
                      
                      <li className="text-foreground">
                        <strong>"CRM"</strong> yoki <strong>"Webhook"</strong> turini tanlang
                      </li>
                      
                      <li className="text-foreground">
                        Quyidagi ma'lumotlarni kiriting:
                        <div className="mt-2 ml-6 space-y-2 bg-muted p-3 rounded">
                          <div>
                            <span className="text-muted-foreground">Webhook URL:</span>
                            <code className="block bg-background px-2 py-1 rounded text-xs mt-1 break-all">
                              {facebookWebhookUrl}
                            </code>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Verify Token:</span>
                            <code className="block bg-background px-2 py-1 rounded text-xs mt-1">
                              lovable_crm_verify_token_2024
                            </code>
                          </div>
                        </div>
                      </li>
                      
                      <li className="text-foreground">
                        <strong>"Test"</strong> tugmasini bosing va test muvaffaqiyatli bo'lishini tekshiring
                      </li>
                      
                      <li className="text-foreground">
                        Integratsiyani <strong>"Save"</strong> qiling va faollashtiring
                      </li>
                    </ol>
                  </div>

                  <div className="border-t pt-4 space-y-2">
                    <h5 className="font-medium text-sm">✅ Qanday ishlaydi:</h5>
                    <ul className="space-y-1.5 text-sm text-muted-foreground">
                      <li>• Foydalanuvchi Facebook/Instagram reklamangizda forma to'ldiradi</li>
                      <li>• Ma'lumotlar avtomatik ravishda bizning tizimga yuboriladi</li>
                      <li>• Lid avtomatik ravishda admin/rop foydalanuvchiga tayinlanadi</li>
                      <li>• Siz darhol Lidlar jadvalida yangi lidni ko'rishingiz mumkin</li>
                    </ul>
                  </div>

                  <div className="border-t pt-4 space-y-2">
                    <h5 className="font-medium text-sm">📊 Qabul qilinadigan maydonlar:</h5>
                    <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                      <div>• full_name / ism</div>
                      <div>• phone_number / telefon</div>
                      <div>• email</div>
                      <div>• activity / amal</div>
                      <div>• price / narx</div>
                      <div>• notes / izoh</div>
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">
                      <strong>Muhim:</strong> Facebook formangizda ushbu maydon nomlari bo'lishi kerak (masalan: full_name, phone_number, email).
                      Tizim avtomatik ravishda ularni to'g'ri joyga joylashtiradi.
                    </p>
                  </div>

                  <div className="bg-blue-500/10 border border-blue-500/20 rounded-md p-3 mt-4">
                    <p className="text-xs text-foreground">
                      <strong>💡 Maslahat:</strong> Agar integratsiya ishlamasa:
                    </p>
                    <ul className="text-xs text-muted-foreground mt-1 ml-4 space-y-1">
                      <li>1. Webhook URL to'g'ri ko'chirilganligini tekshiring</li>
                      <li>2. Verify token xatosiz kiritilganligini tasdiqlang</li>
                      <li>3. Test natijasini qayta sinab ko'ring</li>
                      <li>4. Facebook formangizda test lid yarating va Lidlar jadvalida paydo bo'lishini kuting</li>
                    </ul>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-6">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Sana</TableHead>
                  <TableHead>Mijoz ismi</TableHead>
                  <TableHead>Telefon</TableHead>
                  <TableHead>Xodim</TableHead>
                  <TableHead>Lead turi</TableHead>
                  <TableHead>Amal</TableHead>
                  <TableHead>Narx</TableHead>
                  <TableHead>Izoh</TableHead>
                  {isAdminOrRop && <TableHead>Amallar</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredLeads.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={isAdminOrRop ? 9 : 8} className="text-center text-muted-foreground">
                      Lidlar topilmadi
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredLeads.map((lead) => (
                    <TableRow key={lead.id}>
                      <TableCell>{format(new Date(lead.created_at), "dd.MM.yyyy")}</TableCell>
                      <TableCell className="font-medium">{lead.customer_name}</TableCell>
                      <TableCell>{lead.customer_phone}</TableCell>
                      <TableCell>
                        <Select
                          value={lead.seller_id || ""}
                          onValueChange={(value) => handleEmployeeUpdate(lead.id, value)}
                        >
                          <SelectTrigger className="w-[180px] bg-background border border-input">
                            <SelectValue placeholder="Xodimni tanlang" />
                          </SelectTrigger>
                          <SelectContent>
                            {sellers.map((seller) => (
                              <SelectItem key={seller.id} value={seller.id}>
                                {seller.full_name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <Select
                          value={lead.lead_type || "Yangi lid"}
                          onValueChange={(value) => handleLeadTypeUpdate(lead.id, value)}
                        >
                          <SelectTrigger className="w-[140px] bg-background border border-input">
                            <span>Yangi lid</span>
                          </SelectTrigger>
                          <SelectContent>
                            {LEAD_TYPE_OPTIONS.map((type) => (
                              <SelectItem key={type} value={type}>
                                {type}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <Select
                          value={lead.activity || ""}
                          onValueChange={(value) => handleActivityUpdate(lead.id, value, lead.price)}
                        >
                          <SelectTrigger className="w-[200px] bg-background border border-input">
                            <span>Lid sifati</span>
                          </SelectTrigger>
                          <SelectContent>
                            {ACTIVITY_OPTIONS.map((activity) => (
                              <SelectItem key={activity} value={activity}>
                                {activity}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          value={lead.price || ""}
                          onChange={(e) => {
                            const newPrice = e.target.value;
                            // Update immediately on blur or Enter
                          }}
                          onBlur={(e) => handlePriceUpdate(lead.id, e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              handlePriceUpdate(lead.id, (e.target as HTMLInputElement).value);
                            }
                          }}
                          placeholder="Narx"
                          className="w-[120px]"
                        />
                      </TableCell>
                      <TableCell>
                        <Textarea
                          value={lead.notes || ""}
                          onChange={(e) => {
                            // Update locally for immediate feedback
                            const updatedLeads = leads.map(l => 
                              l.id === lead.id ? { ...l, notes: e.target.value } : l
                            );
                            setLeads(updatedLeads);
                          }}
                          onBlur={(e) => handleNotesUpdate(lead.id, e.target.value)}
                          placeholder="Izoh yozing..."
                          className="w-[200px] min-h-[60px]"
                          rows={2}
                        />
                      </TableCell>
                      {isAdminOrRop && (
                        <TableCell>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setSelectedLeadId(lead.id);
                              setReassignDialogOpen(true);
                            }}
                          >
                            O'tkazish
                          </Button>
                        </TableCell>
                      )}
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={reassignDialogOpen} onOpenChange={setReassignDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Lidni boshqa xodimga o'tkazish</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="new_seller">Yangi xodim</Label>
              <Select value={newSellerId} onValueChange={setNewSellerId}>
                <SelectTrigger>
                  <SelectValue placeholder="Xodimni tanlang" />
                </SelectTrigger>
                <SelectContent>
                  {sellers.map((seller) => (
                    <SelectItem key={seller.id} value={seller.id}>
                      {seller.full_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setReassignDialogOpen(false);
                  setSelectedLeadId(null);
                  setNewSellerId("");
                }}
              >
                Bekor qilish
              </Button>
              <Button onClick={handleReassign}>O'tkazish</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
};

export default Leads;
