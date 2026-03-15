

# خطة التنفيذ: سجل المتابعة + تاب Done

## 1. إنشاء جدول `shipment_followup_history`
- `id`, `shipment_id` (FK → shipment_tracking), `tenant_id`, `action_status`, `notes`, `final_status_snapshot`, `done_status` (default 'pending'), `done_notes`, `created_at`
- RLS: authenticated + service_role = ALL

## 2. تعديل `AllShipmentsTable.tsx` — حفظ السجل قبل الـ Reset
- قبل الـ upsert: جلب الشحنات اللي `status != 'pending'` أو عندها `notes`
- حفظها في `shipment_followup_history`
- بعد كده reset الـ `status` و `notes` للشحنات الموجودة

## 3. تعديل مربع العداد في `FollowupShipmentsTable.tsx`
- جلب آخر سجل من `shipment_followup_history` للشحنة الحالية
- عرضه تحت بيانات الشحنة: "آخر متابعة: [الحالة] — [الملاحظة] (منذ X أيام)"

## 4. إنشاء `DoneShipmentsTable.tsx`
- جلب السجلات من `shipment_followup_history` اللي `action_status` بتاعها = الحالة المحددة (جاهز للاستلام أو أي حالة يختارها المستخدم من الإعدادات)
- Join مع `shipment_tracking` لجلب `final_status` الحالي و `shipment_code`
- أعمدة: التاريخ، البوليصة، الملاحظة، حالة شركة الشحن الحالية، حالة Done، ملاحظة Done
- فلاتر + بحث + تعديل مباشر لحالة Done وملاحظاتها

## 5. تعديل `FollowUp.tsx` — إضافة تاب Done

## الملفات المتأثرة
| ملف | تعديل |
|------|--------|
| Migration جديد | إنشاء `shipment_followup_history` |
| `AllShipmentsTable.tsx` | أرشفة قبل الـ upsert |
| `FollowupShipmentsTable.tsx` | عرض آخر متابعة في العداد |
| `DoneShipmentsTable.tsx` | ملف جديد |
| `FollowUp.tsx` | تاب Done |

