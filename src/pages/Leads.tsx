import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Plus, Filter, Search, Calendar as CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { useUserRoles } from "@/hooks/useUserRoles";
import { DndContext, DragEndEvent, DragOverlay, DragStartEvent, PointerSensor, useSensor, useSensors, closestCenter } from "@dnd-kit/core";
import { SortableContext, horizontalListSortingStrategy, arrayMove } from "@dnd-kit/sortable";
import LeadColumn from "@/components/LeadColumn";
import LeadCard from "@/components/LeadCard";
import LeadDetailsDialog from "@/components/LeadDetailsDialog";
import StageManagement from "@/components/StageManagement";
import SortableStageColumn from "@/components/SortableStageColumn";
import { StageChangeDialog } from "@/components/StageChangeDialog";

const LEAD_TYPE_OPTIONS = ["Yangi lid", "Baza"];

const TIME_FILTER_OPTIONS = [
  { value: "all", label: "Barchasi" },
  { value: "daily", label: "Bugun" },
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
  const [filterSeller, setFilterSeller] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [startDateFilter, setStartDateFilter] = useState<Date | undefined>(undefined);
  const [endDateFilter, setEndDateFilter] = useState<Date | undefined>(undefined);
  const [sellers, setSellers] = useState<any[]>([]);
  const [stages, setStages] = useState<any[]>([]);
  const { isAdminOrRop } = useUserRoles();
  const [activeLead, setActiveLead] = useState<any>(null);
  const [selectedLead, setSelectedLead] = useState<any>(null);
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();
  const [pendingStageChange, setPendingStageChange] = useState<{
    leadId: string;
    leadName: string;
    newStageId: string;
    newStageName: string;
    sellerId: string;
  } | null>(null);

  // Exempt stages - direct change allowed without dialog
  const EXEMPT_STAGE_IDS: string[] = [
    "ad598efe-b15f-4809-bdf1-4afcdc9abf42", // Sotildi
  ];
  
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );
  
const MUHIM_STAGE_ID = "1aa6d478-0e36-4642-b5c5-e2a6b6985c08";
  
  const [formData, setFormData] = useState({
    customer_name: "",
    customer_phone: "",
    employee: "",
    lead_type: "Yangi lid",
    activity: "",
    notes: "",
    stage: MUHIM_STAGE_ID,
    source: "",
  });

  useEffect(() => {
    fetchLeads();
    fetchSellers();
    fetchStages();
  }, []);

  // Handle opening specific lead from URL parameter
  useEffect(() => {
    const openLeadId = searchParams.get('openLead');
    if (openLeadId && leads.length > 0) {
      const leadToOpen = leads.find(l => l.id === openLeadId);
      if (leadToOpen) {
        setSelectedLead(leadToOpen);
        setDetailsDialogOpen(true);
        // Clear the URL parameter after opening
        searchParams.delete('openLead');
        setSearchParams(searchParams, { replace: true });
      }
    }
  }, [leads, searchParams, setSearchParams]);

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

    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(lead => 
        lead.customer_name?.toLowerCase().includes(query) ||
        lead.customer_phone?.toLowerCase().includes(query) ||
        lead.customer_email?.toLowerCase().includes(query) ||
        lead.employee?.toLowerCase().includes(query) ||
        lead.notes?.toLowerCase().includes(query) ||
        lead.activity?.toLowerCase().includes(query) ||
        lead.lead_type?.toLowerCase().includes(query)
      );
    }

    if (filterLeadType !== "all") {
      filtered = filtered.filter(lead => lead.lead_type === filterLeadType);
    }

    if (filterTimeRange !== "all") {
      const now = new Date();
      let startDate = new Date();

      switch (filterTimeRange) {
        case "daily":
          startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
          break;
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

    // Custom date range filter
    if (startDateFilter) {
      const start = new Date(startDateFilter);
      start.setHours(0, 0, 0, 0);
      filtered = filtered.filter(lead => new Date(lead.created_at) >= start);
    }

    if (endDateFilter) {
      const end = new Date(endDateFilter);
      end.setHours(23, 59, 59, 999);
      filtered = filtered.filter(lead => new Date(lead.created_at) <= end);
    }

    // Seller filter
    if (filterSeller !== "all") {
      filtered = filtered.filter(lead => lead.seller_id === filterSeller);
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
      // Get user's company_id
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error("Foydalanuvchi topilmadi");
        return;
      }
      
      const { data: profile } = await supabase
        .from("profiles")
        .select("company_id")
        .eq("id", user.id)
        .single();
      
      if (!profile?.company_id) {
        toast.error("Kompaniya topilmadi");
        return;
      }

      const { error } = await supabase.from("leads").insert({
        seller_id: formData.employee,
        customer_name: formData.customer_name,
        customer_phone: formData.customer_phone,
        employee: sellers.find(s => s.id === formData.employee)?.full_name || "",
        lead_type: formData.lead_type,
        notes: formData.notes || null,
        activity: formData.activity || null,
        stage: formData.stage,
        source: formData.source || null,
        company_id: profile.company_id,
      });

      if (error) {
        // Handle duplicate phone error - open existing lead instead
        if (error.message === "PHONE_ALREADY_EXISTS") {
          // Find existing lead with this phone
          const phoneNorm = formData.customer_phone.replace(/\D/g, "");
          const existingLead = leads.find(
            (l) => l.customer_phone_norm === phoneNorm
          );
          
          if (existingLead) {
            toast.info("Bu telefon raqam allaqachon mavjud. Lid ochildi.");
            setDialogOpen(false);
            setSelectedLead(existingLead);
            setDetailsDialogOpen(true);
          } else {
            // Lead exists but not in current list - refetch and then open
            await fetchLeads();
            toast.info("Bu telefon raqam allaqachon mavjud");
          }
          return;
        }
        throw error;
      }

      toast.success("Lid muvaffaqiyatli qo'shildi!");
      setDialogOpen(false);
      setFormData({
        customer_name: "",
        customer_phone: "",
        employee: "",
        lead_type: "Yangi lid",
        activity: "",
        notes: "",
        stage: MUHIM_STAGE_ID,
        source: "",
      });
      fetchLeads();
    } catch (error: any) {
      console.error("Error creating lead:", error);
      toast.error(error?.message || "Lid qo'shishda xato");
    }
  };

  const handleStageDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    
    if (!over || active.id === over.id) return;

    const oldIndex = stages.findIndex((s) => s.id === active.id);
    const newIndex = stages.findIndex((s) => s.id === over.id);

    const newStages = arrayMove(stages, oldIndex, newIndex);
    setStages(newStages);

    // Update display order in database
    try {
      const updates = newStages.map((stage, index) => ({
        id: stage.id,
        display_order: index + 1
      }));

      for (const update of updates) {
        await supabase
          .from("stages")
          .update({ display_order: update.display_order })
          .eq("id", update.id);
      }

      toast.success("Bosqichlar tartibi yangilandi!");
    } catch (error) {
      console.error("Error updating stage order:", error);
      toast.error("Bosqichlar tartibini yangilashda xato");
      fetchStages(); // Revert on error
    }
  };

  const handleDragStart = (event: DragStartEvent) => {
    const lead = leads.find(l => l.id === event.active.id);
    setActiveLead(lead);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveLead(null);

    if (!over) return;

    const leadId = active.id as string;
    const newStageId = over.id as string;

    const lead = leads.find(l => l.id === leadId);
    if (!lead || lead.stage === newStageId) return;

    const newStage = stages.find(s => s.id === newStageId);
    
    // Check if exempt stage - direct change allowed
    if (EXEMPT_STAGE_IDS.includes(newStageId)) {
      try {
        const { error } = await supabase
          .from("leads")
          .update({ stage: newStageId })
          .eq("id", leadId);

        if (error) throw error;

        toast.success("Lid bosqichi yangilandi!");
        fetchLeads();
      } catch (error) {
        console.error("Error updating lead stage:", error);
        toast.error("Lid bosqichini yangilashda xato");
      }
    } else {
      // Open dialog for mandatory comment and task
      setPendingStageChange({
        leadId: lead.id,
        leadName: lead.customer_name,
        newStageId: newStageId,
        newStageName: newStage?.name || "",
        sellerId: lead.seller_id,
      });
    }
  };

  const handleStageChange = async (leadId: string, newStageId: string) => {
    const lead = leads.find(l => l.id === leadId);
    if (!lead || lead.stage === newStageId) return;

    const newStage = stages.find(s => s.id === newStageId);

    // Check if exempt stage - direct change allowed
    if (EXEMPT_STAGE_IDS.includes(newStageId)) {
      try {
        const { error } = await supabase
          .from("leads")
          .update({ stage: newStageId })
          .eq("id", leadId);

        if (error) throw error;

        toast.success("Lid bosqichi yangilandi!");
        fetchLeads();
      } catch (error) {
        console.error("Error updating lead stage:", error);
        toast.error("Lid bosqichini yangilashda xato");
      }
    } else {
      // Open dialog for mandatory comment and task
      setPendingStageChange({
        leadId: lead.id,
        leadName: lead.customer_name,
        newStageId: newStageId,
        newStageName: newStage?.name || "",
        sellerId: lead.seller_id,
      });
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
        <h1 className="text-2xl sm:text-3xl font-bold mb-2">Lidlar Voronkasi</h1>
        <p className="text-sm sm:text-base text-muted-foreground">Lidlarni boshqarish va kuzatish</p>
      </div>

      {/* Search Bar */}
      <div className="mb-4">
        <Input
          placeholder="Qidirish (ism, telefon, email, izoh, faoliyat...)"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full sm:max-w-md"
        />
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
                    <Label htmlFor="stage">Bosqich</Label>
                    <Select
                      value={formData.stage}
                      onValueChange={(value) => setFormData({ ...formData, stage: value })}
                    >
                      <SelectTrigger>
                        <SelectValue>
                          {(() => {
                            const currentStage = stages.find(s => s.id === formData.stage);
                            return currentStage ? (
                              <div className="flex items-center gap-2">
                                <div className={`w-3 h-3 rounded-full ${currentStage.color}`} />
                                {currentStage.name}
                              </div>
                            ) : "Muhim";
                          })()}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {stages.map((stage) => (
                          <SelectItem key={stage.id} value={stage.id}>
                            <div className="flex items-center gap-2">
                              <div className={`w-3 h-3 rounded-full ${stage.color}`} />
                              {stage.name}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="source">Qayerdan? *</Label>
                    <Select
                      value={formData.source}
                      onValueChange={(value) => setFormData({ ...formData, source: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Manbani tanlang" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Sayt">Sayt</SelectItem>
                        <SelectItem value="Forma">Forma</SelectItem>
                        <SelectItem value="Instagram">Instagram</SelectItem>
                        <SelectItem value="Telegram">Telegram</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
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
          
          <Select value={filterTimeRange} onValueChange={(value) => {
            setFilterTimeRange(value);
            // Reset custom date when using preset
            if (value !== "all") {
              setStartDateFilter(undefined);
              setEndDateFilter(undefined);
            }
          }}>
            <SelectTrigger className="w-[160px]">
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

          {/* Start Date Filter */}
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="w-[140px] justify-start text-left font-normal">
                <CalendarIcon className="mr-2 h-4 w-4" />
                {startDateFilter ? format(startDateFilter, "dd.MM.yyyy") : "Boshlanish"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={startDateFilter}
                onSelect={(date) => {
                  setStartDateFilter(date);
                  setFilterTimeRange("all");
                }}
                initialFocus
              />
            </PopoverContent>
          </Popover>

          {/* End Date Filter */}
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="w-[140px] justify-start text-left font-normal">
                <CalendarIcon className="mr-2 h-4 w-4" />
                {endDateFilter ? format(endDateFilter, "dd.MM.yyyy") : "Tugash"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={endDateFilter}
                onSelect={(date) => {
                  setEndDateFilter(date);
                  setFilterTimeRange("all");
                }}
                initialFocus
              />
            </PopoverContent>
          </Popover>

          {(startDateFilter || endDateFilter) && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setStartDateFilter(undefined);
                setEndDateFilter(undefined);
              }}
            >
              Tozalash
            </Button>
          )}

          <Select value={filterLeadType} onValueChange={setFilterLeadType}>
            <SelectTrigger className="w-[160px]">
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

          {/* Seller Filter */}
          {isAdminOrRop && (
            <Select value={filterSeller} onValueChange={setFilterSeller}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Xodim bo'yicha" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Barcha xodimlar</SelectItem>
                {sellers.map((seller) => (
                  <SelectItem key={seller.id} value={seller.id}>
                    {seller.full_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleStageDragEnd}
      >
        <SortableContext items={stages.map(s => s.id)} strategy={horizontalListSortingStrategy}>
          <div className="flex gap-4 overflow-x-auto pb-4">
            {stages.map((stage) => (
              <SortableStageColumn
                key={stage.id}
                stage={stage}
                leads={getLeadsByStage(stage.id)}
                onLeadClick={(lead) => {
                  setSelectedLead(lead);
                  setDetailsDialogOpen(true);
                }}
                stages={stages}
                onStageChange={handleStageChange}
                onDragStart={handleDragStart}
                onDragEnd={handleDragEnd}
              />
            ))}
          </div>
        </SortableContext>
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

      {/* Stage Change Dialog with mandatory comment and task */}
      {pendingStageChange && (
        <StageChangeDialog
          open={!!pendingStageChange}
          onOpenChange={(open) => !open && setPendingStageChange(null)}
          leadId={pendingStageChange.leadId}
          leadName={pendingStageChange.leadName}
          newStageId={pendingStageChange.newStageId}
          newStageName={pendingStageChange.newStageName}
          sellerId={pendingStageChange.sellerId}
          onSuccess={() => {
            setPendingStageChange(null);
            fetchLeads();
          }}
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
