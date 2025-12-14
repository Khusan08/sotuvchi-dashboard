import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
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
    <div className="flex flex-col h-full min-w-[320px]">
      <div className={`p-4 rounded-t-lg ${color}`}>
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-white">{title}</h2>
          <Badge variant="secondary" className="bg-white/20 text-white border-0">
            {leads.length}
          </Badge>
        </div>
      </div>
      
      <Card className="flex-1 rounded-t-none border-t-0 overflow-hidden">
        <ScrollArea className="h-[calc(100vh-280px)]">
          <div
            ref={setNodeRef}
            className="p-3 space-y-3"
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
              <div className="flex items-center justify-center h-32 text-muted-foreground text-sm">
                Lidlar yo'q
              </div>
            )}
          </div>
        </ScrollArea>
      </Card>
    </div>
  );
};

export default LeadColumn;
