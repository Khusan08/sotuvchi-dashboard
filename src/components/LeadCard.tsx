import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Phone, User, DollarSign } from "lucide-react";
import { format } from "date-fns";

interface LeadCardProps {
  lead: any;
  isDragging?: boolean;
}

const LeadCard = ({ lead, isDragging }: LeadCardProps) => {
  return (
    <Card className={`cursor-grab active:cursor-grabbing ${isDragging ? 'opacity-50' : ''}`}>
      <CardContent className="p-4 space-y-3">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <h3 className="font-semibold text-base">{lead.customer_name}</h3>
            <p className="text-xs text-muted-foreground mt-1">
              {format(new Date(lead.created_at), 'dd.MM.yyyy HH:mm')}
            </p>
          </div>
          {lead.lead_type && (
            <Badge variant="outline" className="text-xs">
              {lead.lead_type}
            </Badge>
          )}
        </div>

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
      </CardContent>
    </Card>
  );
};

export default LeadCard;
