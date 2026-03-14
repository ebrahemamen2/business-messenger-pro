import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Brain, Key, Loader2, CheckCircle, Zap, AlertCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useTenantContext } from '@/contexts/TenantContext';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';

const PROVIDERS = [
  { value: 'lovable', label: 'Lovable AI (بدون مفتاح)', models: ['google/gemini-2.5-flash', 'google/gemini-2.5-pro', 'openai/gpt-5-mini', 'openai/gpt-5'] },
  { value: 'openai', label: 'OpenAI', models: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'gpt-3.5-turbo'] },
  { value: 'google', label: 'Google Gemini', models: ['gemini-2.5-flash', 'gemini-2.5-pro', 'gemini-2.0-flash'] },
  { value: 'anthropic', label: 'Anthropic Claude', models: ['claude-sonnet-4-20250514', 'claude-3-5-haiku-20241022'] },
];

const AISettings = () => {
  const { toast } = useToast();
  const { currentTenant } = useTenantContext();
  const [provider, setProvider] = useState('lovable');
  const [apiKey, setApiKey] = useState('');
  const [model, setModel] = useState('google/gemini-2.5-flash');
  const [isActive, setIsActive] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [existingId, setExistingId] = useState<string | null>(null);
  const [activeModules, setActiveModules] = useState<string[]>([]);

  const selectedProvider = PROVIDERS.find(p => p.value === provider);

  useEffect(() => {
    const load = async () => {
      if (!currentTenant?.id) {
        setLoading(false);
        return;
      }
      setLoading(true);

      const [configRes, modulesRes] = await Promise.all([
        supabase
          .from('ai_config')
          .select('*')
          .eq('tenant_id', currentTenant.id)
          .maybeSingle(),
        supabase
          .from('ai_module_prompts')
          .select('module, is_active')
          .eq('tenant_id', currentTenant.id),
      ]);

      if (configRes.data) {
        setProvider((configRes.data as any).provider || 'lovable');
        setApiKey((configRes.data as any).api_key || '');
        setModel((configRes.data as any).model || 'google/gemini-2.5-flash');
        setIsActive((configRes.data as any).is_active ?? false);
        setExistingId(configRes.data.id);
      } else {
        setProvider('lovable');
        setApiKey('');
        setModel('google/gemini-2.5-flash');
        setIsActive(false);
        setExistingId(null);
      }

      const active = (modulesRes.data || [])
        .filter((m: any) => m.is_active)
        .map((m: any) => m.module);
      setActiveModules(active);

      setLoading(false);
    };
    load();
  }, [currentTenant?.id]);

  const handleProviderChange = (val: string) => {
    setProvider(val);
    const prov = PROVIDERS.find(p => p.value === val);
    if (prov && prov.models.length > 0) {
      setModel(prov.models[0]);
    }
  };

  const handleSave = async () => {
    if (!currentTenant?.id) return;
    setSaving(true);
    try {
      const configData = {
        tenant_id: currentTenant.id,
        provider,
        api_key: provider === 'lovable' ? null : apiKey || null,
        model,
        is_active: isActive,
      };

      if (existingId) {
        await supabase.from('ai_config').update(configData as any).eq('id', existingId);
      } else {
        const { data: inserted } = await supabase.from('ai_config').insert(configData as any).select().single();
        if (inserted) setExistingId(inserted.id);
      }

      toast({ title: '✅ تم الحفظ', description: 'تم حفظ إعدادات الذكاء الاصطناعي' });
    } catch (err) {
      toast({ title: '❌ خطأ', description: 'حدث خطأ أثناء الحفظ', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const moduleNames: Record<string, string> = {
    confirm: 'التأكيد',
    followup: 'المتابعة',
    lost_orders: 'المفقود',
    new_orders: 'الطلبات الجديدة',
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
        <h2 className="text-xl font-bold text-foreground">إعدادات الذكاء الاصطناعي</h2>
        <p className="text-sm text-muted-foreground mt-1">
          اختر مزود AI والنموذج لـ {currentTenant?.name || 'البراند'}
        </p>
      </div>

      {/* Status Overview */}
      <Card className="p-4 bg-card border-border">
        <div className="flex items-center gap-3 mb-3">
          <Zap className={`w-5 h-5 ${isActive ? 'text-green-500' : 'text-muted-foreground'}`} />
          <div className="flex-1">
            <h3 className="text-sm font-semibold text-foreground">
              حالة AI: {isActive ? (
                <span className="text-green-500">مفعّل ✓</span>
              ) : (
                <span className="text-muted-foreground">معطّل</span>
              )}
            </h3>
          </div>
        </div>
        {activeModules.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            <span className="text-xs text-muted-foreground">أقسام مفعّلة:</span>
            {activeModules.map(m => (
              <Badge key={m} variant="secondary" className="text-xs">
                {moduleNames[m] || m}
              </Badge>
            ))}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">
            لا يوجد أقسام مفعّل فيها AI. فعّل التوجيهات من داخل كل قسم.
          </p>
        )}
      </Card>

      {/* Warning if active but no modules */}
      {isActive && activeModules.length === 0 && (
        <Alert className="border-amber-500/30 bg-amber-500/5">
          <AlertCircle className="h-4 w-4 text-amber-500" />
          <AlertDescription className="text-sm">
            AI مفعّل لكن لا يوجد قسم مفعّل فيه توجيهات. اذهب لقسم التأكيد أو المتابعة واكتب التوجيهات وفعّل AI.
          </AlertDescription>
        </Alert>
      )}

      <Card className="p-6 bg-card border-border space-y-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <Brain className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-foreground">تفعيل الذكاء الاصطناعي</h3>
              <p className="text-xs text-muted-foreground">تشغيل/إيقاف AI للبراند بالكامل</p>
            </div>
          </div>
          <Switch checked={isActive} onCheckedChange={setIsActive} />
        </div>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label className="text-sm">مزود الذكاء الاصطناعي</Label>
            <Select value={provider} onValueChange={handleProviderChange}>
              <SelectTrigger className="bg-secondary border-0">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PROVIDERS.map(p => (
                  <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {provider === 'lovable' && (
              <p className="text-xs text-green-600">✓ لا يحتاج مفتاح API — جاهز للاستخدام مباشرة</p>
            )}
          </div>

          {provider !== 'lovable' && (
            <div className="space-y-2">
              <Label className="flex items-center gap-2 text-sm">
                <Key className="w-3.5 h-3.5 text-muted-foreground" />
                API Key
              </Label>
              <Input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder={`أدخل مفتاح API الخاص بـ ${selectedProvider?.label}`}
                className="bg-secondary border-0"
                dir="ltr"
              />
            </div>
          )}

          <div className="space-y-2">
            <Label className="text-sm">النموذج</Label>
            <Select value={model} onValueChange={setModel}>
              <SelectTrigger className="bg-secondary border-0">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {selectedProvider?.models.map(m => (
                  <SelectItem key={m} value={m}>{m}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </Card>

      <p className="text-xs text-muted-foreground bg-secondary/50 p-3 rounded-xl">
        💡 كل قسم (التأكيد / المتابعة / المفقود) له توجيهات AI خاصة تضبطها من داخل القسم. هنا بتختار المزود والنموذج الموحد للبراند.
      </p>

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
        حفظ إعدادات AI
      </Button>
    </div>
  );
};

export default AISettings;