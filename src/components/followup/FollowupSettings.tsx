import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useTenantContext } from '@/contexts/TenantContext';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, Save, CheckSquare, Square, Plus, X, Search } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import ConfirmAutoReply from '@/components/confirm/ConfirmAutoReply';
import AIModulePrompt from '@/components/settings/AIModulePrompt';
import FollowupWATemplates from '@/components/followup/FollowupWATemplates';
import { SHIPPING_STATUSES } from './AllShipmentsTable';

const FollowupSettings = () => {
  const { currentTenant } = useTenantContext();
  const { toast } = useToast();
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dbStatuses, setDbStatuses] = useState<string[]>([]);
  const [newStatus, setNewStatus] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  const loadConfig = useCallback(async () => {
    if (!currentTenant?.id) { setLoading(false); return; }
    setLoading(true);

    // Load saved config + distinct statuses from shipments in parallel
    const [configRes, statusesRes] = await Promise.all([
      supabase
        .from('followup_status_config')
        .select('followup_statuses')
        .eq('tenant_id', currentTenant.id)
        .maybeSingle(),
      supabase
        .from('shipment_tracking')
        .select('status')
        .eq('tenant_id', currentTenant.id),
    ]);

    setSelectedStatuses((configRes.data?.followup_statuses as string[]) || []);

    // Extract unique statuses from shipments
    const uniqueFromDb = [...new Set(
      (statusesRes.data || []).map(r => r.status).filter(Boolean)
    )];
    setDbStatuses(uniqueFromDb);

    setLoading(false);
  }, [currentTenant?.id]);

  useEffect(() => { loadConfig(); }, [loadConfig]);

  const toggleStatus = (status: string) => {
    setSelectedStatuses(prev =>
      prev.includes(status) ? prev.filter(s => s !== status) : [...prev, status]
    );
  };

  const addCustomStatus = () => {
    const trimmed = newStatus.trim();
    if (!trimmed) return;
    if (!selectedStatuses.includes(trimmed)) {
      setSelectedStatuses(prev => [...prev, trimmed]);
    }
    setNewStatus('');
  };

  const removeStatus = (status: string) => {
    setSelectedStatuses(prev => prev.filter(s => s !== status));
  };

  const saveConfig = async () => {
    if (!currentTenant?.id) return;
    setSaving(true);
    const { error } = await supabase
      .from('followup_status_config')
      .upsert({
        tenant_id: currentTenant.id,
        followup_statuses: selectedStatuses,
        updated_at: new Date().toISOString(),
      } as any, { onConflict: 'tenant_id' });

    if (error) {
      toast({ title: '❌ خطأ', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: '✅ تم الحفظ', description: `تم حفظ ${selectedStatuses.length} حالة للمتابعة` });
    }
    setSaving(false);
  };

  // Combine: known statuses + statuses from DB + already selected (custom ones)
  const allAvailableStatuses = [...new Set([
    ...Object.keys(SHIPPING_STATUSES),
    ...dbStatuses,
    ...selectedStatuses,
  ])];

  const filteredStatuses = searchTerm
    ? allAvailableStatuses.filter(s => {
        const info = SHIPPING_STATUSES[s];
        const lower = searchTerm.toLowerCase();
        return s.toLowerCase().includes(lower) ||
          info?.en.toLowerCase().includes(lower) ||
          info?.ar.toLowerCase().includes(lower);
      })
    : allAvailableStatuses;

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <Tabs defaultValue="statuses" className="flex flex-col h-full" dir="rtl">
        <div className="border-b border-border bg-card px-4 flex-shrink-0">
          <TabsList className="bg-transparent h-10 gap-1">
            <TabsTrigger value="statuses" className="text-xs data-[state=active]:bg-primary/10 data-[state=active]:text-primary">
              حالات المتابعة
            </TabsTrigger>
            <TabsTrigger value="wa-templates" className="text-xs data-[state=active]:bg-primary/10 data-[state=active]:text-primary">
              قوالب واتساب
            </TabsTrigger>
            <TabsTrigger value="auto-reply" className="text-xs data-[state=active]:bg-primary/10 data-[state=active]:text-primary">
              الرد التلقائي
            </TabsTrigger>
            <TabsTrigger value="ai-prompt" className="text-xs data-[state=active]:bg-primary/10 data-[state=active]:text-primary">
              توجيهات AI
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="statuses" className="flex-1 m-0 overflow-auto p-4">
          {loading ? (
            <div className="flex items-center justify-center h-full"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
          ) : (
            <div className="space-y-5 max-w-3xl mx-auto">
              {/* Header */}
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-bold text-foreground">اختيار حالات المتابعة</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    اختار الحالات اللي عايز الشحنات اللي فيها تروح لجدول المتابعة تلقائياً
                  </p>
                </div>
                <Button onClick={saveConfig} disabled={saving} className="gap-1.5">
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  حفظ ({selectedStatuses.length})
                </Button>
              </div>

              {/* Selected statuses chips */}
              {selectedStatuses.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-sm font-semibold text-foreground">الحالات المختارة ({selectedStatuses.length})</h4>
                  <div className="flex flex-wrap gap-2">
                    {selectedStatuses.map(status => (
                      <span key={status} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-primary/10 text-primary border border-primary/20">
                        {status}
                        <button onClick={() => removeStatus(status)} className="hover:bg-primary/20 rounded-full p-0.5 transition-colors">
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Add custom status */}
              <div className="flex gap-2">
                <Input
                  value={newStatus}
                  onChange={e => setNewStatus(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && addCustomStatus()}
                  placeholder="أضف حالة مخصصة..."
                  className="flex-1"
                  dir="auto"
                />
                <Button onClick={addCustomStatus} disabled={!newStatus.trim()} variant="outline" className="gap-1.5">
                  <Plus className="w-4 h-4" />
                  إضافة
                </Button>
              </div>

              {/* Search */}
              <div className="relative">
                <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  placeholder="ابحث في الحالات..."
                  className="pr-9"
                  dir="auto"
                />
              </div>

              {/* All statuses grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {filteredStatuses.map(status => {
                  const info = SHIPPING_STATUSES[status];
                  const isSelected = selectedStatuses.includes(status);
                  const isFromDb = dbStatuses.includes(status);
                  return (
                    <button
                      key={status}
                      onClick={() => toggleStatus(status)}
                      className={`flex items-start gap-3 p-3 rounded-lg border text-right transition-all ${
                        isSelected
                          ? 'border-primary bg-primary/5 ring-1 ring-primary/20'
                          : 'border-border bg-card hover:border-primary/30'
                      }`}
                    >
                      {isSelected ? (
                        <CheckSquare className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                      ) : (
                        <Square className="w-5 h-5 text-muted-foreground flex-shrink-0 mt-0.5" />
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium text-foreground">{status}</p>
                          {isFromDb && !Object.keys(SHIPPING_STATUSES).includes(status) && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-accent text-accent-foreground">من شحناتك</span>
                          )}
                        </div>
                        {info && (
                          <p className="text-xs text-muted-foreground mt-0.5">{info.ar}</p>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>

              {filteredStatuses.length === 0 && (
                <p className="text-center text-sm text-muted-foreground py-8">لا توجد حالات مطابقة للبحث</p>
              )}
            </div>
          )}
        </TabsContent>

        <TabsContent value="wa-templates" className="flex-1 m-0 overflow-hidden">
          <FollowupWATemplates />
        </TabsContent>

        <TabsContent value="auto-reply" className="flex-1 m-0 overflow-hidden">
          <ConfirmAutoReply module="followup" title="قسم المتابعة" />
        </TabsContent>

        <TabsContent value="ai-prompt" className="flex-1 m-0 overflow-hidden">
          <AIModulePrompt module="followup" title="قسم المتابعة" />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default FollowupSettings;
