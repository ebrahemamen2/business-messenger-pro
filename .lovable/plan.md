

## خطة تنفيذ المميزات الاحترافية (متوافقة مع Meta API)

### المرحلة 1 - تحسينات فورية (بدون تغيير DB)

**1. إعادة إرسال الرسائل الفاشلة (Retry)**
- `MessageBubble.tsx`: إضافة زر "إعادة المحاولة" يظهر بجانب الرسائل ذات `status === 'failed'`
- عند الضغط يستدعي `onRetry(message)` callback جديد
- `ChatWindow.tsx`: إضافة `handleRetry` يعيد استدعاء `sendToWhatsApp` بنفس بيانات الرسالة الأصلية

**2. صوت إشعار عند وصول رسالة جديدة**
- `useConversations.ts`: في Realtime listener عند INSERT رسالة inbound جديدة، تشغيل صوت تنبيه
- إضافة ملف صوت `public/notification.mp3` (سنستخدم Web Audio API لصوت بسيط بدون ملف خارجي)

**3. Drag & Drop للملفات**
- `ChatWindow.tsx`: إضافة `onDragOver`, `onDragEnter`, `onDragLeave`, `onDrop` على منطقة الرسائل
- عرض overlay "أفلت الملفات هنا" عند السحب فوق المنطقة
- نفس منطق `handleFileSelect` الموجود

**4. عداد أرقام بجانب كل فلتر**
- `ChatFilters.tsx`: حساب عدد المحادثات لكل فلتر من `conversations` prop
- عرض Badge بجانب كل فلتر: "غير مقروء (5)"، "لم يتم الرد (3)"

### المرحلة 2 - تحسينات تحتاج DB

**5. تثبيت المحادثات (Pin)**
- Migration: إضافة `pinned_at` (timestamptz, nullable) في `conversations`
- `ChatList.tsx`: ترتيب المثبتة في الأعلى + أيقونة Pin
- `ChatWindow.tsx` dropdown: إضافة خيار "تثبيت/إلغاء تثبيت"
- `useConversations.ts`: تعديل الترتيب ليراعي `pinned_at`

**6. أرشفة المحادثات**
- Migration: إضافة `archived_at` (timestamptz, nullable) في `conversations`
- `ChatFilters.tsx`: إضافة فلتر "الأرشيف"
- `useConversations.ts`: استبعاد المؤرشفة من القائمة الافتراضية
- `ChatWindow.tsx` dropdown: خيار "أرشفة/إلغاء أرشفة"

**7. إعادة توجيه رسالة (Forward)**
- `MessageBubble.tsx`: زر forward في hover actions
- `ChatWindow.tsx`: Modal لاختيار المحادثة المستهدفة → إرسال المحتوى عبر `send-message`

**8. تعيين محادثة لموظف**
- `assigned_to` موجود بالفعل في الجدول
- `ChatWindow.tsx` dropdown: خيار "تعيين لموظف"
- `ChatFilters.tsx`: فلتر "محادثاتي"

### الملفات المتأثرة
- `src/components/chat/MessageBubble.tsx`
- `src/components/chat/ChatWindow.tsx`
- `src/components/chat/ChatList.tsx`
- `src/components/chat/ChatFilters.tsx`
- `src/hooks/useConversations.ts`
- Migration جديد (`pinned_at`, `archived_at`)

