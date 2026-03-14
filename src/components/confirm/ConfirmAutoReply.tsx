import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Plus, Trash2, Clock, MessageSquare, Zap, Loader2, CheckCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useTenantContext } from '@/contexts/TenantContext';

interface AutoReplyRule {
  id: string;
  trigger: string;
  response: string;
  enabled: boolean;
  isNew?: boolean;
}

interface AutoReplyProps {
  module?: string;
  title?: string;
}

const ConfirmAutoReply = ({ module = 'confirm', title = 'قسم التأكيد' }: AutoReplyProps) => {
  const { toast } = useToast();
  const { currentTenant } = useTenantContext();
  const [rules, setRules] = useState<AutoReplyRule[]>([]);
  const [welcomeMsg, setWelcomeMsg] = useState('');
  const [awayMsg, setAwayMsg] = useState('');
  const [welcomeEnabled, setWelcomeEnabled] = useState(true);
  const [awayEnabled, setAwayEnabled] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const load = async () => {
      setLoading(true);

      // Load wa_config for welcome/away messages (now per-tenant, no module filter)
      let configQuery = supabase
        .from('wa_config')
        .select('*')
        .order('updated_at', { ascending: false })
        .limit(1);

      if (currentTenant?.id) {
        configQuery = configQuery.eq('tenant_id', currentTenant.id);
      }

      const { data: config } = await configQuery.maybeSingle();
      if (config) {
        setWelcomeMsg(config.welcome_message || '');
        setAwayMsg(config.away_message || '');
        setWelcomeEnabled(config.welcome_enabled ?? true);
        setAwayEnabled(config.away_enabled ?? false);
      }

      // Load auto reply rules (module still exists on auto_reply_rules)
      let rulesQuery = supabase
        .from('auto_reply_rules')
        .select('*')
        .eq('module', module)
        .order('created_at', { ascending: true });

      if (currentTenant?.id) {
        rulesQuery = rulesQuery.eq('tenant_id', currentTenant.id);
      }

      const { data: rulesData } = await rulesQuery;
      if (rulesData) {
        setRules(
          rulesData.map((r) => ({
            id: r.id,
            trigger: r.trigger_keyword,
            response: r.response_text,
            enabled: r.is_active ?? true,
          }))
        );
      }

      setLoading(false);
    };
    load();
  }, [currentTenant?.id, module]);

  const toggleRule = (id: string) => {
    setRules((prev) => prev.map((r) => (r.id === id ? { ...r, enabled: !r.enabled } : r)));
  };

  const deleteRule = (id: string) => {
    setRules((prev) => prev.filter((r) => r.id !== id));
  };

  const addRule = () => {
    setRules((prev) => [
      ...prev,
      { id: `new-${Date.now()}`, trigger: '', response: '', enabled: true, isNew: true },
    ]);
  };

  const updateRule = (id: string, field: 'trigger' | 'response', value: string) => {
    setRules((prev) => prev.map((r) => (r.id === id ? { ...r, [field]: value } : r)));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // Update wa_config welcome/away messages
      let configQuery = supabase
        .from('wa_config')
        .select('id')
        .order('updated_at', { ascending: false })
        .limit(1);

      if (currentTenant?.id) {
        configQuery = configQuery.eq('tenant_id', currentTenant.id);
      }

      const { data: existing } = await configQuery.maybeSingle();

      if (existing) {
        await supabase
          .from('wa_config')
          .update({
            welcome_message: welcomeMsg,
            away_message: awayMsg,
            welcome_enabled: welcomeEnabled,
            away_enabled: awayEnabled,
          })
          .eq('id', existing.id);
      }

      // Delete old rules for this module/tenant then re-insert
      let deleteQuery = supabase
        .from('auto_reply_rules')
        .delete()
        .eq('module', module);

      if (currentTenant?.id) {
        deleteQuery = deleteQuery.eq('tenant_id', currentTenant.id);
      }

      await deleteQuery;

      // Insert current rules
      const validRules = rules.filter((r) => r.trigger.trim() && r.response.trim());
      if (validRules.length > 0) {
        await supabase.from('auto_reply_rules').insert(
          validRules.map((r) => ({
            trigger_keyword: r.trigger,
            response_text: r.response,
            is_active: r.enabled,
            tenant_id: currentTenant?.id || null,
            module,
          }))
        );
      }

      toast({ title: '✅ تم الحفظ', description: `تم حفظ إعدادات الرد التلقائي لـ ${title}` });
    } catch (err) {
      toast({ title: '❌ خطأ', description: 'حدث خطأ أثناء الحفظ', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6 overflow-y-auto h-full">
      <div>
        <h2 className="text-xl font-bold text-foreground">الرد التلقائي - {title}</h2>
        <p className="text-sm text-muted-foreground mt-1">
          إعداد الردود التلقائية - {currentTenant?.name || 'البراند'}
        </p>
      </div>

      {/* Welcome Message */}
      <Card className="p-5 bg-card border-border">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
              <MessageSquare className="w-4 h-4 text-primary" />
            </div>
            <div>
              <h3 className="font-semibold text-foreground text-sm">رسالة الترحيب</h3>
              <p className="text-xs text-muted-foreground">ترسل تلقائياً للعملاء الجدد</p>
            </div>
          </div>
          <Switch checked={welcomeEnabled} onCheckedChange={setWelcomeEnabled} />
        </div>
        <Textarea
          value={welcomeMsg}
          onChange={(e) => setWelcomeMsg(e.target.value)}
          className="bg-secondary border-0 text-sm min-h-[80px]"
          placeholder="اكتب رسالة الترحيب..."
        />
      </Card>

      {/* Away Message */}
      <Card className="p-5 bg-card border-border">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-accent/50 flex items-center justify-center">
              <Clock className="w-4 h-4 text-muted-foreground" />
            </div>
            <div>
              <h3 className="font-semibold text-foreground text-sm">رسالة خارج أوقات العمل</h3>
              <p className="text-xs text-muted-foreground">ترسل عند التواصل خارج مواعيد العمل</p>
            </div>
          </div>
          <Switch checked={awayEnabled} onCheckedChange={setAwayEnabled} />
        </div>
        <Textarea
          value={awayMsg}
          onChange={(e) => setAwayMsg(e.target.value)}
          className="bg-secondary border-0 text-sm min-h-[80px]"
          placeholder="اكتب رسالة خارج العمل..."
        />
      </Card>

      {/* Auto Reply Rules */}
      <Card className="p-5 bg-card border-border">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
              <Zap className="w-4 h-4 text-primary" />
            </div>
            <div>
              <h3 className="font-semibold text-foreground text-sm">قواعد الرد التلقائي</h3>
              <p className="text-xs text-muted-foreground">رد تلقائي بناءً على كلمات مفتاحية</p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={addRule} className="gap-1.5">
            <Plus className="w-3.5 h-3.5" />
            إضافة
          </Button>
        </div>

        <div className="space-y-4">
          {rules.map((rule) => (
            <div key={rule.id} className="p-4 rounded-xl bg-secondary/50 space-y-3">
              <div className="flex items-center justify-between">
                <Switch checked={rule.enabled} onCheckedChange={() => toggleRule(rule.id)} />
                <button
                  onClick={() => deleteRule(rule.id)}
                  className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">عند وجود الكلمة</Label>
                <Input
                  value={rule.trigger}
                  onChange={(e) => updateRule(rule.id, 'trigger', e.target.value)}
                  placeholder="مثال: الأسعار"
                  className="bg-card border-0 text-sm mt-1"
                />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">الرد</Label>
                <Textarea
                  value={rule.response}
                  onChange={(e) => updateRule(rule.id, 'response', e.target.value)}
                  placeholder="اكتب الرد التلقائي..."
                  className="bg-card border-0 text-sm mt-1 min-h-[60px]"
                />
              </div>
            </div>
          ))}
          {rules.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">
              لا توجد قواعد رد تلقائي بعد
            </p>
          )}
        </div>
      </Card>

      <Button
        onClick={handleSave}
        disabled={saving}
        className="w-full bg-primary text-primary-foreground hover:bg-primary/90"
      >
        {saving ? (
          <Loader2 className="w-4 h-4 ml-2 animate-spin" />
        ) : (
          <CheckCircle className="w-4 h-4 ml-2" />
        )}
        حفظ جميع الإعدادات
      </Button>
    </div>
  );
};

export default ConfirmAutoReply;
