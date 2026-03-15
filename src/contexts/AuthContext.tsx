import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { User, Session } from '@supabase/supabase-js';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  isSuperAdmin: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  loading: true,
  isSuperAdmin: false,
  signOut: async () => {},
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);

  useEffect(() => {
    let mounted = true;

    const checkSuperAdmin = async (userId: string): Promise<boolean> => {
      try {
        const { data } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', userId)
          .eq('role', 'super_admin')
          .maybeSingle();
        return !!data;
      } catch {
        return false;
      }
    };

    // Set up auth listener FIRST (but don't set loading=false here for initial load)
    let initialDone = false;
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        if (!mounted) return;
        setSession(session);
        setUser(session?.user ?? null);

        if (session?.user) {
          const isAdmin = await checkSuperAdmin(session.user.id);
          if (mounted) setIsSuperAdmin(isAdmin);
        } else {
          setIsSuperAdmin(false);
        }

        if (initialDone && mounted) {
          setLoading(false);
        }
      }
    );

    // Initial session check — wait for role before setting loading=false
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!mounted) return;
      setSession(session);
      setUser(session?.user ?? null);

      if (session?.user) {
        const isAdmin = await checkSuperAdmin(session.user.id);
        if (mounted) setIsSuperAdmin(isAdmin);
      }

      if (mounted) {
        setLoading(false);
        initialDone = true;
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, isSuperAdmin, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};
