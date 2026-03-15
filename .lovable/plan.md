

# تنفيذ: إزالة Quick Reply من قسم المتغيرات + تنظيف الكود

## الملخص

3 تعديلات بسيطة لإزالة الارتباك في واجهة إعدادات القوالب:

## التغييرات

### 1. `src/components/followup/FollowupWATemplates.tsx`

**قسم الأزرار في نموذج القالب (سطر 419-477):**
- تغيير العنوان من "الأزرار (Buttons)" إلى **"أزرار URL الديناميكية"**
- إضافة تنبيه واضح: "هذا القسم خاص فقط بأزرار URL — أزرار Quick Reply تتظبط من زر ⚡"
- إزالة خيار نوع الزر (URL / Quick Reply) — كل الأزرار هنا تكون URL تلقائياً
- إزالة حقل "الـ Payload (بيانات الرد)" — يبقى فقط "الجزء الديناميكي من الرابط"
- تحديث نص الزر من "إضافة زر" إلى "إضافة زر URL"

### 2. `supabase/functions/send-wa-template/index.ts`

**دالة `buildTemplateComponents` (سطر 60-80):**
- إزالة كود إرسال `quick_reply` payload بالكامل
- فقط أزرار URL هي اللي بتتبعت مع parameters
- إضافة تعليق توضيحي: Quick Reply buttons are static — automation handled via followup_button_actions

### 3. معاينة الربط (Preview section)
- تحديث عرض الأزرار في المعاينة ليظهر "زر URL" بدل "رد سريع"

## النتيجة
- قسم المتغيرات: **URL فقط** (روابط ديناميكية)
- ردود Quick Reply + تغيير الحالة: من زر **⚡** (شغال ومتظبط أصلاً)
- لا حاجة لتعديلات في الـ webhook أو الـ database — كل حاجة هناك شغالة صح

