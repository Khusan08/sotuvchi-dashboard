import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import SortableLeadCard from "./SortableLeadCard";

interface LeadColumnProps {
  stage: string;
  title: string;
  leads: any[];
  color: string;
  onLeadClick?: (lead: any) => void;
  stageData?: any;
  stages?: any[];
  onStageChange?: (leadId: string, newStageId: string) => void;
}

const LeadColumn = ({ stage, title, leads, color, onLeadClick, stageData, stages, onStageChange }: LeadColumnProps) => {
  const { setNodeRef } = useDroppable({ id: stage });

  return (
    <div className="flex flex-col h-full min-w-[280px] sm:min-w-[320px] lg:min-w-[350px]">
      <div className={`p-3 sm:p-4 rounded-t-lg ${color}`}>
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-white text-sm sm:text-base">{title}</h2>
          <Badge variant="secondary" className="bg-white/20 text-white border-0 text-xs sm:text-sm">
            {leads.length}
          </Badge>
        </div>
      </div>
      
      <Card className="flex-1 rounded-t-none border-t-0 overflow-hidden">
        <div
          ref={setNodeRef}
          className="p-2 sm:p-3 space-y-2 sm:space-y-3 h-full overflow-y-auto"
          style={{ minHeight: '400px' }}
        >
          <SortableContext items={leads.map(l => l.id)} strategy={verticalListSortingStrategy}>
            {leads.map((lead) => (
              <SortableLeadCard 
                key={lead.id} 
                lead={lead}
                onClick={() => onLeadClick?.(lead)}
                stage={stageData}
                stages={stages}
                onStageChange={onStageChange}
              />
            ))}
          </SortableContext>
          
          {leads.length === 0 && (
            <div className="flex items-center justify-center h-32 text-muted-foreground text-xs sm:text-sm">
              Lidlar yo'q
            </div>
          )}
        </div>
      </Card>
    </div>
  );
};

export default LeadColumn;
