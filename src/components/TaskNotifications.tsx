import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Bell, Clock, X } from "lucide-react";
import { Button } from "./ui/button";
import { Card } from "./ui/card";
import { format } from "date-fns";

interface Task {
  id: string;
  title: string;
  description: string | null;
  due_date: string;
  status: string;
  lead_id: string | null;
}

const TaskNotifications = () => {
  const [overdueTasks, setOverdueTasks] = useState<Task[]>([]);
  const [upcomingTasks, setUpcomingTasks] = useState<Task[]>([]);
  const [dismissed, setDismissed] = useState<string[]>([]);
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission>("default");

  // Request notification permission on mount
  useEffect(() => {
    if ("Notification" in window) {
      setNotificationPermission(Notification.permission);
      if (Notification.permission === "default") {
        Notification.requestPermission().then(permission => {
          setNotificationPermission(permission);
        });
      }
    }
  }, []);

  const playNotificationSound = useCallback(() => {
    try {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      
      // Play 3 beeps
      for (let i = 0; i < 3; i++) {
        setTimeout(() => {
          const oscillator = audioContext.createOscillator();
          const gainNode = audioContext.createGain();
          
          oscillator.connect(gainNode);
          gainNode.connect(audioContext.destination);
          
          oscillator.frequency.value = 600;
          oscillator.type = 'sine';
          gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
          gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.15);
          
          oscillator.start(audioContext.currentTime);
          oscillator.stop(audioContext.currentTime + 0.15);
        }, i * 200);
      }
    } catch (error) {
      console.error("Error playing notification sound:", error);
    }
  }, []);

  const sendBrowserNotification = useCallback((title: string, body: string) => {
    if (notificationPermission === "granted" && "Notification" in window) {
      const notification = new Notification(title, {
        body,
        icon: "/favicon.ico",
        tag: "task-reminder",
        requireInteraction: true
      });
      
      notification.onclick = () => {
        window.focus();
        notification.close();
      };
    }
  }, [notificationPermission]);

  const sendTelegramReminder = useCallback(async (task: Task & { seller_id?: string; customer_name?: string }) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Get task with seller and lead info
      const { data: taskData } = await supabase
        .from("tasks")
        .select(`
          *,
          leads:lead_id(customer_name)
        `)
        .eq("id", task.id)
        .single();

      if (!taskData) return;

      await supabase.functions.invoke("send-task-telegram-reminder", {
        body: {
          task_id: task.id,
          task_title: task.title,
          task_description: task.description,
          due_date: task.due_date,
          seller_id: taskData.seller_id,
          customer_name: taskData.leads?.customer_name
        }
      });

      console.log("Telegram reminder sent for task:", task.id);
    } catch (error) {
      console.error("Error sending Telegram reminder:", error);
    }
  }, []);

  const checkTasks = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const now = new Date();
      const fiveMinutesLater = new Date(now.getTime() + 5 * 60 * 1000);
      
      // Fetch overdue tasks
      const { data: overdueData } = await supabase
        .from("tasks")
        .select("id, title, description, due_date, status, lead_id")
        .eq("seller_id", user.id)
        .eq("status", "pending")
        .lt("due_date", now.toISOString())
        .order("due_date", { ascending: true });

      // Fetch upcoming tasks (due in next 5 minutes)
      const { data: upcomingData } = await supabase
        .from("tasks")
        .select("id, title, description, due_date, status, lead_id")
        .eq("seller_id", user.id)
        .eq("status", "pending")
        .gte("due_date", now.toISOString())
        .lte("due_date", fiveMinutesLater.toISOString())
        .order("due_date", { ascending: true });

      const newOverdueTasks = overdueData || [];
      const newUpcomingTasks = upcomingData || [];

      // Check for newly overdue tasks
      const newlyOverdue = newOverdueTasks.filter(
        task => !overdueTasks.some(t => t.id === task.id)
      );

      if (newlyOverdue.length > 0) {
        playNotificationSound();
        
        // Send browser notification
        sendBrowserNotification(
          "⚠️ Muddati o'tgan vazifalar!",
          `${newlyOverdue.length} ta vazifaning muddati o'tdi`
        );

        // Send Telegram reminders for newly overdue tasks
        newlyOverdue.forEach(task => {
          sendTelegramReminder(task);
        });

        // Show toast
        toast.error(
          <div className="flex items-center gap-2">
            <Bell className="h-4 w-4" />
            <div>
              <p className="font-semibold">Muddati o'tgan vazifalar!</p>
              <p className="text-sm">{newlyOverdue.length} ta vazifa bajarilmagan</p>
            </div>
          </div>,
          { duration: 10000 }
        );
      }

      // Check for tasks becoming due soon
      const newlyUpcoming = newUpcomingTasks.filter(
        task => !upcomingTasks.some(t => t.id === task.id)
      );

      if (newlyUpcoming.length > 0) {
        sendBrowserNotification(
          "🔔 Yaqinlashayotgan vazifalar",
          `${newlyUpcoming.length} ta vazifaning muddati yaqinlashmoqda`
        );

        // Send Telegram reminders for upcoming tasks
        newlyUpcoming.forEach(task => {
          sendTelegramReminder(task);
        });

        toast.warning(
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4" />
            <div>
              <p className="font-semibold">Vazifa muddati yaqinlashmoqda!</p>
              <p className="text-sm">{newlyUpcoming[0].title}</p>
            </div>
          </div>,
          { duration: 8000 }
        );
      }

      setOverdueTasks(newOverdueTasks);
      setUpcomingTasks(newUpcomingTasks);
    } catch (error) {
      console.error("Error checking tasks:", error);
    }
  }, [overdueTasks, upcomingTasks, playNotificationSound, sendBrowserNotification, sendTelegramReminder]);

  useEffect(() => {
    checkTasks();
    
    // Check tasks every 30 seconds
    const interval = setInterval(checkTasks, 30000);
    
    // Setup realtime subscription
    const channel = supabase
      .channel('task-notifications')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'tasks'
        },
        () => {
          checkTasks();
        }
      )
      .subscribe();

    return () => {
      clearInterval(interval);
      supabase.removeChannel(channel);
    };
  }, []);

  // Periodic reminder for overdue tasks (every 2 minutes)
  useEffect(() => {
    if (overdueTasks.length === 0) return;

    const reminderInterval = setInterval(() => {
      if (overdueTasks.length > 0) {
        playNotificationSound();
        sendBrowserNotification(
          "⚠️ Eslatma: Muddati o'tgan vazifalar!",
          `${overdueTasks.length} ta bajarilmagan vazifa bor`
        );
      }
    }, 120000); // Every 2 minutes

    return () => clearInterval(reminderInterval);
  }, [overdueTasks.length, playNotificationSound, sendBrowserNotification]);

  const handleTaskClick = (task: Task) => {
    if (task.lead_id) {
      window.location.href = `/leads?lead=${task.lead_id}`;
    } else {
      window.location.href = '/tasks';
    }
  };

  const handleDismiss = (taskId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setDismissed(prev => [...prev, taskId]);
  };

  const visibleOverdueTasks = overdueTasks.filter(t => !dismissed.includes(t.id));
  const visibleUpcomingTasks = upcomingTasks.filter(t => !dismissed.includes(t.id));

  if (visibleOverdueTasks.length === 0 && visibleUpcomingTasks.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm max-h-[400px] overflow-y-auto">
      {/* Overdue tasks */}
      {visibleOverdueTasks.map((task) => (
        <Card
          key={task.id}
          className="p-3 bg-destructive/10 border-destructive cursor-pointer hover:bg-destructive/20 transition-colors animate-pulse"
          onClick={() => handleTaskClick(task)}
        >
          <div className="flex items-start gap-2">
            <Bell className="h-4 w-4 text-destructive mt-0.5 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm text-destructive truncate">{task.title}</p>
              <p className="text-xs text-muted-foreground">
                Muddat: {format(new Date(task.due_date), "dd.MM.yyyy HH:mm")}
              </p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0"
              onClick={(e) => handleDismiss(task.id, e)}
            >
              <X className="h-3 w-3" />
            </Button>
          </div>
        </Card>
      ))}
      
      {/* Upcoming tasks */}
      {visibleUpcomingTasks.map((task) => (
        <Card
          key={task.id}
          className="p-3 bg-warning/10 border-warning cursor-pointer hover:bg-warning/20 transition-colors"
          onClick={() => handleTaskClick(task)}
        >
          <div className="flex items-start gap-2">
            <Clock className="h-4 w-4 text-warning mt-0.5 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm truncate">{task.title}</p>
              <p className="text-xs text-muted-foreground">
                Muddat: {format(new Date(task.due_date), "dd.MM.yyyy HH:mm")}
              </p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0"
              onClick={(e) => handleDismiss(task.id, e)}
            >
              <X className="h-3 w-3" />
            </Button>
          </div>
        </Card>
      ))}
    </div>
  );
};

export default TaskNotifications;
