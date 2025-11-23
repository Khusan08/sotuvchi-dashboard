import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import LeadCard from "./LeadCard";

interface SortableLeadCardProps {
  lead: any;
  onClick?: () => void;
  stage?: any;
}

const SortableLeadCard = ({ lead, onClick, stage }: SortableLeadCardProps) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: lead.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div 
      ref={setNodeRef} 
      style={style} 
      {...attributes} 
      {...listeners}
      onClick={(e) => {
        e.stopPropagation();
        onClick?.();
      }}
    >
      <LeadCard lead={lead} isDragging={isDragging} onClick={onClick} stage={stage} />
    </div>
  );
};

export default SortableLeadCard;
