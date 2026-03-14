import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Brain, Key, Loader2, CheckCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useTenantContext } from '@/contexts/TenantContext';

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

  const selectedProvider = PROVIDERS.find(p => p.value === provider);

  useEffect(() => {
    const load = async () => {
      if (!currentTenant?.id) return;
      setLoading(true);

      const { data } = await supabase
        .from('ai_config')
        .select('*')
        .eq('tenant_id', currentTenant.id)
        .maybeSingle();

      if (data) {
        setProvider((data as any).provider || 'lovable');
        setApiKey((data as any).api_key || '');
        setModel((data as any).model || 'google/gemini-2.5-flash');
        setIsActive((data as any).is_active ?? false);
        setExistingId(data.id);
      } else {
        setProvider('lovable');
        setApiKey('');
        setModel('google/gemini-2.5-flash');
        setIsActive(false);
        setExistingId(null);
      }
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
      const configData: Record<string, any> = {
        tenant_id: currentTenant.id,
        provider,
        api_key: provider === 'lovable' ? null : apiKey || null,
        model,
        is_active: isActive,
      };

      if (existingId) {
        await supabase.from('ai_config').update(configData).eq('id', existingId);
      } else {
        await supabase.from('ai_config').insert(configData);
      }

      toast({ title: '✅ تم الحفظ', description: 'تم حفظ إعدادات الذكاء الاصطناعي' });
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
        <h2 className="text-xl font-bold text-foreground">إعدادات الذكاء الاصطناعي</h2>
        <p className="text-sm text-muted-foreground mt-1">
          اختر مزود AI والنموذج لـ {currentTenant?.name || 'البراند'}
        </p>
        <p className="text-xs text-muted-foreground mt-2 bg-secondary/50 p-3 rounded-xl">
          💡 كل قسم (التأكيد / المتابعة / المفقود) له توجيهات AI خاصة تضبطها من داخل القسم. هنا بتختار المزود والنموذج الموحد للبراند.
        </p>
      </div>

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
