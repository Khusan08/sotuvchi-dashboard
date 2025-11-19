import { useState, useEffect } from "react";
import { useNavigate, Link, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { LogOut, LayoutDashboard, ShoppingCart, User, Shield, Users, Package, CheckSquare, UserCog } from "lucide-react";
import { toast } from "sonner";
import { useUserRoles } from "@/hooks/useUserRoles";
import TaskNotifications from "./TaskNotifications";

interface DashboardLayoutProps {
  children: React.ReactNode;
}

const DashboardLayout = ({ children }: DashboardLayoutProps) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [loading, setLoading] = useState(true);
  const [overdueTasksCount, setOverdueTasksCount] = useState(0);
  const { isAdminOrRop } = useUserRoles();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        navigate("/auth");
      } else {
        setLoading(false);
        checkOverdueTasks();
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) {
        navigate("/auth");
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  useEffect(() => {
    checkOverdueTasks();
    
    // Check every minute
    const interval = setInterval(checkOverdueTasks, 60000);
    
    // Setup realtime subscription for tasks
    const channel = supabase
      .channel('tasks-count-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'tasks'
        },
        () => {
          checkOverdueTasks();
        }
      )
      .subscribe();

    return () => {
      clearInterval(interval);
      supabase.removeChannel(channel);
    };
  }, []);

  const checkOverdueTasks = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const now = new Date();
      
      const { data, count } = await supabase
        .from("tasks")
        .select("*", { count: 'exact', head: true })
        .eq("seller_id", user.id)
        .eq("status", "pending")
        .lt("due_date", now.toISOString());

      setOverdueTasksCount(count || 0);
    } catch (error) {
      console.error("Error checking overdue tasks:", error);
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    toast.success("Tizimdan chiqdingiz");
    navigate("/auth");
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-muted-foreground">Yuklanmoqda...</div>
      </div>
    );
  }

  const navItems = [
    { path: "/", icon: LayoutDashboard, label: "Dashboard" },
    { path: "/leads", icon: Users, label: "Lidlar" },
    { path: "/products", icon: Package, label: "Mahsulotlar" },
    { path: "/orders", icon: ShoppingCart, label: "Zakazlar (7 kun)" },
    { path: "/all-orders", icon: Package, label: "Barcha zakazlar" },
    { path: "/tasks", icon: CheckSquare, label: "Tasklar" },
    { path: "/profile", icon: User, label: "Profil" },
    ...(isAdminOrRop ? [
      { path: "/sellers", icon: UserCog, label: "Hodimlar" },
      { path: "/admin", icon: Shield, label: "Boshqaruv" }
    ] : []),
  ];

  return (
    <div className="min-h-screen bg-background">
      <nav className="border-b bg-card">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center space-x-8">
              <h1 className="text-xl font-bold text-primary">ROP Seller</h1>
              <div className="hidden md:flex space-x-1">
                {navItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = location.pathname === item.path;
                  const showBadge = item.path === "/tasks" && overdueTasksCount > 0;
                  return (
                    <Link key={item.path} to={item.path}>
                      <Button
                        variant={isActive ? "default" : "ghost"}
                        size="sm"
                        className="flex items-center gap-2 relative"
                      >
                        <Icon className="h-4 w-4" />
                        {item.label}
                        {showBadge && (
                          <Badge 
                            variant="destructive" 
                            className="ml-1 px-1.5 py-0 h-5 min-w-[20px] text-xs font-bold"
                          >
                            {overdueTasksCount}
                          </Badge>
                        )}
                      </Button>
                    </Link>
                  );
                })}
              </div>
            </div>
            <div className="flex items-center">
              <Button variant="ghost" size="sm" onClick={handleSignOut}>
                <LogOut className="h-4 w-4 mr-2" />
                Chiqish
              </Button>
            </div>
          </div>
        </div>
      </nav>
      
      <div className="md:hidden border-b bg-card">
        <div className="flex justify-around py-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;
            const showBadge = item.path === "/tasks" && overdueTasksCount > 0;
            return (
              <Link key={item.path} to={item.path}>
                <Button
                  variant={isActive ? "default" : "ghost"}
                  size="sm"
                  className="flex flex-col items-center h-auto py-2 px-3 relative"
                >
                  <Icon className="h-5 w-5" />
                  <span className="text-xs mt-1">{item.label}</span>
                  {showBadge && (
                    <Badge 
                      variant="destructive" 
                      className="absolute -top-1 -right-1 px-1 py-0 h-4 min-w-[16px] text-[10px] font-bold"
                    >
                      {overdueTasksCount}
                    </Badge>
                  )}
                </Button>
              </Link>
            );
          })}
        </div>
      </div>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>
      
      <TaskNotifications />
    </div>
  );
};

export default DashboardLayout;
