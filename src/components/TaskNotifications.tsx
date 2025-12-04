import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Bell } from "lucide-react";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";

interface Task {
  id: string;
  title: string;
  description: string | null;
  due_date: string;
  status: string;
}

const TaskNotifications = () => {
  const [overdueTasks, setOverdueTasks] = useState<Task[]>([]);
  const [hasPlayed, setHasPlayed] = useState(false);

  useEffect(() => {
    checkTasks();
    setupRealtimeSubscription();
    
    // Check tasks every 30 seconds
    const interval = setInterval(checkTasks, 30000);
    return () => clearInterval(interval);
  }, []);

  const setupRealtimeSubscription = () => {
    const channel = supabase
      .channel('tasks-changes')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'tasks'
        },
        (payload) => {
          const newTask = payload.new as Task;
          toast.success(
            <div className="flex items-center gap-2">
              <Bell className="h-4 w-4" />
              <div>
                <p className="font-semibold">Yangi vazifa qo'shildi</p>
                <p className="text-sm text-muted-foreground">{newTask.title}</p>
              </div>
            </div>
          );
          playNotificationSound('new');
          checkTasks();
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'tasks'
        },
        () => {
          checkTasks();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  };

  const playNotificationSound = (type: 'new' | 'overdue') => {
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    if (type === 'new') {
      // Short beep for new tasks
      oscillator.frequency.value = 800;
      oscillator.type = 'sine';
      gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);
      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.3);
    } else {
      // Longer alert for overdue tasks
      oscillator.frequency.value = 600;
      oscillator.type = 'square';
      gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
      
      // Play 3 beeps
      for (let i = 0; i < 3; i++) {
        setTimeout(() => {
          const osc = audioContext.createOscillator();
          const gain = audioContext.createGain();
          osc.connect(gain);
          gain.connect(audioContext.destination);
          osc.frequency.value = 600;
          osc.type = 'square';
          gain.gain.setValueAtTime(0.3, audioContext.currentTime);
          gain.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.2);
          osc.start(audioContext.currentTime);
          osc.stop(audioContext.currentTime + 0.2);
        }, i * 300);
      }
    }
  };

  const checkTasks = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const now = new Date();
      
      const { data } = await supabase
        .from("tasks")
        .select("*")
        .eq("seller_id", user.id)
        .eq("status", "pending")
        .lt("due_date", now.toISOString());

      if (data && data.length > 0) {
        setOverdueTasks(data);
        
        // Play music only once when overdue tasks are first detected
        if (!hasPlayed && data.length > 0) {
          playNotificationSound('overdue');
          setHasPlayed(true);
          
          // Show toast notification
          toast.error(
            <div className="flex items-center gap-2">
              <Bell className="h-4 w-4" />
              <div>
                <p className="font-semibold">Muddati o'tgan vazifalar!</p>
                <p className="text-sm">{data.length} ta vazifa bajarilmagan</p>
              </div>
            </div>,
            {
              duration: 10000,
            }
          );
        }
      } else {
        setOverdueTasks([]);
        setHasPlayed(false);
      }
    } catch (error) {
      console.error("Error checking tasks:", error);
    }
  };

  if (overdueTasks.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50">
      <Button
        variant="destructive"
        size="lg"
        className="shadow-lg animate-pulse"
        onClick={() => {
          window.location.href = '/tasks';
        }}
      >
        <Bell className="h-5 w-5 mr-2" />
        <span className="font-semibold">Muddati o'tgan vazifalar</span>
        <Badge variant="secondary" className="ml-2">
          {overdueTasks.length}
        </Badge>
      </Button>
    </div>
  );
};

export default TaskNotifications;
