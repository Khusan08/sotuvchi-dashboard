import { useState, useRef, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import SortableLeadCard from "./SortableLeadCard";
import { GripVertical } from "lucide-react";

interface ResizableLeadColumnProps {
  stage: string;
  title: string;
  leads: any[];
  color: string;
  onLeadClick?: (lead: any) => void;
  stageData?: any;
  stages?: any[];
  onStageChange?: (leadId: string, newStageId: string) => void;
  onRequestStageChange?: (leadId: string, newStageId: string) => void;
  onLeadUpdate?: () => void;
  getTasksForLead?: (leadId: string) => any[];
  onTaskUpdate?: () => void;
  columnWidth: number;
  onWidthChange: (width: number) => void;
}

const ResizableLeadColumn = ({ 
  stage, 
  title, 
  leads, 
  color, 
  onLeadClick, 
  stageData, 
  stages, 
  onStageChange, 
  onRequestStageChange, 
  onLeadUpdate, 
  getTasksForLead, 
  onTaskUpdate,
  columnWidth,
  onWidthChange
}: ResizableLeadColumnProps) => {
  const { setNodeRef } = useDroppable({ id: stage });
  const [isResizing, setIsResizing] = useState(false);
  const columnRef = useRef<HTMLDivElement>(null);
  const startXRef = useRef(0);
  const startWidthRef = useRef(0);

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsResizing(true);
    startXRef.current = e.clientX;
    startWidthRef.current = columnWidth;
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;
      const diff = e.clientX - startXRef.current;
      const newWidth = Math.max(250, Math.min(500, startWidthRef.current + diff));
      onWidthChange(newWidth);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    if (isResizing) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
    }

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isResizing, onWidthChange]);

  return (
    <div 
      ref={columnRef}
      className="flex flex-col h-full shrink-0 relative"
      style={{ width: columnWidth }}
    >
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
                  onRequestStageChange={onRequestStageChange}
                  onLeadUpdate={onLeadUpdate}
                  tasks={getTasksForLead?.(lead.id) || []}
                  onTaskUpdate={onTaskUpdate}
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

      {/* Resize Handle */}
      <div
        className={`absolute top-0 right-0 w-2 h-full cursor-col-resize group hover:bg-primary/20 transition-colors ${
          isResizing ? "bg-primary/30" : ""
        }`}
        onMouseDown={handleMouseDown}
      >
        <div className="absolute top-1/2 right-0 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity">
          <GripVertical className="h-6 w-6 text-muted-foreground" />
        </div>
      </div>
    </div>
  );
};

export default ResizableLeadColumn;
