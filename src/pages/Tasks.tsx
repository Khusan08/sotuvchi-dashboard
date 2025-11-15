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
}

const Tasks = () => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
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

  const requestNotificationPermission = async () => {
    if ("Notification" in window && Notification.permission === "default") {
      await Notification.requestPermission();
    }
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

      if (data && data.length > 0 && Notification.permission === "granted") {
        data.forEach((task) => {
          new Notification("Task eslatmasi", {
            body: `"${task.title}" vazifasi tez orada bajarilishi kerak!`,
            icon: "/favicon.ico",
          });
        });
      }
    } catch (error) {
      console.error("Error checking tasks:", error);
    }
  };

  const fetchTasks = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from("tasks")
        .select("*")
        .eq("seller_id", user.id)
        .order("due_date", { ascending: true });

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
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold">Tasklar</h1>
            <p className="text-muted-foreground mt-1">
              {tasks.filter(t => t.status === "pending").length} ta kutilayotgan task
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
                <CardContent className="p-6">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold mb-2">
                        {task.title}
                      </h3>
                      {task.description && (
                        <p className="text-muted-foreground mb-2">
                          {task.description}
                        </p>
                      )}
                      <p className="text-sm text-muted-foreground">
                        Muddat: {format(new Date(task.due_date), "dd.MM.yyyy HH:mm")}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      {task.status === "pending" && (
                        <Button
                          size="icon"
                          variant="outline"
                          onClick={() => markAsComplete(task.id)}
                        >
                          <Check className="h-4 w-4" />
                        </Button>
                      )}
                      <Button
                        size="icon"
                        variant="destructive"
                        onClick={() => deleteTask(task.id)}
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
