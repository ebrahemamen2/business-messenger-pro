

## تطبيق قاعدة الـ 24 ساعة من Meta

### التغييرات

**1. قاعدة البيانات (Migration)**
- اضافة عمود `last_customer_message_at` (timestamptz, nullable) في جدول `conversations`
- Backfill: تحديث القيمة من آخر رسالة inbound في جدول `messages` لكل محادثة

**2. Edge Function: `whatsapp-webhook`**
- في `upsertConversationFromMessage`: عند `direction === "inbound"` اضافة `last_customer_message_at: atIso` في update و insert

**3. Edge Function: `send-message`**
- قبل الارسال: جلب `last_customer_message_at` من المحادثة، اذا مر اكثر من 24 ساعة → رفض الارسال برسالة خطأ عربية واضحة
- Status 403 مع رسالة: "انتهت نافذة الـ 24 ساعة - لا يمكن الرد"

**4. Frontend: `useConversations.ts`**
- اضافة `lastCustomerMessageAt: string | null` في `ChatConversation` interface
- قراءة `last_customer_message_at` من الداتابيز وتمريره

**5. Frontend: `ChatWindow.tsx`**
- حساب `isWindowExpired` من `lastCustomerMessageAt`
- حساب `remainingTime` للعرض (متبقي X ساعة/دقيقة)
- اذا انتهت النافذة:
  - عرض بانر تحذيري فوق مربع الكتابة (أصفر/برتقالي): "⚠️ انتهت نافذة الـ 24 ساعة - لا يمكن الرد على هذه المحادثة"
  - تعطيل مربع الكتابة وأزرار الارسال والمرفقات والفويس
- اذا اقتربت من الانتهاء (اقل من ساعة): عرض تنبيه خفيف "⏰ متبقي X دقيقة"
- Timer يحدث كل دقيقة لتحديث الحالة تلقائياً

**6. Frontend: `ChatList.tsx`**
- عرض أيقونة ساعة صغيرة بجانب المحادثات المنتهية نافذتها (اختياري، تحسين بصري)

### الملفات المتأثرة
- `supabase/migrations/` (migration جديد)
- `supabase/functions/whatsapp-webhook/index.ts`
- `supabase/functions/send-message/index.ts`
- `src/hooks/useConversations.ts`
- `src/components/chat/ChatWindow.tsx`

