import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export const useUserRole = () => {
  const [isAdmin, setIsAdmin] = useState(false);
  const [isRop, setIsRop] = useState(false);
  const [isSotuvchi, setIsSotuvchi] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkRole();
  }, []);

  const checkRole = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setIsAdmin(false);
        setIsRop(false);
        setIsSotuvchi(false);
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id);

      if (error) throw error;
      
      const roles = data?.map(r => r.role) || [];
      setIsAdmin(roles.includes('admin'));
      setIsRop(roles.includes('rop'));
      setIsSotuvchi(roles.includes('sotuvchi'));
    } catch (error) {
      console.error("Error checking role:", error);
      setIsAdmin(false);
      setIsRop(false);
      setIsSotuvchi(false);
    } finally {
      setLoading(false);
    }
  };

  return { isAdmin, isRop, isSotuvchi, loading, canManage: isAdmin || isRop };
};
