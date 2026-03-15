import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Copy, CheckCircle, Shield, Webhook, Key, Phone, Building2, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useTenantContext } from '@/contexts/TenantContext';
import WebhookDiagnostics from '@/components/settings/WebhookDiagnostics';

const SUPABASE_PROJECT_ID = import.meta.env.VITE_SUPABASE_PROJECT_ID || 'mhbmxvgcdzhqwpznmgei';

const ConfirmSettings = () => {
  const { toast } = useToast();
  const { currentTenant } = useTenantContext();
  const [token, setToken] = useState('');
  const [phoneId, setPhoneId] = useState('');
  const [businessId, setBusinessId] = useState('');
  const [verifyToken, setVerifyToken] = useState('');
  const [welcomeEnabled, setWelcomeEnabled] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  const webhookUrl = `https://${SUPABASE_PROJECT_ID}.supabase.co/functions/v1/whatsapp-webhook`;

  useEffect(() => {
    const loadConfig = async () => {
      setLoading(true);
      let query = supabase
        .from('wa_config')
        .select('*')
        .order('updated_at', { ascending: false })
        .limit(1);

      if (currentTenant?.id) {
        query = query.eq('tenant_id', currentTenant.id);
      }

      const { data } = await query.maybeSingle();

      if (data) {
        setToken(data.access_token || '');
        setPhoneId(data.phone_number_id || '');
        setBusinessId(data.business_account_id || '');
        setVerifyToken(data.verify_token || '');
        setWelcomeEnabled(data.welcome_enabled ?? true);
      } else {
        setToken('');
        setPhoneId('');
        setBusinessId('');
        setVerifyToken('');
        setWelcomeEnabled(true);
      }
      setLoading(false);
    };
    loadConfig();
  }, [currentTenant?.id]);

  const handleSave = async () => {
    setSaving(true);
    try {
      let existingQuery = supabase
        .from('wa_config')
        .select('id')
        .order('updated_at', { ascending: false })
        .limit(1);

      if (currentTenant?.id) {
        existingQuery = existingQuery.eq('tenant_id', currentTenant.id);
      }

      const { data: existing } = await existingQuery.maybeSingle();

      const configData: Record<string, any> = {
        access_token: token,
        phone_number_id: phoneId,
        business_account_id: businessId,
        verify_token: verifyToken,
        welcome_enabled: welcomeEnabled,
      };

      if (currentTenant?.id) {
        configData.tenant_id = currentTenant.id;
      }

      if (existing) {
        await supabase.from('wa_config').update(configData).eq('id', existing.id);
      } else {
        await supabase.from('wa_config').insert(configData);
      }

      const subResult = await supabase.functions.invoke('whatsapp-subscription', {
        body: { action: 'subscribe' },
      });

      if (subResult.error || !subResult.data?.ok) {
        toast({
          title: '⚠️ تم الحفظ',
          description: 'تم حفظ الإعدادات لكن تفعيل استقبال الرسائل يحتاج مراجعة في Meta',
          variant: 'destructive',
        });
      } else {
        toast({
          title: '✅ تم الحفظ والتفعيل',
          description: 'تم حفظ إعدادات الواتساب وتفعيل اشتراك استقبال الرسائل بنجاح',
        });
      }
    } catch (err) {
      toast({
        title: '❌ خطأ',
        description: 'حدث خطأ أثناء حفظ الإعدادات',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: 'تم النسخ', description: `تم نسخ ${label}` });
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
        <h2 className="text-xl font-bold text-foreground">إعدادات الواتساب</h2>
        <p className="text-sm text-muted-foreground mt-1">
          رقم واتساب موحد للبراند - {currentTenant?.name || 'البراند'}
        </p>
      </div>

      <Card className="p-6 bg-card border-border">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <Shield className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-foreground">ربط واتساب API</h3>
            <p className="text-xs text-muted-foreground">بيانات Meta WhatsApp Business API</p>
          </div>
        </div>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label className="flex items-center gap-2 text-sm">
              <Key className="w-3.5 h-3.5 text-muted-foreground" />
              Access Token
            </Label>
            <Input type="password" value={token} onChange={(e) => setToken(e.target.value)} placeholder="أدخل الـ Access Token من Meta Developer Console" className="bg-secondary border-0" />
          </div>

          <div className="space-y-2">
            <Label className="flex items-center gap-2 text-sm">
              <Phone className="w-3.5 h-3.5 text-muted-foreground" />
              Phone Number ID
            </Label>
            <Input value={phoneId} onChange={(e) => setPhoneId(e.target.value)} placeholder="أدخل Phone Number ID" className="bg-secondary border-0" />
          </div>

          <div className="space-y-2">
            <Label className="flex items-center gap-2 text-sm">
              <Building2 className="w-3.5 h-3.5 text-muted-foreground" />
              Business Account ID
            </Label>
            <Input value={businessId} onChange={(e) => setBusinessId(e.target.value)} placeholder="أدخل Business Account ID" className="bg-secondary border-0" />
          </div>

          <div className="space-y-2">
            <Label className="flex items-center gap-2 text-sm">
              <Shield className="w-3.5 h-3.5 text-muted-foreground" />
              Webhook Verify Token
            </Label>
            <Input value={verifyToken} onChange={(e) => setVerifyToken(e.target.value)} placeholder="أدخل كلمة التحقق الخاصة بالـ Webhook" className="bg-secondary border-0" />
          </div>

          <div className="space-y-2">
            <Label className="flex items-center gap-2 text-sm">
              <Webhook className="w-3.5 h-3.5 text-muted-foreground" />
              Webhook URL
            </Label>
            <div className="flex gap-2">
              <Input value={webhookUrl} readOnly className="flex-1 bg-secondary border-0 text-muted-foreground text-xs" dir="ltr" />
              <Button variant="outline" onClick={() => copyToClipboard(webhookUrl, 'رابط الـ Webhook')} className="gap-2">
                <Copy className="w-4 h-4" />
                نسخ
              </Button>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between mt-6 p-3 rounded-xl bg-secondary/50">
          <div>
            <p className="text-sm font-medium text-foreground">رسالة الترحيب التلقائية</p>
            <p className="text-xs text-muted-foreground">ترسل للعملاء الجدد</p>
          </div>
          <Switch checked={welcomeEnabled} onCheckedChange={setWelcomeEnabled} />
        </div>
      </Card>

      <Button onClick={handleSave} disabled={saving} className="w-full bg-primary text-primary-foreground hover:bg-primary/90">
        {saving ? <Loader2 className="w-4 h-4 ml-2 animate-spin" /> : <CheckCircle className="w-4 h-4 ml-2" />}
        حفظ الإعدادات
      </Button>

      <WebhookDiagnostics />
    </div>
  );
};

export default ConfirmSettings;
