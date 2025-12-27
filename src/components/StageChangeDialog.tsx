import { useState } from "react";
import { format } from "date-fns";
import { CalendarIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

// Stages where task is NOT required (only comment is mandatory)
const TASK_OPTIONAL_STAGE_IDS = [
  "ad598efe-b15f-4809-bdf1-4afcdc9abf42", // Sotildi
  "97dac92a-654a-4ce3-8501-317648f22795", // Keyin oladi
  "adc7a8bf-d7c2-4dc5-b89b-6d1da828ce84", // Sifatsiz
  "dab83451-1ee6-44ec-a16c-ecbf54df8430", // Olmaydi
];

interface StageChangeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  leadId: string;
  leadName: string;
  newStageId: string;
  newStageName: string;
  sellerId: string;
  onSuccess: () => void;
}

export function StageChangeDialog({
  open,
  onOpenChange,
  leadId,
  leadName,
  newStageId,
  newStageName,
  sellerId,
  onSuccess,
}: StageChangeDialogProps) {
  const [comment, setComment] = useState("");
  const [taskTitle, setTaskTitle] = useState("");
  const [taskDescription, setTaskDescription] = useState("");
  const [taskDate, setTaskDate] = useState<Date | undefined>(undefined);
  const [taskTime, setTaskTime] = useState("12:00");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isTaskOptional = TASK_OPTIONAL_STAGE_IDS.includes(newStageId);

  const handleSubmit = async () => {
    if (!comment.trim()) {
      toast.error("Izoh yozish majburiy!");
      return;
    }

    // Task is required only for non-optional stages
    if (!isTaskOptional) {
      if (!taskTitle.trim()) {
        toast.error("Vazifa nomi majburiy!");
        return;
      }

      if (!taskDate) {
        toast.error("Vazifa muddatini tanlang!");
        return;
      }
    }

    setIsSubmitting(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error("Foydalanuvchi topilmadi");
        return;
      }

      // 1. Save comment
      const { error: commentError } = await supabase
        .from("lead_comments")
        .insert({
          lead_id: leadId,
          user_id: user.id,
          comment: comment.trim(),
        });

      if (commentError) {
        console.error("Comment error:", commentError);
        toast.error("Izohni saqlashda xatolik");
        return;
      }

      // 2. Create task with time (only if task fields are filled or required)
      if (taskTitle.trim() && taskDate) {
        // Get user's company_id
        const { data: profile } = await supabase
          .from("profiles")
          .select("company_id")
          .eq("id", user.id)
          .single();

        const [hours, minutes] = taskTime.split(":").map(Number);
        const dueDate = new Date(taskDate);
        dueDate.setHours(hours, minutes, 0, 0);

        const { error: taskError } = await supabase
          .from("tasks")
          .insert({
            lead_id: leadId,
            seller_id: sellerId,
            title: taskTitle.trim(),
            description: taskDescription.trim() || null,
            due_date: dueDate.toISOString(),
            status: "pending",
            company_id: profile?.company_id,
          });

        if (taskError) {
          console.error("Task error:", taskError);
          toast.error("Vazifani yaratishda xatolik");
          return;
        }
      }

      // 3. Update lead stage
      const { error: stageError } = await supabase
        .from("leads")
        .update({ stage: newStageId })
        .eq("id", leadId);

      if (stageError) {
        console.error("Stage error:", stageError);
        toast.error("Bosqichni o'zgartirishda xatolik");
        return;
      }

      toast.success(`Lid "${newStageName}" bosqichiga o'tkazildi`);
      
      // Reset form
      setComment("");
      setTaskTitle("");
      setTaskDescription("");
      setTaskDate(undefined);
      setTaskTime("12:00");
      
      onOpenChange(false);
      onSuccess();
    } catch (error) {
      console.error("Error:", error);
      toast.error("Xatolik yuz berdi");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setComment("");
    setTaskTitle("");
    setTaskDescription("");
    setTaskDate(undefined);
    setTaskTime("12:00");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            Bosqichni o'zgartirish: {leadName}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <p className="text-sm text-muted-foreground">
            "{newStageName}" bosqichiga o'tkazish uchun izoh {!isTaskOptional && "va vazifa qo'shish "}majburiy.
          </p>

          {/* Comment */}
          <div className="space-y-2">
            <Label htmlFor="comment">Izoh *</Label>
            <Textarea
              id="comment"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Izoh yozing..."
              rows={3}
            />
          </div>

          {/* Task Title */}
          <div className="space-y-2">
            <Label htmlFor="taskTitle">Vazifa nomi {!isTaskOptional && "*"}</Label>
            <Input
              id="taskTitle"
              value={taskTitle}
              onChange={(e) => setTaskTitle(e.target.value)}
              placeholder={isTaskOptional ? "Vazifa nomini kiriting (ixtiyoriy)" : "Vazifa nomini kiriting"}
            />
          </div>

          {/* Task Description */}
          <div className="space-y-2">
            <Label htmlFor="taskDescription">Vazifa tavsifi</Label>
            <Textarea
              id="taskDescription"
              value={taskDescription}
              onChange={(e) => setTaskDescription(e.target.value)}
              placeholder="Vazifa tavsifini kiriting (ixtiyoriy)"
              rows={2}
            />
          </div>

          {/* Task Date & Time */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Muddat {!isTaskOptional && "*"}</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !taskDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {taskDate ? format(taskDate, "dd.MM.yyyy") : "Sana tanlang"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={taskDate}
                    onSelect={setTaskDate}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-2">
              <Label htmlFor="taskTime">Vaqt {!isTaskOptional && "*"}</Label>
              <Input
                id="taskTime"
                type="time"
                value={taskTime}
                onChange={(e) => setTaskTime(e.target.value)}
              />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={isSubmitting}>
            Bekor qilish
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting ? "Saqlanmoqda..." : "Saqlash"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
