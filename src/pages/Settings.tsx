import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Copy, CheckCircle, Shield, Webhook, Key, Phone, Building2, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import WebhookDiagnostics from '@/components/settings/WebhookDiagnostics';

const SUPABASE_PROJECT_ID = import.meta.env.VITE_SUPABASE_PROJECT_ID || 'mhbmxvgcdzhqwpznmgei';

const Settings = () => {
  const { toast } = useToast();
  const [token, setToken] = useState('');
  const [phoneId, setPhoneId] = useState('');
  const [businessId, setBusinessId] = useState('');
  const [verifyToken, setVerifyToken] = useState('');
  const [autoReply, setAutoReply] = useState(true);
  const [notifications, setNotifications] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  const webhookUrl = `https://${SUPABASE_PROJECT_ID}.supabase.co/functions/v1/whatsapp-webhook`;

  // Load config from DB
  useEffect(() => {
    const loadConfig = async () => {
      const { data } = await supabase
        .from('wa_config')
        .select('*')
        .limit(1)
        .single();

      if (data) {
        setToken(data.access_token || '');
        setPhoneId(data.phone_number_id || '');
        setBusinessId(data.business_account_id || '');
        setVerifyToken(data.verify_token || '');
        setAutoReply(data.welcome_enabled ?? true);
      }
      setLoading(false);
    };
    loadConfig();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      // Check if config exists
      const { data: existing } = await supabase
        .from('wa_config')
        .select('id')
        .limit(1)
        .single();

      const configData = {
        access_token: token,
        phone_number_id: phoneId,
        business_account_id: businessId,
        verify_token: verifyToken,
        welcome_enabled: autoReply,
      };

      if (existing) {
        await supabase.from('wa_config').update(configData).eq('id', existing.id);
      } else {
        await supabase.from('wa_config').insert(configData);
      }

      toast({
        title: '✅ تم الحفظ',
        description: 'تم حفظ إعدادات الربط بنجاح في قاعدة البيانات',
      });
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

  const copyWebhook = () => {
    navigator.clipboard.writeText(webhookUrl);
    toast({ title: 'تم النسخ', description: 'تم نسخ رابط الـ Webhook' });
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
        <h1 className="text-2xl font-bold text-foreground">الإعدادات</h1>
        <p className="text-sm text-muted-foreground mt-1">إدارة إعدادات الربط والتكامل</p>
      </div>

      {/* API Connection */}
      <Card className="p-6 bg-card border-border">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <Shield className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-foreground">ربط واتساب API</h2>
            <p className="text-xs text-muted-foreground">بيانات Meta WhatsApp Business API</p>
          </div>
        </div>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label className="flex items-center gap-2 text-sm">
              <Key className="w-3.5 h-3.5 text-muted-foreground" />
              Access Token
            </Label>
            <Input
              type="password"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="أدخل الـ Access Token من Meta Developer Console"
              className="bg-secondary border-0"
            />
          </div>

          <div className="space-y-2">
            <Label className="flex items-center gap-2 text-sm">
              <Phone className="w-3.5 h-3.5 text-muted-foreground" />
              Phone Number ID
            </Label>
            <Input
              value={phoneId}
              onChange={(e) => setPhoneId(e.target.value)}
              placeholder="أدخل Phone Number ID"
              className="bg-secondary border-0"
            />
          </div>

          <div className="space-y-2">
            <Label className="flex items-center gap-2 text-sm">
              <Building2 className="w-3.5 h-3.5 text-muted-foreground" />
              Business Account ID
            </Label>
            <Input
              value={businessId}
              onChange={(e) => setBusinessId(e.target.value)}
              placeholder="أدخل Business Account ID"
              className="bg-secondary border-0"
            />
          </div>

          <div className="space-y-2">
            <Label className="flex items-center gap-2 text-sm">
              <Shield className="w-3.5 h-3.5 text-muted-foreground" />
              Webhook Verify Token
            </Label>
            <Input
              value={verifyToken}
              onChange={(e) => setVerifyToken(e.target.value)}
              placeholder="أدخل كلمة التحقق الخاصة بالـ Webhook"
              className="bg-secondary border-0"
            />
          </div>

          <div className="space-y-2">
            <Label className="flex items-center gap-2 text-sm">
              <Webhook className="w-3.5 h-3.5 text-muted-foreground" />
              Webhook URL
            </Label>
            <div className="flex gap-2">
              <Input
                value={webhookUrl}
                readOnly
                className="flex-1 bg-secondary border-0 text-muted-foreground text-xs"
                dir="ltr"
              />
              <Button variant="outline" onClick={copyWebhook} className="gap-2">
                <Copy className="w-4 h-4" />
                نسخ
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              انسخ هذا الرابط وأضفه في إعدادات الـ Webhook في Meta Developer Console
            </p>
          </div>
        </div>

        <Button
          onClick={handleSave}
          disabled={saving}
          className="w-full mt-6 bg-primary text-primary-foreground hover:bg-primary/90"
        >
          {saving ? (
            <Loader2 className="w-4 h-4 ml-2 animate-spin" />
          ) : (
            <CheckCircle className="w-4 h-4 ml-2" />
          )}
          حفظ الإعدادات
        </Button>
      </Card>

      {/* General Settings */}
      <Card className="p-6 bg-card border-border space-y-5">
        <h2 className="text-lg font-semibold text-foreground">إعدادات عامة</h2>

        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-foreground">الرد التلقائي</p>
            <p className="text-xs text-muted-foreground">رسالة ترحيب تلقائية للعملاء الجدد</p>
          </div>
          <Switch checked={autoReply} onCheckedChange={setAutoReply} />
        </div>

        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-foreground">الإشعارات</p>
            <p className="text-xs text-muted-foreground">إشعارات عند وصول رسالة جديدة</p>
          </div>
          <Switch checked={notifications} onCheckedChange={setNotifications} />
        </div>
      </Card>
    </div>
  );
};

export default Settings;
