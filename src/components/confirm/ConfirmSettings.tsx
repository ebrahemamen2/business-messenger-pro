import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Copy, CheckCircle, Shield, Webhook, Key, Phone, Building2, Loader2, Store, RefreshCw } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useTenantContext } from '@/contexts/TenantContext';
import WebhookDiagnostics from '@/components/settings/WebhookDiagnostics';

const SUPABASE_PROJECT_ID = import.meta.env.VITE_SUPABASE_PROJECT_ID || 'mhbmxvgcdzhqwpznmgei';

function generateApiKey() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let key = 'sk_store_';
  for (let i = 0; i < 24; i++) key += chars.charAt(Math.floor(Math.random() * chars.length));
  return key;
}

function buildApiDocs(webhookUrl: string, apiKey: string) {
  return `📖 توثيق API للربط مع المتجر

🔐 Authentication
كل الطلبات لازم تحتوي على API Key في الـ Header:
x-store-api-key: ${apiKey || '<YOUR_API_KEY>'}

📦 1. طلب جديد — new_order
POST ${webhookUrl}
Header: x-store-api-key: <API_KEY>

{
  "event": "new_order",
  "timestamp": "2026-03-15T12:00:00Z",
  "order_number": "8270",
  "store_order_id": "uuid-xxx",
  "customer_name": "أحمد محمد",
  "customer_phone": "01012345678",
  "customer_phone_alt": "01198765432",
  "customer_email": null,
  "customer_city": "القاهرة",
  "customer_sub_zone": "مدينة نصر",
  "customer_address": "شارع عباس العقاد - عمارة 15",
  "payment_method": "cod",
  "payment_status": "pending",
  "order_status": "pending",
  "subtotal": 450.00,
  "shipping_cost": 50.00,
  "discount_amount": 0,
  "coupon_code": null,
  "total_amount": 500.00,
  "currency": "EGP",
  "notes": null,
  "items": [
    {
      "name": "منتج 1 (عرض القطعتين)",
      "product_id": "uuid-product",
      "quantity": 2,
      "unit_price": 150,
      "total_price": 300,
      "variant_info": "أحمر / XL"
    }
  ],
  "created_at": "2026-03-15T12:00:00Z"
}

✏️ 2. تعديل طلب — order_modified
POST ${webhookUrl}
Header: x-store-api-key: <API_KEY>

{
  "event": "order_modified",
  "timestamp": "2026-03-15T12:05:00Z",
  "order_number": "8270",
  "store_order_id": "uuid-xxx",
  "modification_type": "edit",
  "customer_name": "أحمد محمد",
  "customer_phone": "01012345678",
  "items": [...],
  "subtotal": 540,
  "shipping_cost": 50,
  "discount_amount": 0,
  "total_amount": 590,
  "currency": "EGP",
  "old_data": { "total_amount": 500, "items_count": 2 },
  "new_data": { "total_amount": 590, "items_count": 2 }
}

modification_type: "edit" لتعديل عادي، "upsell" لإضافة من عرض صفحة الشكر

🚫 3. طلب مفقود — lost_order
POST ${webhookUrl}
Header: x-store-api-key: <API_KEY>

{
  "event": "lost_order",
  "timestamp": "2026-03-15T12:30:00Z",
  "abandoned_checkout_id": "uuid-abandoned",
  "customer_name": "سارة أحمد",
  "customer_phone": "01098765432",
  "customer_city": "الإسكندرية",
  "customer_sub_zone": "سموحة",
  "customer_address": "شارع 14 مايو",
  "total_amount": 200.00,
  "currency": "EGP",
  "items": [
    { "name": "منتج", "quantity": 1, "price": 200, "product_id": "uuid-product" }
  ],
  "notes": "سلة متروكة",
  "created_at": "2026-03-15T12:00:00Z"
}

🔗 4. اختبار الربط — test_connection
{ "event": "test_connection", "timestamp": "..." }

⚠️ ملاحظات مهمة:
• أرقام الهواتف بصيغة مصرية 11 رقم (مثال: 01012345678)
• الحقول المطلوبة في new_order: order_number, customer_phone, items
• الحقول المطلوبة في order_modified: order_number, items
• الحقول المطلوبة في lost_order: customer_phone
• عند التعديل يتم إرسال البيانات الجديدة كاملة + old_data
• عند الإضافة من عرض بعد الشراء: modification_type = "upsell"
`;
}

const ConfirmSettings = () => {
  const { toast } = useToast();
  const { currentTenant } = useTenantContext();
  const [token, setToken] = useState('');
  const [phoneId, setPhoneId] = useState('');
  const [businessId, setBusinessId] = useState('');
  const [verifyToken, setVerifyToken] = useState('');
  const [welcomeEnabled, setWelcomeEnabled] = useState(true);
  const [storeApiKey, setStoreApiKey] = useState('');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  const webhookUrl = `https://${SUPABASE_PROJECT_ID}.supabase.co/functions/v1/whatsapp-webhook`;
  const storeWebhookUrl = `https://${SUPABASE_PROJECT_ID}.supabase.co/functions/v1/store-webhook`;

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
        setStoreApiKey(data.store_api_key || '');
      } else {
        setToken('');
        setPhoneId('');
        setBusinessId('');
        setVerifyToken('');
        setWelcomeEnabled(true);
        setStoreApiKey('');
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
        store_api_key: storeApiKey || null,
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

  const handleGenerateKey = () => {
    setStoreApiKey(generateApiKey());
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

      {/* WhatsApp API Card */}
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

      {/* Store Integration Card */}
      <Card className="p-6 bg-card border-border">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-xl bg-[hsl(var(--store-message))]/15 flex items-center justify-center">
            <Store className="w-5 h-5 text-[hsl(var(--store-message))]" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-foreground">ربط المتجر</h3>
            <p className="text-xs text-muted-foreground">
              استقبال الطلبات الجديدة والتعديلات والطلبات المفقودة من المتجر
            </p>
          </div>
        </div>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label className="flex items-center gap-2 text-sm">
              <Webhook className="w-3.5 h-3.5 text-muted-foreground" />
              Store Webhook URL
            </Label>
            <div className="flex gap-2">
              <Input
                value={storeWebhookUrl}
                readOnly
                className="flex-1 bg-secondary border-0 text-muted-foreground text-xs"
                dir="ltr"
              />
              <Button variant="outline" onClick={() => copyToClipboard(storeWebhookUrl, 'رابط الـ Store Webhook')} className="gap-2">
                <Copy className="w-4 h-4" />
                نسخ
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <Label className="flex items-center gap-2 text-sm">
              <Key className="w-3.5 h-3.5 text-muted-foreground" />
              Store API Key
            </Label>
            <div className="flex gap-2">
              <Input
                value={storeApiKey}
                onChange={(e) => setStoreApiKey(e.target.value)}
                placeholder="اضغط توليد لإنشاء كود جديد"
                className="flex-1 bg-secondary border-0 text-xs"
                dir="ltr"
              />
              <Button variant="outline" onClick={handleGenerateKey} className="gap-2">
                <RefreshCw className="w-4 h-4" />
                توليد
              </Button>
            </div>
          </div>
        </div>

        {/* API Documentation */}
        <div className="mt-6 space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-semibold text-foreground">📖 توثيق API للمطور</h4>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                const docs = buildApiDocs(storeWebhookUrl, storeApiKey);
                navigator.clipboard.writeText(docs);
                toast({ title: 'تم النسخ', description: 'تم نسخ التوثيق الكامل' });
              }}
              className="gap-1.5 text-xs"
            >
              <Copy className="w-3.5 h-3.5" />
              نسخ التوثيق كامل
            </Button>
          </div>

          <div className="p-3 rounded-xl bg-secondary/50 space-y-2">
            <p className="text-xs font-medium text-foreground">🔐 Authentication</p>
            <p className="text-xs text-muted-foreground">
              كل الطلبات لازم تحتوي على API Key في الـ Header:
            </p>
            <pre className="p-2 rounded-lg bg-background text-xs text-muted-foreground overflow-x-auto" dir="ltr">
{`x-store-api-key: ${storeApiKey || '<YOUR_API_KEY>'}`}
            </pre>
          </div>

          {/* Event 1: new_order */}
          <div className="p-3 rounded-xl bg-secondary/50 space-y-2">
            <p className="text-xs font-medium text-foreground">📦 1. طلب جديد — <code className="text-primary">new_order</code></p>
            <p className="text-xs text-muted-foreground">يتم إرساله فور وصول طلب جديد للمتجر</p>
            <pre className="p-2 rounded-lg bg-background text-xs text-muted-foreground overflow-x-auto" dir="ltr">
{`POST ${storeWebhookUrl}
Header: x-store-api-key: <API_KEY>

{
  "event": "new_order",
  "timestamp": "2026-03-15T12:00:00Z",
  "order_number": "8270",
  "store_order_id": "uuid-xxx",
  "customer_name": "أحمد محمد",
  "customer_phone": "01012345678",
  "customer_phone_alt": "01198765432",
  "customer_email": null,
  "customer_city": "القاهرة",
  "customer_sub_zone": "مدينة نصر",
  "customer_address": "شارع عباس العقاد - عمارة 15",
  "payment_method": "cod",
  "payment_status": "pending",
  "order_status": "pending",
  "subtotal": 450.00,
  "shipping_cost": 50.00,
  "discount_amount": 0,
  "coupon_code": null,
  "total_amount": 500.00,
  "currency": "EGP",
  "notes": null,
  "items": [
    {
      "name": "منتج 1 (عرض القطعتين)",
      "product_id": "uuid-product",
      "quantity": 2,
      "unit_price": 150,
      "total_price": 300,
      "variant_info": "أحمر / XL"
    }
  ],
  "created_at": "2026-03-15T12:00:00Z"
}`}
            </pre>
          </div>

          {/* Event 2: order_modified */}
          <div className="p-3 rounded-xl bg-secondary/50 space-y-2">
            <p className="text-xs font-medium text-foreground">✏️ 2. تعديل طلب — <code className="text-primary">order_modified</code></p>
            <p className="text-xs text-muted-foreground">يتم إرساله عند تعديل الطلب أو إضافة منتجات من عرض صفحة الشكر (Upsell)</p>
            <pre className="p-2 rounded-lg bg-background text-xs text-muted-foreground overflow-x-auto" dir="ltr">
{`POST ${storeWebhookUrl}
Header: x-store-api-key: <API_KEY>

{
  "event": "order_modified",
  "timestamp": "2026-03-15T12:05:00Z",
  "order_number": "8270",
  "store_order_id": "uuid-xxx",
  "modification_type": "edit",
  "customer_name": "أحمد محمد",
  "customer_phone": "01012345678",
  "items": [
    {
      "name": "منتج 1 (عرض 3 قطع)",
      "product_id": "uuid-product",
      "quantity": 3,
      "unit_price": 130,
      "total_price": 390,
      "variant_info": "أحمر / XL"
    }
  ],
  "subtotal": 540,
  "shipping_cost": 50,
  "discount_amount": 0,
  "total_amount": 590,
  "currency": "EGP",
  "old_data": { "total_amount": 500, "items_count": 2 },
  "new_data": { "total_amount": 590, "items_count": 2 }
}`}
            </pre>
            <p className="text-xs text-muted-foreground">
              <strong>modification_type:</strong> <code>"edit"</code> لتعديل عادي، <code>"upsell"</code> لإضافة من صفحة الشكر
            </p>
          </div>

          {/* Event 3: lost_order */}
          <div className="p-3 rounded-xl bg-secondary/50 space-y-2">
            <p className="text-xs font-medium text-foreground">🚫 3. طلب مفقود — <code className="text-primary">lost_order</code></p>
            <p className="text-xs text-muted-foreground">يتم إرساله بعد انتهاء مدة الانتظار المحددة (سلة متروكة)</p>
            <pre className="p-2 rounded-lg bg-background text-xs text-muted-foreground overflow-x-auto" dir="ltr">
{`POST ${storeWebhookUrl}
Header: x-store-api-key: <API_KEY>

{
  "event": "lost_order",
  "timestamp": "2026-03-15T12:30:00Z",
  "abandoned_checkout_id": "uuid-abandoned",
  "customer_name": "سارة أحمد",
  "customer_phone": "01098765432",
  "customer_city": "الإسكندرية",
  "customer_sub_zone": "سموحة",
  "customer_address": "شارع 14 مايو",
  "total_amount": 200.00,
  "currency": "EGP",
  "items": [
    {
      "name": "منتج",
      "quantity": 1,
      "price": 200,
      "product_id": "uuid-product"
    }
  ],
  "notes": "سلة متروكة",
  "created_at": "2026-03-15T12:00:00Z"
}`}
            </pre>
          </div>

          {/* Event 4: test_connection */}
          <div className="p-3 rounded-xl bg-secondary/50 space-y-2">
            <p className="text-xs font-medium text-foreground">🔗 4. اختبار الربط — <code className="text-primary">test_connection</code></p>
            <pre className="p-2 rounded-lg bg-background text-xs text-muted-foreground overflow-x-auto" dir="ltr">
{`POST ${storeWebhookUrl}
Header: x-store-api-key: <API_KEY>

{
  "event": "test_connection",
  "timestamp": "2026-03-15T12:00:00Z"
}`}
            </pre>
            <p className="text-xs text-muted-foreground">
              الرد المتوقع: أي رد بـ HTTP Status 200
            </p>
          </div>

          {/* Important Notes */}
          <div className="p-3 rounded-xl border border-primary/20 bg-primary/5 space-y-1.5">
            <p className="text-xs font-semibold text-foreground">⚠️ ملاحظات مهمة:</p>
            <ul className="text-xs text-muted-foreground space-y-1 list-disc list-inside">
              <li>أرقام الهواتف بصيغة مصرية 11 رقم (مثال: <code dir="ltr">01012345678</code>)</li>
              <li>الحقول المطلوبة في <code>new_order</code>: <code>order_number</code>, <code>customer_phone</code>, <code>items</code></li>
              <li>الحقول المطلوبة في <code>order_modified</code>: <code>order_number</code>, <code>items</code></li>
              <li>الحقول المطلوبة في <code>lost_order</code>: <code>customer_phone</code></li>
              <li>يتم إرسال كل البيانات الكاملة للطلب بما فيها الشحن والخصم والكوبون</li>
              <li>عند التعديل يتم إرسال البيانات الجديدة كاملة + بيانات قبل التعديل في <code>old_data</code></li>
              <li>عند الإضافة من عرض بعد الشراء يكون <code>modification_type = "upsell"</code></li>
            </ul>
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
        حفظ الإعدادات
      </Button>

      <WebhookDiagnostics />
    </div>
  );
};

export default ConfirmSettings;
