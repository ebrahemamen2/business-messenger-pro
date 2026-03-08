import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface Tenant {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  is_active: boolean;
}

export function useTenant() {
  const { user } = useAuth();
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [currentTenant, setCurrentTenant] = useState<Tenant | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setTenants([]);
      setCurrentTenant(null);
      setLoading(false);
      return;
    }

    const load = async () => {
      const { data: memberships } = await supabase
        .from('tenant_members')
        .select('tenant_id, role, tenants(id, name, slug, logo_url, is_active)')
        .eq('user_id', user.id);

      if (memberships && memberships.length > 0) {
        const tenantList = memberships
          .map((m: any) => m.tenants as Tenant)
          .filter(Boolean);
        setTenants(tenantList);

        // Restore last selected tenant or pick first
        const savedId = localStorage.getItem('current_tenant_id');
        const saved = tenantList.find((t) => t.id === savedId);
        setCurrentTenant(saved || tenantList[0] || null);
      }
      setLoading(false);
    };

    load();
  }, [user]);

  const selectTenant = (tenant: Tenant) => {
    setCurrentTenant(tenant);
    localStorage.setItem('current_tenant_id', tenant.id);
  };

  return { tenants, currentTenant, selectTenant, loading };
}
