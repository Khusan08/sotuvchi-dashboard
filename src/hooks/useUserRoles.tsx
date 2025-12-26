import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export type AppRole = 'admin' | 'rop' | 'sotuvchi' | 'super_admin';

export const useUserRoles = () => {
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchUserRoles();
  }, []);

  const fetchUserRoles = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setRoles([]);
        setCompanyId(null);
        setLoading(false);
        return;
      }

      // Fetch roles
      const { data: rolesData, error: rolesError } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id);

      if (rolesError) throw rolesError;
      
      setRoles(rolesData?.map(r => r.role as AppRole) || []);

      // Fetch company_id from profile
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('company_id')
        .eq('id', user.id)
        .maybeSingle();

      if (profileError) throw profileError;
      
      setCompanyId(profileData?.company_id || null);
    } catch (error) {
      console.error('Error fetching user roles:', error);
      setRoles([]);
      setCompanyId(null);
    } finally {
      setLoading(false);
    }
  };

  const hasRole = (role: AppRole) => roles.includes(role);
  const isSuperAdmin = hasRole('super_admin');
  const isAdmin = hasRole('admin');
  const isRop = hasRole('rop');
  const isSotuvchi = hasRole('sotuvchi');
  const isAdminOrRop = isAdmin || isRop;

  return {
    roles,
    companyId,
    loading,
    hasRole,
    isSuperAdmin,
    isAdmin,
    isRop,
    isSotuvchi,
    isAdminOrRop,
    refetch: fetchUserRoles
  };
};
