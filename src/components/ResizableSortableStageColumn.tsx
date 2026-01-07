import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { DndContext, DragEndEvent, DragStartEvent, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import ResizableLeadColumn from "./ResizableLeadColumn";

interface ResizableSortableStageColumnProps {
  stage: any;
  leads: any[];
  onLeadClick: (lead: any) => void;
  stages: any[];
  onStageChange: (leadId: string, newStageId: string) => void;
  onRequestStageChange: (leadId: string, newStageId: string) => void;
  onDragStart: (event: DragStartEvent) => void;
  onDragEnd: (event: DragEndEvent) => void;
  onLeadUpdate?: () => void;
  getTasksForLead?: (leadId: string) => any[];
  onTaskUpdate?: () => void;
  columnWidth: number;
  onWidthChange: (width: number) => void;
}

const ResizableSortableStageColumn = ({
  stage,
  leads,
  onLeadClick,
  stages,
  onStageChange,
  onRequestStageChange,
  onDragStart,
  onDragEnd,
  onLeadUpdate,
  getTasksForLead,
  onTaskUpdate,
  columnWidth,
  onWidthChange
}: ResizableSortableStageColumnProps) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: stage.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    width: columnWidth,
  };

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  return (
    <div ref={setNodeRef} style={style} className="shrink-0">
      <div 
        {...attributes} 
        {...listeners}
        className="cursor-grab active:cursor-grabbing mb-2 p-2 bg-muted/50 rounded-lg"
      >
        <h3 className="font-semibold text-center">{stage.name}</h3>
      </div>
      <DndContext
        sensors={sensors}
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
      >
        <ResizableLeadColumn
          stage={stage.id}
          title={stage.name}
          leads={leads.filter((lead) => lead.stage === stage.id)}
          color={stage.color}
          onLeadClick={onLeadClick}
          stageData={stage}
          stages={stages}
          onStageChange={onStageChange}
          onRequestStageChange={onRequestStageChange}
          onLeadUpdate={onLeadUpdate}
          getTasksForLead={getTasksForLead}
          onTaskUpdate={onTaskUpdate}
          columnWidth={columnWidth}
          onWidthChange={onWidthChange}
        />
      </DndContext>
    </div>
  );
};

export default ResizableSortableStageColumn;
