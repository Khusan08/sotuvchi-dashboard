import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon, AlertCircle } from "lucide-react";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface StageChangeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lead: any;
  targetStageId: string;
  targetStageName: string;
  onConfirm: () => void;
}

// Stages that don't require comment/task
const EXEMPT_STAGES = ["Sotildi", "Olmaydi", "Ko'tarmagan"];

const StageChangeDialog = ({
  open,
  onOpenChange,
  lead,
  targetStageId,
  targetStageName,
  onConfirm
}: StageChangeDialogProps) => {
  const [comment, setComment] = useState("");
  const [taskTitle, setTaskTitle] = useState("");
  const [taskDescription, setTaskDescription] = useState("");
  const [taskDueDate, setTaskDueDate] = useState<Date>(new Date());
  const [taskDueTime, setTaskDueTime] = useState("12:00");
  const [loading, setLoading] = useState(false);

  const isExemptStage = EXEMPT_STAGES.includes(targetStageName);

  const handleSubmit = async () => {
    // Check if all required fields are filled
    if (!isExemptStage) {
      if (!comment.trim()) {
        toast.error("Izoh kiritish majburiy");
        return;
      }
      if (!taskTitle.trim()) {
        toast.error("Vazifa nomi majburiy");
        return;
      }
    }

    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("User not found");

      // Add comment if provided
      if (comment.trim()) {
        const { error: commentError } = await supabase.from("lead_comments").insert({
          lead_id: lead.id,
          user_id: user.id,
          comment: comment.trim()
        });
        if (commentError) throw commentError;
      }

      // Add task if required
      if (taskTitle.trim()) {
        const [hours, minutes] = taskDueTime.split(':');
        const dueDateTime = new Date(taskDueDate);
        dueDateTime.setHours(parseInt(hours), parseInt(minutes));

        const { error: taskError } = await supabase.from("tasks").insert({
          title: taskTitle,
          description: taskDescription || null,
          due_date: dueDateTime.toISOString(),
          seller_id: lead.seller_id,
          lead_id: lead.id,
          status: "pending"
        });
        if (taskError) throw taskError;
      }

      // Update stage
      const { error: stageError } = await supabase
        .from("leads")
        .update({ stage: targetStageId })
        .eq("id", lead.id);
      if (stageError) throw stageError;

      toast.success("Bosqich o'zgartirildi!");
      
      // Reset form
      setComment("");
      setTaskTitle("");
      setTaskDescription("");
      setTaskDueDate(new Date());
      setTaskDueTime("12:00");
      
      onOpenChange(false);
      onConfirm();
    } catch (error) {
      console.error("Error changing stage:", error);
      toast.error("Bosqichni o'zgartirishda xato");
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    setComment("");
    setTaskTitle("");
    setTaskDescription("");
    setTaskDueDate(new Date());
    setTaskDueTime("12:00");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-primary" />
            Bosqichni o'zgartirish
          </DialogTitle>
          <DialogDescription>
            "{lead?.customer_name}" lidini "{targetStageName}" bosqichiga o'tkazish uchun izoh va vazifa qo'shing
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 mt-4">
          {/* Comment Section */}
          <div>
            <Label htmlFor="comment">
              Izoh {!isExemptStage && <span className="text-destructive">*</span>}
            </Label>
            <Textarea
              id="comment"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Izoh kiriting..."
              rows={3}
              className="mt-1"
            />
          </div>

          {/* Task Section */}
          <div className="space-y-3 p-4 bg-muted rounded-lg">
            <h4 className="font-medium">
              Vazifa {!isExemptStage && <span className="text-destructive">*</span>}
            </h4>
            
            <div>
              <Label htmlFor="taskTitle">Vazifa nomi</Label>
              <Input
                id="taskTitle"
                value={taskTitle}
                onChange={(e) => setTaskTitle(e.target.value)}
                placeholder="Masalan: Mijozga qo'ng'iroq qilish"
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor="taskDescription">Tavsif</Label>
              <Textarea
                id="taskDescription"
                value={taskDescription}
                onChange={(e) => setTaskDescription(e.target.value)}
                placeholder="Qo'shimcha ma'lumot (ixtiyoriy)"
                rows={2}
                className="mt-1"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Muddat (Sana)</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full mt-1 justify-start">
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {format(taskDueDate, "dd.MM.yyyy")}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={taskDueDate}
                      onSelect={(date) => date && setTaskDueDate(date)}
                    />
                  </PopoverContent>
                </Popover>
              </div>
              <div>
                <Label htmlFor="taskTime">Muddat (Vaqt)</Label>
                <Input
                  id="taskTime"
                  type="time"
                  value={taskDueTime}
                  onChange={(e) => setTaskDueTime(e.target.value)}
                  className="mt-1"
                />
              </div>
            </div>
          </div>
        </div>

        <DialogFooter className="mt-4">
          <Button variant="outline" onClick={handleCancel} disabled={loading}>
            Bekor qilish
          </Button>
          <Button onClick={handleSubmit} disabled={loading}>
            {loading ? "Saqlanmoqda..." : "Tasdiqlash"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default StageChangeDialog;
