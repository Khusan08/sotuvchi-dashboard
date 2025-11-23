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
}

const LeadColumn = ({ stage, title, leads, color }: LeadColumnProps) => {
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
        <div
          ref={setNodeRef}
          className="p-3 space-y-3 h-full overflow-y-auto"
          style={{ minHeight: '400px' }}
        >
          <SortableContext items={leads.map(l => l.id)} strategy={verticalListSortingStrategy}>
            {leads.map((lead) => (
              <SortableLeadCard key={lead.id} lead={lead} />
            ))}
          </SortableContext>
          
          {leads.length === 0 && (
            <div className="flex items-center justify-center h-32 text-muted-foreground text-sm">
              Lidlar yo'q
            </div>
          )}
        </div>
      </Card>
    </div>
  );
};

export default LeadColumn;
