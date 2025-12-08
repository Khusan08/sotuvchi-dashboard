import { useEffect, useState, useCallback, useRef } from "react";
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
  leads?: { customer_name: string } | null;
}

const TaskNotifications = () => {
  const [overdueTasks, setOverdueTasks] = useState<Task[]>([]);
  const [upcomingTasks, setUpcomingTasks] = useState<Task[]>([]);
  const [dismissed, setDismissed] = useState<string[]>([]);
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission>("default");
  const sentReminders = useRef<Set<string>>(new Set());

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

  const sendTelegramReminder = useCallback(async (task: Task, userId: string) => {
    // Only send once per task
    if (sentReminders.current.has(task.id)) {
      return;
    }
    
    try {
      console.log('Sending Telegram reminder for task:', task.id);
      sentReminders.current.add(task.id);
      
      const response = await supabase.functions.invoke('send-task-reminder', {
        body: {
          task: {
            task_id: task.id,
            task_title: task.title,
            task_description: task.description,
            due_date: task.due_date,
            seller_id: userId,
            customer_name: task.leads?.customer_name
          }
        }
      });

      if (response.error) {
        console.error('Error sending telegram reminder:', response.error);
      } else {
        console.log('Telegram reminder sent successfully:', response.data);
      }
    } catch (error) {
      console.error('Failed to send telegram reminder:', error);
    }
  }, []);

  // Move overdue leads to "Muhim" stage
  const moveOverdueLeadsToMuhim = useCallback(async (overdueTasks: Task[]) => {
    const MUHIM_STAGE_ID = "1aa6d478-0e36-4642-b5c5-e2a6b6985c08";
    const movedLeads = new Set<string>();

    for (const task of overdueTasks) {
      if (task.lead_id && !movedLeads.has(task.lead_id)) {
        try {
          // Check if lead is not already in Muhim stage
          const { data: lead } = await supabase
            .from("leads")
            .select("id, stage")
            .eq("id", task.lead_id)
            .single();

          if (lead && lead.stage !== MUHIM_STAGE_ID) {
            await supabase
              .from("leads")
              .update({ stage: MUHIM_STAGE_ID })
              .eq("id", task.lead_id);
            
            movedLeads.add(task.lead_id);
            console.log(`Lead ${task.lead_id} moved to Muhim stage due to overdue task`);
          }
        } catch (error) {
          console.error("Error moving lead to Muhim stage:", error);
        }
      }
    }

    return movedLeads.size;
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
        .select("id, title, description, due_date, status, lead_id, leads(customer_name)")
        .eq("seller_id", user.id)
        .eq("status", "pending")
        .lt("due_date", now.toISOString())
        .order("due_date", { ascending: true });

      // Fetch upcoming tasks (due in next 5 minutes)
      const { data: upcomingData } = await supabase
        .from("tasks")
        .select("id, title, description, due_date, status, lead_id, leads(customer_name)")
        .eq("seller_id", user.id)
        .eq("status", "pending")
        .gte("due_date", now.toISOString())
        .lte("due_date", fiveMinutesLater.toISOString())
        .order("due_date", { ascending: true });

      const newOverdueTasks = (overdueData || []) as Task[];
      const newUpcomingTasks = (upcomingData || []) as Task[];

      // Move leads with overdue tasks to "Muhim" stage
      const movedCount = await moveOverdueLeadsToMuhim(newOverdueTasks);
      if (movedCount > 0) {
        toast.warning(`${movedCount} ta lid "Muhim" bosqichiga o'tkazildi (vazifa muddati tugadi)`);
      }

      // Check for newly overdue tasks - send telegram reminder only once when they become overdue
      const newlyOverdue = newOverdueTasks.filter(
        task => !overdueTasks.some(t => t.id === task.id)
      );

      if (newlyOverdue.length > 0) {
        playNotificationSound();
        
        // Send browser notification
        sendBrowserNotification(
          "⚠️ Muddati tugagan vazifalar!",
          `${newlyOverdue.length} ta vazifaning muddati tugadi`
        );

        // Show toast
        toast.error(
          <div className="flex items-center gap-2">
            <Bell className="h-4 w-4" />
            <div>
              <p className="font-semibold">Muddati tugagan vazifalar!</p>
              <p className="text-sm">{newlyOverdue.length} ta vazifa bajarilmagan</p>
            </div>
          </div>,
          { duration: 10000 }
        );

        // Send Telegram reminders for newly overdue tasks
        for (const task of newlyOverdue) {
          await sendTelegramReminder(task, user.id);
        }
      }

      // Check for tasks becoming due (at exact time) - only send once
      const newlyDue = newUpcomingTasks.filter(
        task => !upcomingTasks.some(t => t.id === task.id)
      );

      if (newlyDue.length > 0) {
        sendBrowserNotification(
          "🔔 Vazifa muddati yetdi",
          `${newlyDue.length} ta vazifaning muddati yetib keldi`
        );

        toast.warning(
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4" />
            <div>
              <p className="font-semibold">Vazifa muddati yaqinlashmoqda!</p>
              <p className="text-sm">{newlyDue[0].title}</p>
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
  }, [overdueTasks, upcomingTasks, playNotificationSound, sendBrowserNotification, sendTelegramReminder, moveOverdueLeadsToMuhim]);

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

  const handleTaskClick = (task: Task) => {
    if (task.lead_id) {
      // Navigate to leads page with the specific lead modal open
      window.location.href = `/leads?openLead=${task.lead_id}`;
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
