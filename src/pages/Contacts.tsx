import { useState, useEffect } from 'react';
import { Search, Mail, MoreVertical, Plus, Filter, Loader2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { useTenantContext } from '@/contexts/TenantContext';

interface Contact {
  id: string;
  name: string | null;
  phone: string;
  email: string | null;
  tags: string[] | null;
  notes: string | null;
}

const Contacts = () => {
  const { currentTenant } = useTenantContext();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      let query = supabase.from('contacts').select('*').order('name');
      if (currentTenant?.id) {
        query = query.eq('tenant_id', currentTenant.id);
      }
      const { data } = await query;
      setContacts((data as Contact[]) || []);
      setLoading(false);
    };
    load();
  }, [currentTenant?.id]);

  const filtered = contacts.filter(
    (c) =>
      !search ||
      (c.name || '').includes(search) ||
      c.phone.includes(search)
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 overflow-y-auto h-full">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">جهات الاتصال</h1>
          <p className="text-sm text-muted-foreground mt-1">{contacts.length} عميل</p>
        </div>
        <Button className="gap-2 bg-primary text-primary-foreground hover:bg-primary/90">
          <Plus className="w-4 h-4" />
          إضافة عميل
        </Button>
      </div>

      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="بحث بالاسم أو رقم الهاتف..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 bg-card border-border"
          />
        </div>
        <Button variant="outline" className="gap-2">
          <Filter className="w-4 h-4" />
          فلتر
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.length === 0 ? (
          <div className="col-span-full text-center py-8 text-muted-foreground">
            لا توجد جهات اتصال
          </div>
        ) : (
          filtered.map((contact) => (
            <Card key={contact.id} className="p-5 bg-card border-border hover:border-primary/30 transition-colors group">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-primary/15 flex items-center justify-center">
                    <span className="text-lg font-bold text-primary">{(contact.name || contact.phone).charAt(0)}</span>
                  </div>
                  <div>
                    <h3 className="font-semibold text-foreground">{contact.name || contact.phone}</h3>
                    <p className="text-xs text-muted-foreground" dir="ltr">{contact.phone}</p>
                  </div>
                </div>
                <button className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity">
                  <MoreVertical className="w-4 h-4" />
                </button>
              </div>

              {contact.email && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground mb-3">
                  <Mail className="w-3.5 h-3.5" />
                  {contact.email}
                </div>
              )}

              <div className="flex flex-wrap gap-1.5">
                {(contact.tags || []).map((tag) => (
                  <span key={tag} className="px-2 py-0.5 rounded-full bg-primary/10 text-primary text-[11px] font-medium">
                    {tag}
                  </span>
                ))}
              </div>
            </Card>
          ))
        )}
      </div>
    </div>
  );
};

export default Contacts;
