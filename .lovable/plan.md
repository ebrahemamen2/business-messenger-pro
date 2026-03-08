

# تطوير شامل لواجهة الشات - مستوى منصات WhatsApp CRM الاحترافية

## الرؤية
تحويل الشات الحالي (البسيط) إلى واجهة احترافية تنافس Respond.io و Wati و Interakt، مع بناء المكونات كمكونات مشتركة (shared) تُستخدم في قسم التأكيد والمتابعة معاً.

## المعمارية المشتركة

```text
src/components/chat/
├── ChatList.tsx          (تحديث - فلاتر + labels + unread badge)
├── ChatWindow.tsx        (تحديث شامل)
├── ContactPanel.tsx      (تحديث - CRUD حقيقي)
├── MessageBubble.tsx     (جديد - فقاعة منفصلة)
├── QuickReplies.tsx      (جديد - ردود سريعة /snippet)
├── TemplateSelector.tsx  (جديد - قوالب واتساب)
├── ChatFilters.tsx       (جديد - فلترة وتصنيف)
├── MediaPreview.tsx      (جديد - عرض الوسائط)
├── ConversationLabels.tsx(جديد - labels للمحادثات)
├── AssignAgent.tsx       (جديد - تعيين موظف)
└── ChatNotes.tsx         (جديد - ملاحظات داخلية)
```

كل من `Confirm.tsx` و `FollowUp.tsx` يستخدمان نفس المكونات مع تمرير `module` prop.

---

## الميزات المخطط تنفيذها

### 1. ChatList - قائمة المحادثات المتقدمة
- **فلاتر المحادثات**: الكل / غير مقروء / مُعيَّن لي / مفتوح / مغلق
- **Labels ملونة** على كل محادثة (VIP, طلب جديد, مشكلة...)
- **Unread badge** حقيقي مع عداد
- **آخر نشاط** بصيغة "منذ 5 دقائق"
- **Online/typing indicator** (نقط خضراء)
- **Sort**: بالأحدث / بالأقدم / بعدد الرسائل غير المقروءة
- **بحث متقدم**: بالاسم، الرقم، محتوى الرسالة، التصنيف

### 2. ChatWindow - نافذة المحادثة
- **Header محسّن**: اسم + رقم + label + assigned agent + آخر ظهور + أزرار إجراءات
- **فقاعات رسائل محسّنة** (MessageBubble):
  - دعم الوسائط (صور/فيديو/مستندات/صوت) مع preview
  - حالة الرسالة المفصلة (sent ← delivered ← read) مع أيقونات
  - Reply/Quote لرسالة محددة
  - تمييز رسائل المتجر بشكل واضح
  - Timestamp ذكي (اليوم/أمس/تاريخ)
  - فواصل تاريخ بين الأيام
- **شريط الإدخال المتقدم**:
  - Emoji picker حقيقي
  - إرفاق ملفات/صور
  - Quick replies بـ `/` (slash command)
  - إرسال قوالب واتساب (Template messages)
  - زر تسجيل صوتي
  - Shift+Enter لسطر جديد
- **ملاحظات داخلية** (Internal notes): ملاحظات مرئية للفريق فقط وليس العميل

### 3. ContactPanel - لوحة العميل
- **تعديل مباشر**: الاسم، الإيميل، الملاحظات (CRUD حقيقي يحفظ في DB)
- **إدارة التصنيفات**: إضافة/حذف tags بشكل تفاعلي
- **سجل النشاط**: آخر رسالة، عدد المحادثات، تاريخ أول تواصل
- **تعيين موظف** (Assign): dropdown لاختيار الموظف المسؤول
- **حالة المحادثة**: مفتوح ← قيد المعالجة ← مغلق

### 4. Quick Replies / Snippets (ردود جاهزة)
- اكتب `/` في حقل الرسالة لعرض قائمة الردود السريعة
- إدارة الردود (إضافة/تعديل/حذف) من داخل الشات
- متغيرات ديناميكية: `{name}`, `{phone}`, `{order_id}`

### 5. Conversation Labels (تصنيفات المحادثات)
- تصنيفات ملونة قابلة للتخصيص
- فلترة المحادثات بالتصنيف
- إضافة/إزالة من داخل المحادثة

---

## تغييرات قاعدة البيانات

### جداول جديدة:
1. **`conversation_labels`** - تصنيفات المحادثات (name, color, tenant_id)
2. **`conversation_label_assignments`** - ربط التصنيف بالمحادثة
3. **`quick_replies`** - الردود الجاهزة (shortcut, body, tenant_id, module)
4. **`chat_notes`** - ملاحظات داخلية على المحادثة
5. **`conversation_assignments`** - تعيين موظف للمحادثة

### تعديلات:
- إضافة `status` (open/pending/resolved/closed) لجدول messages أو جدول conversations جديد
- إضافة `reply_to_message_id` لجدول messages لدعم Reply/Quote

---

## خطة التنفيذ (5 مراحل)

**المرحلة 1**: DB migrations + MessageBubble + تحسين فقاعات الرسائل + فواصل التاريخ + حالات الرسالة المفصلة

**المرحلة 2**: ChatList متقدم (فلاتر + labels + unread + sort + بحث محسّن)

**المرحلة 3**: شريط إدخال متقدم (emoji + إرفاق + quick replies بـ `/` + Shift+Enter)

**المرحلة 4**: ContactPanel محسّن (CRUD حقيقي + assign agent + حالة المحادثة + ملاحظات داخلية)

**المرحلة 5**: ربط FollowUp بنفس المكونات المشتركة

