import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Phone, User, DollarSign, Facebook } from "lucide-react";
import { format } from "date-fns";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface LeadCardProps {
  lead: any;
  isDragging?: boolean;
  onClick?: () => void;
  stage?: any;
  stages?: any[];
  onStageChange?: (leadId: string, newStageId: string) => void;
}

const LeadCard = ({ lead, isDragging, onClick, stage, stages, onStageChange }: LeadCardProps) => {
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
    if (onStageChange) {
      onStageChange(lead.id, newStageId);
    }
  };

  const handleActivityChange = async (newActivity: string) => {
    try {
      const { error } = await supabase
        .from("leads")
        .update({ activity: newActivity })
        .eq("id", lead.id);

      if (error) throw error;
      toast.success("Amal yangilandi!");
    } catch (error) {
      console.error("Error updating activity:", error);
      toast.error("Amalni yangilashda xato");
    }
  };

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
          <Select value={lead.activity || ""} onValueChange={handleActivityChange}>
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
      </CardContent>
    </Card>
  );
};

export default LeadCard;
