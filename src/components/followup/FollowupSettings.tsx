import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useTenantContext } from '@/contexts/TenantContext';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Loader2, Save, CheckSquare, Square } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import ConfirmAutoReply from '@/components/confirm/ConfirmAutoReply';
import AIModulePrompt from '@/components/settings/AIModulePrompt';
import { SHIPPING_STATUSES } from './AllShipmentsTable';

const FollowupSettings = () => {
  const { currentTenant } = useTenantContext();
  const { toast } = useToast();
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const loadConfig = useCallback(async () => {
    if (!currentTenant?.id) { setLoading(false); return; }
    setLoading(true);
    const { data } = await supabase
      .from('followup_status_config')
      .select('followup_statuses')
      .eq('tenant_id', currentTenant.id)
      .maybeSingle();
    setSelectedStatuses((data?.followup_statuses as string[]) || []);
    setLoading(false);
  }, [currentTenant?.id]);

  useEffect(() => { loadConfig(); }, [loadConfig]);

  const toggleStatus = (status: string) => {
    setSelectedStatuses(prev =>
      prev.includes(status) ? prev.filter(s => s !== status) : [...prev, status]
    );
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

  // Group statuses by category
  const statusGroups = {
    'حالات تحتاج متابعة عادة': ['CR', 'Follow', 'تأجيل الى تاريخ', 'تحديد معاد', 'OH', 'Undelivered', 'Another try', 'Next Day'],
    'حالات التسليم': ['OK', 'OD', 'Cash Delivered', 'Collected', 'تحت التسليم', 'Cash in Transit'],
    'حالات المرتجع': ['RO', 'ROWF', 'Returned to the Shipper', 'Cancel Shipment'],
    'حالات النقل': ['in transit', 'Received', 'Branch Delivered'],
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <Tabs defaultValue="statuses" className="flex flex-col h-full" dir="rtl">
        <div className="border-b border-border bg-card px-4 flex-shrink-0">
          <TabsList className="bg-transparent h-10 gap-1">
            <TabsTrigger value="statuses" className="text-xs data-[state=active]:bg-primary/10 data-[state=active]:text-primary">
              حالات المتابعة
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
            <div className="space-y-6 max-w-3xl mx-auto">
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

              {Object.entries(statusGroups).map(([group, statuses]) => (
                <div key={group} className="space-y-2">
                  <h4 className="text-sm font-semibold text-foreground border-b border-border pb-1">{group}</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {statuses.map(status => {
                      const info = SHIPPING_STATUSES[status];
                      const isSelected = selectedStatuses.includes(status);
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
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-foreground">{status}</p>
                            {info && (
                              <>
                                <p className="text-xs text-muted-foreground mt-0.5">{info.en}</p>
                                <p className="text-xs text-muted-foreground">{info.ar}</p>
                              </>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
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
