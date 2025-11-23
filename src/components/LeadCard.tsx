import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Phone, User, DollarSign, Facebook } from "lucide-react";
import { format } from "date-fns";

interface LeadCardProps {
  lead: any;
  isDragging?: boolean;
  onClick?: () => void;
  stage?: any;
}

const LeadCard = ({ lead, isDragging, onClick, stage }: LeadCardProps) => {
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
            {stage && (
              <Badge className={`${stage.color} text-white border-0 text-xs`}>
                {stage.name}
              </Badge>
            )}
          </div>
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
