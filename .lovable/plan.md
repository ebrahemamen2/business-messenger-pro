

# المرحلة 1: إعادة الهيكلة الأساسية

## ملخص التغييرات

### 1. تعديل قاعدة البيانات

**`wa_config`** - إزالة عمود `module` وتوحيد الإعدادات per-tenant:
```sql
ALTER TABLE wa_config DROP COLUMN module;
-- إضافة UNIQUE constraint على tenant_id
ALTER TABLE wa_config ADD CONSTRAINT wa_config_tenant_unique UNIQUE (tenant_id);
```

**`ai_config` (جدول جديد)** - إعدادات AI لكل براند مع دعم كل المزودين:
```text
ai_config
├── id (uuid PK)
├── tenant_id (uuid, UNIQUE)
├── provider: 'lovable' | 'openai' | 'google' | 'anthropic'
├── api_key (text, nullable) — null لو lovable
├── model (text) — اسم النموذج المحدد
├── is_active (boolean)
├── created_at, updated_at
```

**`ai_module_prompts` (جدول جديد)** - توجيهات AI مختلفة لكل module:
```text
ai_module_prompts
├── id (uuid PK)
├── tenant_id (uuid)
├── module: 'confirm' | 'followup' | 'lost'
├── system_prompt (text) — التوجيهات
├── is_active (boolean)
├── escalation_keywords (text[]) — كلمات التصعيد للموظف
├── UNIQUE(tenant_id, module)
```

**`conversations.module`** - دعم القيم الجديدة `'lost'` و `'new_orders'`

### 2. تعديل Sidebar و Navigation

- إضافة أيقونتين جديدتين: "المفقود" (PackageX) و "الطلبات" (ShoppingBag)
- تحديث `mobileNav` و `mainNav` في `App.tsx` و `AppSidebar.tsx`

### 3. صفحات جديدة

**`/lost-orders`** - قسم الطلبات المفقودة:
- نفس بنية Confirm.tsx (شات + إعدادات) مع `module='lost'`

**`/new-orders`** - قسم الطلبات الجديدة:
- حالياً صفحة فارغة (placeholder) - هيتبنى في المرحلة 2

### 4. تعديل إعدادات الواتساب

- نقل إعدادات الواتساب من داخل كل قسم (tabs) لصفحة الإعدادات العامة
- كل قسم يحتفظ بـ tab الشات + tab إعدادات AI الخاصة به

### 5. خاصية نقل المحادثة بين الأقسام

- إضافة زر "نقل لقسم..." في header المحادثة أو ContactPanel
- `moveConversation(dbId, newModule)` → يعمل update على `conversations.module`
- المحادثة تختفي من القسم الحالي وتظهر في الجديد

### 6. تعديل الويبهوك

- بدل ما يحدد module من `wa_config.module`، يستخدم module افتراضي `'confirm'`
- لاحقاً: تحديد module بناءً على اسم القالب (template name) القادم من store webhook

## الملفات المتأثرة

```text
جديد:
- src/pages/LostOrders.tsx
- src/pages/NewOrders.tsx

تعديل:
- src/App.tsx (routes جديدة)
- src/components/layout/AppSidebar.tsx (nav items)
- src/pages/Settings.tsx (إضافة إعدادات واتساب هنا)
- src/pages/Confirm.tsx (إزالة tab إعدادات واتساب)
- src/pages/FollowUp.tsx (إزالة tab إعدادات واتساب)
- src/hooks/useConversations.ts (إضافة moveConversation)
- src/components/chat/ChatWindow.tsx (زر نقل القسم)
- supabase/functions/whatsapp-webhook/index.ts (تعديل module logic)

Migration:
- تعديل wa_config + إنشاء ai_config + ai_module_prompts
```

## ملاحظات مهمة
- الشات الموحد: كل الرسائل مربوطة بالعميل (`contact_phone`)، الـ module بيحدد أي قسم يعرض المحادثة
- النقل بين الأقسام = تغيير `module` في record المحادثة فقط
- إعدادات AI: كل براند يختار مزود واحد (Lovable/OpenAI/Google/Anthropic) ومفتاح API واحد، لكن كل module له system prompt مختلف

