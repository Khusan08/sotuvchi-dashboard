import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Phone, User, DollarSign, Facebook } from "lucide-react";
import { format } from "date-fns";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import StageChangeDialog from "./StageChangeDialog";

// Stages that don't require comment/task for stage change
const EXEMPT_STAGE_NAMES = ["Sotildi", "Olmaydi", "Ko'tarmagan"];

interface LeadCardProps {
  lead: any;
  isDragging?: boolean;
  onClick?: () => void;
  stage?: any;
  stages?: any[];
  onStageChange?: (leadId: string, newStageId: string, skipDialog?: boolean) => void;
  onLeadUpdate?: () => void;
}

const DELIVERY_STATUS_OPTIONS = [
  { value: "Jarayonda", label: "Jarayonda", color: "bg-yellow-500" },
  { value: "Tasdiqlandi", label: "Tasdiqlandi", color: "bg-green-500" },
  { value: "Bekor bo'ldi", label: "Bekor bo'ldi", color: "bg-red-500" }
];

const LeadCard = ({ lead, isDragging, onClick, stage, stages, onStageChange, onLeadUpdate }: LeadCardProps) => {
  const [stageChangeDialogOpen, setStageChangeDialogOpen] = useState(false);
  const [pendingStageId, setPendingStageId] = useState<string>("");
  const [pendingStageName, setPendingStageName] = useState<string>("");

  const activityOptions = [
    "O'ylab ko'radi",
    "Mavjud emas",
    "Qimmatlik qildi",
    "Telegramdan ma'lumot",
    "Hozir gaplashaolmaydi",
    "Keyinroq oladi",
    "O'chiq",
    "Umid bor"
  ];

  const handleStageChange = (newStageId: string) => {
    if (!stages) return;
    
    const targetStage = stages.find(s => s.id === newStageId);
    if (!targetStage) return;

    // Check if target stage is exempt (Sotildi, Olmaydi, Ko'tarmagan)
    if (EXEMPT_STAGE_NAMES.includes(targetStage.name)) {
      // Direct change without dialog
      if (onStageChange) {
        onStageChange(lead.id, newStageId, true);
      }
    } else {
      // Show dialog for comment/task requirement
      setPendingStageId(newStageId);
      setPendingStageName(targetStage.name);
      setStageChangeDialogOpen(true);
    }
  };

  const handleStageChangeConfirm = () => {
    if (onLeadUpdate) {
      onLeadUpdate();
    }
  };

  const handleActionStatusChange = async (newActionStatus: string) => {
    try {
      const { error } = await supabase
        .from("leads")
        .update({ action_status: newActionStatus })
        .eq("id", lead.id);

      if (error) throw error;
      toast.success("Amal yangilandi!");
    } catch (error) {
      console.error("Error updating action status:", error);
      toast.error("Amalni yangilashda xato");
    }
  };

  const handleDeliveryStatusChange = async (newDeliveryStatus: string) => {
    try {
      const { error } = await supabase
        .from("leads")
        .update({ delivery_status: newDeliveryStatus })
        .eq("id", lead.id);

      if (error) throw error;
      toast.success("Yetkazish holati yangilandi!");
      if (onLeadUpdate) onLeadUpdate();
    } catch (error) {
      console.error("Error updating delivery status:", error);
      toast.error("Yetkazish holatini yangilashda xato");
    }
  };

  // Check if lead is in "Sotildi" stage
  const isSoldStage = stage?.name === "Sotildi" || stages?.find(s => s.id === lead.stage)?.name === "Sotildi";

  return (
    <Card 
      className={`cursor-pointer hover:shadow-lg transition-shadow ${isDragging ? 'opacity-50' : ''}`}
      onClick={onClick}
    >
      <CardContent className="p-4 space-y-3">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="font-semibold text-base">{lead.customer_name}</h3>
              {lead.source?.toLowerCase().includes('facebook') && (
                <Facebook className="h-4 w-4 text-blue-600" />
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              {format(new Date(lead.created_at), 'dd.MM.yyyy HH:mm')}
            </p>
          </div>
          <div className="flex flex-col gap-1 items-end">
            {lead.lead_type && (
              <Badge variant="outline" className="text-xs">
                {lead.lead_type}
              </Badge>
            )}
          </div>
        </div>

        {stages && stages.length > 0 && (
          <div onClick={(e) => e.stopPropagation()}>
            <Select value={lead.stage} onValueChange={handleStageChange}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {stages.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    <div className="flex items-center gap-2">
                      <div className={`w-3 h-3 rounded-full ${s.color}`} />
                      {s.name}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {lead.customer_phone && (
          <div className="flex items-center gap-2 text-sm">
            <Phone className="h-3.5 w-3.5 text-muted-foreground" />
            <span>{lead.customer_phone}</span>
          </div>
        )}

        {lead.profiles?.full_name && (
          <div className="flex items-center gap-2 text-sm">
            <User className="h-3.5 w-3.5 text-muted-foreground" />
            <span>{lead.profiles.full_name}</span>
          </div>
        )}

        {lead.price && (
          <div className="flex items-center gap-2 text-sm font-medium">
            <DollarSign className="h-3.5 w-3.5 text-primary" />
            <span>{lead.price.toLocaleString()} so'm</span>
          </div>
        )}

        {lead.notes && (
          <p className="text-xs text-muted-foreground line-clamp-2 mt-2 pt-2 border-t">
            {lead.notes}
          </p>
        )}

        <div className="mt-2 pt-2 border-t" onClick={(e) => e.stopPropagation()}>
          <label className="text-xs font-medium text-muted-foreground mb-1 block">
            Amallar
          </label>
          <Select value={lead.action_status || ""} onValueChange={handleActionStatusChange}>
            <SelectTrigger className="h-8 text-xs">
              <SelectValue placeholder="Amalni tanlang" />
            </SelectTrigger>
            <SelectContent>
              {activityOptions.map((option) => (
                <SelectItem key={option} value={option}>
                  {option}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Delivery Status - Only for Sotildi stage */}
        {isSoldStage && (
          <div className="mt-2 pt-2 border-t" onClick={(e) => e.stopPropagation()}>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">
              Yetkazish holati
            </label>
            <Select value={lead.delivery_status || ""} onValueChange={handleDeliveryStatusChange}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue placeholder="Holatni tanlang" />
              </SelectTrigger>
              <SelectContent>
                {DELIVERY_STATUS_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    <div className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full ${option.color}`} />
                      {option.label}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Stage Change Dialog */}
        <StageChangeDialog
          open={stageChangeDialogOpen}
          onOpenChange={setStageChangeDialogOpen}
          lead={lead}
          targetStageId={pendingStageId}
          targetStageName={pendingStageName}
          onConfirm={handleStageChangeConfirm}
        />
      </CardContent>
    </Card>
  );
};

export default LeadCard;
