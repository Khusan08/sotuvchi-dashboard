import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Trash2, Check } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

interface Task {
  id: string;
  title: string;
  description: string | null;
  due_date: string;
  status: string;
  created_at: string;
  seller_id: string;
  profiles?: {
    full_name: string;
  };
}

const Tasks = () => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [overdueCount, setOverdueCount] = useState(0);
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    due_date: "",
  });

  useEffect(() => {
    fetchTasks();
    requestNotificationPermission();
    checkUpcomingTasks();
    
    // Check for upcoming tasks every minute
    const interval = setInterval(checkUpcomingTasks, 60000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    // Count overdue tasks
    const now = new Date();
    const overdue = tasks.filter(task => 
      task.status === "pending" && new Date(task.due_date) < now
    ).length;
    setOverdueCount(overdue);
  }, [tasks]);

  const requestNotificationPermission = async () => {
    if ("Notification" in window && Notification.permission === "default") {
      await Notification.requestPermission();
    }
  };

  const playNotificationSound = () => {
    // Create a simple beep sound using Web Audio API
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    oscillator.frequency.value = 800;
    oscillator.type = 'sine';
    
    gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);
    
    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.5);
  };

  const checkUpcomingTasks = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const now = new Date();
      const fiveMinutesLater = new Date(now.getTime() + 5 * 60000);

      const { data } = await supabase
        .from("tasks")
        .select("*")
        .eq("seller_id", user.id)
        .eq("status", "pending")
        .gte("due_date", now.toISOString())
        .lte("due_date", fiveMinutesLater.toISOString());

      if (data && data.length > 0) {
        // Play sound for notifications
        playNotificationSound();
        
        if (Notification.permission === "granted") {
          data.forEach((task) => {
            new Notification("Task eslatmasi", {
              body: `"${task.title}" vazifasi tez orada bajarilishi kerak!`,
              icon: "/favicon.ico",
            });
          });
        }
      }
    } catch (error) {
      console.error("Error checking tasks:", error);
    }
  };

  const fetchTasks = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Check if user has admin or rop role
      const { data: rolesData } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id);

      const isAdminOrRop = rolesData?.some(r => r.role === "admin" || r.role === "rop");

      // Build query based on role
      let query = supabase
        .from("tasks")
        .select(`
          *,
          profiles:seller_id(full_name)
        `);

      // If not admin or rop, only show own tasks
      if (!isAdminOrRop) {
        query = query.eq("seller_id", user.id);
      }

      const { data, error } = await query.order("due_date", { ascending: true });

      if (error) throw error;
      setTasks(data || []);
    } catch (error) {
      console.error("Error fetching tasks:", error);
      toast.error("Tasklar yuklanmadi");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Foydalanuvchi topilmadi");

      const { error } = await supabase
        .from("tasks")
        .insert({
          title: formData.title,
          description: formData.description,
          due_date: new Date(formData.due_date).toISOString(),
          seller_id: user.id,
        });

      if (error) throw error;

      toast.success("Task qo'shildi!");
      setDialogOpen(false);
      setFormData({ title: "", description: "", due_date: "" });
      fetchTasks();
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const markAsComplete = async (taskId: string) => {
    try {
      const { error } = await supabase
        .from("tasks")
        .update({ status: "completed" })
        .eq("id", taskId);

      if (error) throw error;

      toast.success("Task bajarildi!");
      fetchTasks();
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const deleteTask = async (taskId: string) => {
    try {
      const { error } = await supabase
        .from("tasks")
        .delete()
        .eq("id", taskId);

      if (error) throw error;

      toast.success("Task o'chirildi!");
      fetchTasks();
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <div className="text-lg">Yuklanmoqda...</div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold">Tasklar</h1>
            <p className="text-muted-foreground mt-1">
              {tasks.filter(t => t.status === "pending").length} ta kutilayotgan task
              {overdueCount > 0 && (
                <span className="ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-destructive text-destructive-foreground animate-pulse">
                  {overdueCount} ta muddat tugagan
                </span>
              )}
            </p>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Task qo'shish
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Yangi task</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <Label htmlFor="title">Sarlavha</Label>
                  <Input
                    id="title"
                    value={formData.title}
                    onChange={(e) =>
                      setFormData({ ...formData, title: e.target.value })
                    }
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="description">Tavsif</Label>
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) =>
                      setFormData({ ...formData, description: e.target.value })
                    }
                  />
                </div>
                <div>
                  <Label htmlFor="due_date">Oxirgi muddat</Label>
                  <Input
                    id="due_date"
                    type="datetime-local"
                    value={formData.due_date}
                    onChange={(e) =>
                      setFormData({ ...formData, due_date: e.target.value })
                    }
                    required
                  />
                </div>
                <Button type="submit" className="w-full">
                  Saqlash
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <div className="grid gap-4">
          {tasks.length === 0 ? (
            <Card>
              <CardContent className="flex items-center justify-center h-32">
                <p className="text-muted-foreground">Tasklar topilmadi</p>
              </CardContent>
            </Card>
          ) : (
            tasks.map((task) => (
              <Card key={task.id} className={task.status === "completed" ? "opacity-60" : ""}>
                <CardContent className="p-4 sm:p-6">
                  <div className="flex flex-col sm:flex-row items-start justify-between gap-4">
                    <div className="flex-1 w-full">
                      <h3 className="text-lg font-semibold mb-2">
                        {task.title}
                      </h3>
                      {task.description && (
                        <p className="text-muted-foreground mb-2">
                          {task.description}
                        </p>
                      )}
                      <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
                        <p className="text-sm text-muted-foreground">
                          Muddat: {format(new Date(task.due_date), "dd.MM.yyyy HH:mm")}
                        </p>
                        {task.profiles?.full_name && (
                          <p className="text-xs text-muted-foreground">
                            Xodim: {task.profiles.full_name}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2 w-full sm:w-auto justify-end">
                      {task.status === "pending" && (
                        <Button
                          size="icon"
                          variant="outline"
                          onClick={() => markAsComplete(task.id)}
                          className="h-10 w-10"
                        >
                          <Check className="h-4 w-4" />
                        </Button>
                      )}
                      <Button
                        size="icon"
                        variant="destructive"
                        onClick={() => deleteTask(task.id)}
                        className="h-10 w-10"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>
    </DashboardLayout>
  );
};

export default Tasks;
