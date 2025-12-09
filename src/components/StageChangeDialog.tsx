import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface StageChangeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  leadId: string;
  sellerId: string;
  targetStageId: string;
  targetStageName: string;
  onSuccess: () => void;
}

const StageChangeDialog = ({
  open,
  onOpenChange,
  leadId,
  sellerId,
  targetStageId,
  targetStageName,
  onSuccess
}: StageChangeDialogProps) => {
  const [comment, setComment] = useState("");
  const [taskTitle, setTaskTitle] = useState("");
  const [taskDescription, setTaskDescription] = useState("");
  const [taskDate, setTaskDate] = useState<Date>(new Date());
  const [taskTime, setTaskTime] = useState("12:00");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!comment.trim()) {
      toast.error("Izoh yozish majburiy");
      return;
    }
    if (!taskTitle.trim()) {
      toast.error("Vazifa nomi kiritish majburiy");
      return;
    }

    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("User not found");

      // Add comment
      const { error: commentError } = await supabase.from("lead_comments").insert({
        lead_id: leadId,
        user_id: user.id,
        comment: comment.trim()
      });
      if (commentError) throw commentError;

      // Add task
      const [hours, minutes] = taskTime.split(':');
      const dueDateTime = new Date(taskDate);
      dueDateTime.setHours(parseInt(hours), parseInt(minutes));

      const { error: taskError } = await supabase.from("tasks").insert({
        title: taskTitle.trim(),
        description: taskDescription.trim() || null,
        due_date: dueDateTime.toISOString(),
        seller_id: sellerId,
        lead_id: leadId,
        status: "pending"
      });
      if (taskError) throw taskError;

      // Update lead stage
      const { error: stageError } = await supabase
        .from("leads")
        .update({ stage: targetStageId })
        .eq("id", leadId);
      if (stageError) throw stageError;

      toast.success("Bosqich muvaffaqiyatli o'zgartirildi!");
      
      // Reset form
      setComment("");
      setTaskTitle("");
      setTaskDescription("");
      setTaskDate(new Date());
      setTaskTime("12:00");
      
      onOpenChange(false);
      onSuccess();
    } catch (error) {
      console.error("Error changing stage:", error);
      toast.error("Bosqichni o'zgartirishda xato");
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setComment("");
    setTaskTitle("");
    setTaskDescription("");
    setTaskDate(new Date());
    setTaskTime("12:00");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>"{targetStageName}" bosqichiga o'tkazish</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          <div>
            <Label>Izoh *</Label>
            <Textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Izoh yozing..."
              rows={3}
            />
          </div>

          <div>
            <Label>Vazifa nomi *</Label>
            <Input
              value={taskTitle}
              onChange={(e) => setTaskTitle(e.target.value)}
              placeholder="Vazifa nomini kiriting"
            />
          </div>

          <div>
            <Label>Vazifa tavsifi</Label>
            <Textarea
              value={taskDescription}
              onChange={(e) => setTaskDescription(e.target.value)}
              placeholder="Vazifa tavsifini kiriting"
              rows={2}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Muddat (Sana)</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-start">
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {format(taskDate, 'dd.MM.yyyy')}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={taskDate}
                    onSelect={(date) => date && setTaskDate(date)}
                  />
                </PopoverContent>
              </Popover>
            </div>
            <div>
              <Label>Vaqt</Label>
              <Input
                type="time"
                value={taskTime}
                onChange={(e) => setTaskTime(e.target.value)}
              />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={loading}>
            Bekor qilish
          </Button>
          <Button onClick={handleSubmit} disabled={loading}>
            {loading ? "Saqlanmoqda..." : "Saqlash va o'tkazish"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default StageChangeDialog;
