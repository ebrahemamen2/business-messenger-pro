import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Bot, Plus, Trash2, Clock, MessageSquare, Zap } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface AutoReplyRule {
  id: string;
  trigger: string;
  response: string;
  enabled: boolean;
}

const defaultRules: AutoReplyRule[] = [
  { id: '1', trigger: 'السلام عليكم', response: 'وعليكم السلام ورحمة الله! أهلاً بيك 😊 كيف أقدر أساعدك؟', enabled: true },
  { id: '2', trigger: 'الأسعار', response: 'يمكنك الاطلاع على قائمة الأسعار من خلال الرابط التالي: [رابط الأسعار]. لأي استفسار إضافي أنا هنا!', enabled: true },
  { id: '3', trigger: 'مواعيد العمل', response: 'مواعيد العمل من السبت إلى الخميس، من 9 صباحاً حتى 6 مساءً. يوم الجمعة إجازة 🕐', enabled: false },
];

const AutoReply = () => {
  const { toast } = useToast();
  const [rules, setRules] = useState<AutoReplyRule[]>(defaultRules);
  const [welcomeMsg, setWelcomeMsg] = useState('أهلاً بيك! 👋 شكراً لتواصلك معنا. هيتم الرد عليك في أقرب وقت.');
  const [awayMsg, setAwayMsg] = useState('شكراً لرسالتك! 🌙 حالياً خارج أوقات العمل، هنرد عليك أول ما نرجع.');
  const [welcomeEnabled, setWelcomeEnabled] = useState(true);
  const [awayEnabled, setAwayEnabled] = useState(true);

  const toggleRule = (id: string) => {
    setRules((prev) => prev.map((r) => (r.id === id ? { ...r, enabled: !r.enabled } : r)));
  };

  const deleteRule = (id: string) => {
    setRules((prev) => prev.filter((r) => r.id !== id));
  };

  const addRule = () => {
    setRules((prev) => [...prev, { id: `new-${Date.now()}`, trigger: '', response: '', enabled: true }]);
  };

  const updateRule = (id: string, field: 'trigger' | 'response', value: string) => {
    setRules((prev) => prev.map((r) => (r.id === id ? { ...r, [field]: value } : r)));
  };

  const handleSave = () => {
    toast({ title: '✅ تم الحفظ', description: 'تم حفظ إعدادات الرد التلقائي' });
  };

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6 overflow-y-auto h-full">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">الرد التلقائي</h1>
          <p className="text-sm text-muted-foreground mt-1">إعداد الردود التلقائية والرسائل الذكية</p>
        </div>
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
            <div className="w-9 h-9 rounded-xl bg-status-pending/10 flex items-center justify-center">
              <Clock className="w-4 h-4 text-status-pending" />
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
        </div>
      </Card>

      <Button onClick={handleSave} className="w-full bg-primary text-primary-foreground hover:bg-primary/90">
        حفظ جميع الإعدادات
      </Button>
    </div>
  );
};

export default AutoReply;
