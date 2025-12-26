import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export type AppRole = 'admin' | 'rop' | 'sotuvchi';

export const useUserRoles = () => {
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchUserRoles();
  }, []);

  const fetchUserRoles = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setRoles([]);
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id);

      if (error) throw error;
      
      setRoles(data?.map(r => r.role as AppRole) || []);
    } catch (error) {
      console.error('Error fetching user roles:', error);
      setRoles([]);
    } finally {
      setLoading(false);
    }
  };

  const hasRole = (role: AppRole) => roles.includes(role);
  const isAdmin = hasRole('admin');
  const isRop = hasRole('rop');
  const isSotuvchi = hasRole('sotuvchi');
  const isAdminOrRop = isAdmin || isRop;

  return {
    roles,
    loading,
    hasRole,
    isAdmin,
    isRop,
    isSotuvchi,
    isAdminOrRop,
    refetch: fetchUserRoles
  };
};
