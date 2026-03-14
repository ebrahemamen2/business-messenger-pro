import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Brain, Loader2, CheckCircle, AlertTriangle, Plus, X, AlertCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useTenantContext } from '@/contexts/TenantContext';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface AIModulePromptProps {
  module: string;
  title: string;
}

const AIModulePrompt = ({ module, title }: AIModulePromptProps) => {
  const { toast } = useToast();
  const { currentTenant } = useTenantContext();
  const [systemPrompt, setSystemPrompt] = useState('');
  const [isActive, setIsActive] = useState(false);
  const [escalationKeywords, setEscalationKeywords] = useState<string[]>([]);
  const [newKeyword, setNewKeyword] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [existingId, setExistingId] = useState<string | null>(null);
  const [globalAiActive, setGlobalAiActive] = useState<boolean | null>(null);
  const [globalAiProvider, setGlobalAiProvider] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      if (!currentTenant?.id) {
        setLoading(false);
        return;
      }
      setLoading(true);

      // Load module prompt and global AI config in parallel
      const [promptRes, configRes] = await Promise.all([
        supabase
          .from('ai_module_prompts')
          .select('*')
          .eq('tenant_id', currentTenant.id)
          .eq('module', module)
          .maybeSingle(),
        supabase
          .from('ai_config')
          .select('*')
          .eq('tenant_id', currentTenant.id)
          .maybeSingle(),
      ]);

      if (promptRes.data) {
        setSystemPrompt((promptRes.data as any).system_prompt || '');
        setIsActive((promptRes.data as any).is_active ?? false);
        setEscalationKeywords((promptRes.data as any).escalation_keywords || []);
        setExistingId(promptRes.data.id);
      } else {
        setSystemPrompt('');
        setIsActive(false);
        setEscalationKeywords([]);
        setExistingId(null);
      }

      if (configRes.data) {
        setGlobalAiActive((configRes.data as any).is_active ?? false);
        setGlobalAiProvider((configRes.data as any).provider || null);
      } else {
        setGlobalAiActive(null); // No config exists at all
        setGlobalAiProvider(null);
      }

      setLoading(false);
    };
    load();
  }, [currentTenant?.id, module]);

  const addKeyword = () => {
    const kw = newKeyword.trim();
    if (kw && !escalationKeywords.includes(kw)) {
      setEscalationKeywords(prev => [...prev, kw]);
      setNewKeyword('');
    }
  };

  const removeKeyword = (kw: string) => {
    setEscalationKeywords(prev => prev.filter(k => k !== kw));
  };

  const handleSave = async () => {
    if (!currentTenant?.id) return;
    setSaving(true);
    try {
      const promptData = {
        tenant_id: currentTenant.id,
        module,
        system_prompt: systemPrompt,
        is_active: isActive,
        escalation_keywords: escalationKeywords,
      };

      if (existingId) {
        await supabase.from('ai_module_prompts').update(promptData as any).eq('id', existingId);
      } else {
        const { data: inserted } = await supabase.from('ai_module_prompts').insert(promptData as any).select().single();
        if (inserted) setExistingId(inserted.id);
      }

      // Auto-create global ai_config if it doesn't exist and module is being activated
      if (globalAiActive === null && isActive) {
        const { data: newConfig } = await supabase.from('ai_config').insert({
          tenant_id: currentTenant.id,
          provider: 'lovable',
          model: 'google/gemini-2.5-flash',
          is_active: true,
        } as any).select().single();
        if (newConfig) {
          setGlobalAiActive(true);
          setGlobalAiProvider('lovable');
        }
      }

      toast({ title: '✅ تم الحفظ', description: `تم حفظ إعدادات AI لـ ${title}` });
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

  const showGlobalWarning = globalAiActive === false;
  const showNoConfigWarning = globalAiActive === null;

  return (
    <div className="p-4 sm:p-6 max-w-3xl mx-auto space-y-4 sm:space-y-6 overflow-y-auto h-full">
      <div>
        <h2 className="text-xl font-bold text-foreground">إعدادات AI - {title}</h2>
        <p className="text-sm text-muted-foreground mt-1">
          توجيهات الذكاء الاصطناعي للرد التلقائي في {title}
        </p>
      </div>

      {/* Warning: Global AI not active */}
      {showGlobalWarning && (
        <Alert variant="destructive" className="border-destructive/30 bg-destructive/5">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription className="text-sm">
            <strong>⚠️ AI معطّل على مستوى البراند.</strong> حتى لو فعّلت AI هنا، لن يعمل الرد التلقائي.
            اذهب إلى <strong>الإعدادات → الذكاء الاصطناعي</strong> وفعّل AI أولاً.
          </AlertDescription>
        </Alert>
      )}

      {/* Info: No config exists - will auto-create */}
      {showNoConfigWarning && isActive && (
        <Alert className="border-primary/30 bg-primary/5">
          <Brain className="h-4 w-4 text-primary" />
          <AlertDescription className="text-sm text-foreground">
            💡 سيتم تفعيل AI تلقائياً باستخدام <strong>Lovable AI (Gemini 2.5 Flash)</strong> عند الحفظ. يمكنك تغيير المزود من الإعدادات لاحقاً.
          </AlertDescription>
        </Alert>
      )}

      {/* AI Toggle */}
      <Card className="p-5 bg-card border-border">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <Brain className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-foreground">تفعيل AI لهذا القسم</h3>
              <p className="text-xs text-muted-foreground">تشغيل الرد التلقائي بالذكاء الاصطناعي في {title}</p>
              {globalAiActive && globalAiProvider && (
                <p className="text-xs text-primary mt-0.5">
                  المزود: {globalAiProvider === 'lovable' ? 'Lovable AI' : globalAiProvider}
                </p>
              )}
            </div>
          </div>
          <Switch checked={isActive} onCheckedChange={setIsActive} />
        </div>
      </Card>

      {/* System Prompt */}
      <Card className="p-5 bg-card border-border space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
            <Brain className="w-4 h-4 text-primary" />
          </div>
          <div>
            <h3 className="font-semibold text-foreground text-sm">توجيهات AI (System Prompt)</h3>
            <p className="text-xs text-muted-foreground">اشرح للذكاء الاصطناعي كيف يتعامل مع العملاء في هذا القسم</p>
          </div>
        </div>
        <Textarea
          value={systemPrompt}
          onChange={(e) => setSystemPrompt(e.target.value)}
          className="bg-secondary border-0 text-sm min-h-[200px] font-mono"
          placeholder={`مثال: أنت مساعد ذكي في ${title}. مهمتك هي:\n- الرد على استفسارات العملاء بأدب\n- تأكيد بيانات الطلب\n- إبلاغ العميل بأي تحديثات\n\nلا تقم بالتالي:\n- لا تعطي وعود غير مؤكدة\n- لا تشارك معلومات حساسة`}
          dir="rtl"
        />
        {systemPrompt && (
          <p className="text-xs text-muted-foreground text-left" dir="ltr">
            {systemPrompt.length} characters
          </p>
        )}
      </Card>

      {/* Escalation Keywords */}
      <Card className="p-5 bg-card border-border space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-destructive/10 flex items-center justify-center">
            <AlertTriangle className="w-4 h-4 text-destructive" />
          </div>
          <div>
            <h3 className="font-semibold text-foreground text-sm">كلمات التصعيد</h3>
            <p className="text-xs text-muted-foreground">عند وجود هذه الكلمات في رسالة العميل، يتوقف AI ويحول للموظف</p>
          </div>
        </div>

        <div className="flex gap-2">
          <Input
            value={newKeyword}
            onChange={(e) => setNewKeyword(e.target.value)}
            placeholder="مثال: شكوى، مدير، إلغاء..."
            className="bg-secondary border-0 text-sm flex-1"
            onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addKeyword())}
          />
          <Button variant="outline" size="sm" onClick={addKeyword} className="gap-1">
            <Plus className="w-3.5 h-3.5" />
            إضافة
          </Button>
        </div>

        <div className="flex flex-wrap gap-2">
          {escalationKeywords.map((kw) => (
            <Badge key={kw} variant="secondary" className="gap-1 text-xs py-1 px-2.5">
              {kw}
              <button onClick={() => removeKeyword(kw)} className="hover:text-destructive transition-colors">
                <X className="w-3 h-3" />
              </button>
            </Badge>
          ))}
          {escalationKeywords.length === 0 && (
            <p className="text-xs text-muted-foreground">لم تُضاف كلمات تصعيد بعد</p>
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
        حفظ إعدادات AI - {title}
      </Button>
    </div>
  );
};

export default AIModulePrompt;