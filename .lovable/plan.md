

## المشكلة

عند تحديد محادثات وتغيير حالتها لـ "مقروء"، التحديث بيحصل في قاعدة البيانات لكن الواجهة مش بتتحدث فوراً. السبب إن `bulkUpdateChatStatus` بيعمل update في الداتابيز وبعدين يستدعي `loadList()` بدون تحديث محلي فوري (optimistic update)، فالمستخدم بيفضل شايف الحالة القديمة لحد ما الـ reload يخلص.

كمان ممكن يكون في race condition مع `listRequestIdRef` لو `loadList` اتنادت من مكان تاني في نفس الوقت.

## الحل

### 1. إضافة Optimistic Update في `bulkUpdateChatStatus` (`useConversations.ts`)
- قبل ما نستدعي الداتابيز، نحدث الـ state المحلي فوراً:
  - نغير `chatStatus` للمحادثات المحددة
  - نغير `unreadCount` بناءً على الحالة الجديدة
- بعدين نعمل الـ DB update
- بعدين نعمل `loadList()` للتأكيد

### 2. تحديث `handleBulkAction` في `ChatList.tsx`
- بعد ما الـ bulk action يخلص، لو الفلتر الحالي هو `unread` والعملية كانت "مقروء"، المحادثات المحددة هتختفي من الفلتر تلقائياً لأن الـ state اتحدث

### الملفات المتأثرة
- `src/hooks/useConversations.ts` — إضافة optimistic update في `bulkUpdateChatStatus`

