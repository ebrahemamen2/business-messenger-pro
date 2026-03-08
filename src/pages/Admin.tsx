import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Shield, Plus, Building2, Users, Loader2 } from 'lucide-react';
import { Navigate } from 'react-router-dom';

const Admin = () => {
  const { isSuperAdmin } = useAuth();
  const { toast } = useToast();
  const [tenants, setTenants] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState('');
  const [newSlug, setNewSlug] = useState('');
  const [creating, setCreating] = useState(false);

  const loadTenants = async () => {
    const { data } = await supabase.from('tenants').select('*, tenant_members(count)');
    setTenants(data || []);
    setLoading(false);
  };

  useEffect(() => { loadTenants(); }, []);

  if (!isSuperAdmin) return <Navigate to="/dashboard" replace />;

  const createTenant = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName || !newSlug) return;
    setCreating(true);

    const { error } = await supabase.from('tenants').insert({
      name: newName,
      slug: newSlug.toLowerCase().replace(/[^a-z0-9-]/g, '-'),
    });

    if (error) {
      toast({ title: 'خطأ', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'تم إنشاء البراند بنجاح' });
      setNewName('');
      setNewSlug('');
      loadTenants();
    }
    setCreating(false);
  };

  return (
    <div className="h-full overflow-y-auto p-6 space-y-6">
      <div className="flex items-center gap-3">
        <Shield className="w-6 h-6 text-primary" />
        <div>
          <h1 className="text-2xl font-bold text-foreground">إدارة المنصة</h1>
          <p className="text-muted-foreground text-sm">إدارة البراندات والمستخدمين</p>
        </div>
      </div>

      <Card className="border-border">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Plus className="w-4 h-4" />
            إضافة براند جديد
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={createTenant} className="flex gap-3">
            <Input
              placeholder="اسم البراند"
              value={newName}
              onChange={(e) => {
                setNewName(e.target.value);
                setNewSlug(e.target.value.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, ''));
              }}
              className="flex-1"
            />
            <Input
              placeholder="slug (رابط مختصر)"
              value={newSlug}
              onChange={(e) => setNewSlug(e.target.value)}
              className="w-48"
              dir="ltr"
            />
            <Button type="submit" disabled={creating || !newName || !newSlug}>
              {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              إنشاء
            </Button>
          </form>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {loading ? (
          <div className="col-span-full flex justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        ) : tenants.length === 0 ? (
          <div className="col-span-full text-center py-8 text-muted-foreground">
            لا توجد براندات بعد
          </div>
        ) : (
          tenants.map((t) => (
            <Card key={t.id} className="border-border">
              <CardContent className="p-5">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-xl bg-primary/15 flex items-center justify-center">
                    <Building2 className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-foreground">{t.name}</h3>
                    <p className="text-xs text-muted-foreground" dir="ltr">{t.slug}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Users className="w-3.5 h-3.5" />
                  <span>{t.tenant_members?.[0]?.count || 0} أعضاء</span>
                  <span className={`mr-auto px-2 py-0.5 rounded-full text-[10px] ${
                    t.is_active ? 'bg-primary/15 text-primary' : 'bg-destructive/15 text-destructive'
                  }`}>
                    {t.is_active ? 'نشط' : 'معطل'}
                  </span>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
};

export default Admin;
