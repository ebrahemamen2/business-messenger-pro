import { createContext, useContext, useEffect, useState, useRef, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface Tenant {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  is_active: boolean;
}

interface TenantContextType {
  tenants: Tenant[];
  currentTenant: Tenant | null;
  selectTenant: (tenant: Tenant) => void;
  loading: boolean;
}

const TenantContext = createContext<TenantContextType>({
  tenants: [],
  currentTenant: null,
  selectTenant: () => {},
  loading: true,
});

export const useTenantContext = () => useContext(TenantContext);

export const TenantProvider = ({ children }: { children: ReactNode }) => {
  const { user, isSuperAdmin, loading: authLoading } = useAuth();
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [currentTenant, setCurrentTenant] = useState<Tenant | null>(null);
  const [loading, setLoading] = useState(true);
  const loadedForRef = useRef<string | null>(null);

  useEffect(() => {
    if (authLoading) return;

    if (!user) {
      setTenants([]);
      setCurrentTenant(null);
      setLoading(false);
      loadedForRef.current = null;
      return;
    }

    // Skip reload if already loaded for this user + role combo
    const cacheKey = `${user.id}_${isSuperAdmin}`;
    if (loadedForRef.current === cacheKey && tenants.length > 0) {
      return;
    }

    const load = async () => {
      let tenantList: Tenant[] = [];

      if (isSuperAdmin) {
        const { data } = await supabase
          .from('tenants')
          .select('id, name, slug, logo_url, is_active')
          .eq('is_active', true)
          .order('name');
        tenantList = (data as Tenant[]) || [];
      } else {
        const { data: memberships } = await supabase
          .from('tenant_members')
          .select('tenant_id, tenants(id, name, slug, logo_url, is_active)')
          .eq('user_id', user.id);

        if (memberships) {
          tenantList = memberships
            .map((m: any) => m.tenants as Tenant)
            .filter((t: Tenant | null) => t && t.is_active);
        }
      }

      setTenants(tenantList);
      loadedForRef.current = cacheKey;

      // Restore last selected or pick first
      if (!currentTenant || !tenantList.find(t => t.id === currentTenant.id)) {
        const savedId = localStorage.getItem('current_tenant_id');
        const saved = tenantList.find((t) => t.id === savedId);
        setCurrentTenant(saved || tenantList[0] || null);
      }

      setLoading(false);
    };

    load();
  }, [user, isSuperAdmin, authLoading]);

  const selectTenant = (tenant: Tenant) => {
    setCurrentTenant(tenant);
    localStorage.setItem('current_tenant_id', tenant.id);
  };

  return (
    <TenantContext.Provider value={{ tenants, currentTenant, selectTenant, loading }}>
      {children}
    </TenantContext.Provider>
  );
};
