import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Filter } from "lucide-react";
import { toast } from "sonner";
import { useUserRoles } from "@/hooks/useUserRoles";
import { DndContext, DragEndEvent, DragOverlay, DragStartEvent, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import LeadColumn from "@/components/LeadColumn";
import LeadCard from "@/components/LeadCard";
import LeadDetailsDialog from "@/components/LeadDetailsDialog";
import StageManagement from "@/components/StageManagement";

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
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [filterLeadType, setFilterLeadType] = useState<string>("all");
  const [filterTimeRange, setFilterTimeRange] = useState<string>("all");
  const [sellers, setSellers] = useState<any[]>([]);
  const [stages, setStages] = useState<any[]>([]);
  const { isAdminOrRop } = useUserRoles();
  const [activeLead, setActiveLead] = useState<any>(null);
  const [selectedLead, setSelectedLead] = useState<any>(null);
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);
  
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );
  
  const [formData, setFormData] = useState({
    customer_name: "",
    customer_phone: "",
    employee: "",
    lead_type: "Yangi lid",
    activity: "",
    notes: "",
    stage: "yengi_mijoz",
  });

  useEffect(() => {
    fetchLeads();
    fetchSellers();
    fetchStages();
  }, []);

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

  const getFilteredLeads = () => {
    let filtered = [...leads];

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

    return filtered;
  };

  const getLeadsByStage = (stage: string) => {
    return getFilteredLeads().filter(lead => lead.stage === stage);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.employee) {
      toast.error("Iltimos, xodimni tanlang");
      return;
    }

    if (!isAdminOrRop) {
      toast.error("Sizda lid qo'shish huquqi yo'q");
      return;
    }

    try {
      const { error } = await supabase.from("leads").insert({
        seller_id: formData.employee,
        customer_name: formData.customer_name,
        customer_phone: formData.customer_phone,
        employee: sellers.find(s => s.id === formData.employee)?.full_name || "",
        lead_type: formData.lead_type,
        notes: formData.notes || null,
        activity: formData.activity || null,
        stage: formData.stage,
      });

      if (error) throw error;

      toast.success("Lid muvaffaqiyatli qo'shildi!");
      setDialogOpen(false);
      setFormData({
        customer_name: "",
        customer_phone: "",
        employee: "",
        lead_type: "Yangi lid",
        activity: "",
        notes: "",
        stage: "yengi_mijoz",
      });
      fetchLeads();
    } catch (error) {
      console.error("Error creating lead:", error);
      toast.error("Lid qo'shishda xato");
    }
  };

  const handleDragStart = (event: DragStartEvent) => {
    const lead = leads.find(l => l.id === event.active.id);
    setActiveLead(lead);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveLead(null);

    if (!over || !isAdminOrRop) return;

    const leadId = active.id as string;
    const newStage = over.id as string;

    const lead = leads.find(l => l.id === leadId);
    if (!lead || lead.stage === newStage) return;

    try {
      const { error } = await supabase
        .from("leads")
        .update({ stage: newStage })
        .eq("id", leadId);

      if (error) throw error;

      toast.success("Lid bosqichi yangilandi!");
      fetchLeads();
    } catch (error) {
      console.error("Error updating lead stage:", error);
      toast.error("Lid bosqichini yangilashda xato");
    }
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
        <h1 className="text-3xl font-bold mb-2">Lidlar Voronkasi</h1>
        <p className="text-muted-foreground">Lidlarni boshqarish va kuzatish</p>
      </div>

      <div className="flex gap-4 mb-6 flex-wrap items-center">
        {isAdminOrRop && (
          <>
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
                    <Label htmlFor="stage">Bosqich *</Label>
                    <Select
                      value={formData.stage}
                      onValueChange={(value) => setFormData({ ...formData, stage: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {stages.map((stage) => (
                          <SelectItem key={stage.id} value={stage.id}>
                            {stage.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="activity">Faoliyat turi</Label>
                    <Input
                      id="activity"
                      type="text"
                      value={formData.activity}
                      onChange={(e) => setFormData({ ...formData, activity: e.target.value })}
                      placeholder="Masalan: Konsultatsiya, Savdo"
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

            <StageManagement onUpdate={fetchStages} />
          </>
        )}

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

          <Select value={filterLeadType} onValueChange={setFilterLeadType}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Lead turi" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Barcha turlar</SelectItem>
              {LEAD_TYPE_OPTIONS.map((type) => (
                <SelectItem key={type} value={type}>
                  {type}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <DndContext
        sensors={sensors}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="flex gap-4 overflow-x-auto pb-4">
          {stages.map((stage) => (
            <LeadColumn
              key={stage.id}
              stage={stage.id}
              title={stage.name}
              leads={getLeadsByStage(stage.id)}
              color={stage.color}
              onLeadClick={(lead) => {
                setSelectedLead(lead);
                setDetailsDialogOpen(true);
              }}
              stageData={stage}
            />
          ))}
        </div>

        <DragOverlay>
          {activeLead ? <LeadCard lead={activeLead} isDragging stage={stages.find(s => s.id === activeLead.stage)} /> : null}
        </DragOverlay>
      </DndContext>

      {selectedLead && (
        <LeadDetailsDialog
          lead={selectedLead}
          open={detailsDialogOpen}
          onOpenChange={setDetailsDialogOpen}
          onUpdate={fetchLeads}
          sellers={sellers}
          stages={stages}
        />
      )}

      {!isAdminOrRop && (
        <div className="mt-4 p-4 bg-muted rounded-lg">
          <p className="text-sm text-muted-foreground">
            Lidlarni faqat ko'rish mumkin. Yaratish va tahrirlash uchun admin yoki ROP huquqi kerak.
          </p>
        </div>
      )}
    </DashboardLayout>
  );
};

export default Leads;
