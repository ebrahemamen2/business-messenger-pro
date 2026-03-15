import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useTenantContext } from '@/contexts/TenantContext';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Plus, Trash2, MessageSquare, Info, Variable, Edit2 } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';

interface VariableMapping {
  position: number; // {{1}}, {{2}}, etc.
  field: string;    // shipment field key
  component: string; // 'body' or 'header'
}

interface WATemplate {
  id: string;
  template_name: string;
  language: string;
  description: string | null;
  has_variables: boolean;
  variable_mappings: VariableMapping[];
  created_at: string;
}

const LANGUAGES = [
  { code: 'ar', label: 'العربية' },
  { code: 'en', label: 'English' },
  { code: 'en_US', label: 'English (US)' },
  { code: 'en_GB', label: 'English (UK)' },
];

// Available shipment fields to map to template variables
export const SHIPMENT_FIELDS: { key: string; label: string; example: string }[] = [
  { key: 'customer_name', label: 'اسم العميل', example: 'أحمد محمد' },
  { key: 'customer_phone', label: 'رقم الهاتف', example: '201012345678' },
  { key: 'customer_address', label: 'العنوان', example: 'شارع التحرير، القاهرة' },
  { key: 'customer_area', label: 'المنطقة', example: 'المعادي' },
  { key: 'shipment_code', label: 'رقم البوليصة', example: 'SHP-12345' },
  { key: 'order_code', label: 'كود الطلب', example: 'ORD-567' },
  { key: 'order_details', label: 'تفاصيل الطلب', example: 'تيشيرت أسود XL' },
  { key: 'amount', label: 'المبلغ', example: '350' },
  { key: 'final_status', label: 'حالة الشحن', example: 'CR' },
  { key: 'status_description', label: 'تفصيل الحالة', example: 'العميل رفض الاستلام' },
  { key: 'proc_notes', label: 'ملاحظات الشحن', example: 'الهاتف مغلق' },
  { key: 'shipping_company', label: 'شركة الشحن', example: 'J&T' },
  { key: 'last_status_date', label: 'تاريخ آخر حالة', example: '2026-03-14' },
  { key: 'pickup_date', label: 'تاريخ الاستلام', example: '2026-03-10' },
];

const FollowupWATemplates = () => {
  const { currentTenant } = useTenantContext();
  const { toast } = useToast();
  const [templates, setTemplates] = useState<WATemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<WATemplate | null>(null);
  const [newTemplate, setNewTemplate] = useState({
    template_name: '',
    language: 'ar',
    description: '',
    has_variables: false,
    variable_mappings: [] as VariableMapping[],
  });

  const loadTemplates = useCallback(async () => {
    if (!currentTenant?.id) { setLoading(false); return; }
    setLoading(true);
    const { data } = await supabase
      .from('followup_wa_templates')
      .select('*')
      .eq('tenant_id', currentTenant.id)
      .order('created_at', { ascending: false });
    setTemplates((data as unknown as WATemplate[]) || []);
    setLoading(false);
  }, [currentTenant?.id]);

  useEffect(() => { loadTemplates(); }, [loadTemplates]);

  const resetForm = () => {
    setNewTemplate({ template_name: '', language: 'ar', description: '', has_variables: false, variable_mappings: [] });
    setEditingTemplate(null);
  };

  const addVariable = () => {
    const nextPos = newTemplate.variable_mappings.length + 1;
    setNewTemplate(p => ({
      ...p,
      has_variables: true,
      variable_mappings: [...p.variable_mappings, { position: nextPos, field: 'customer_name', component: 'body' }],
    }));
  };

  const updateVariable = (index: number, updates: Partial<VariableMapping>) => {
    setNewTemplate(p => ({
      ...p,
      variable_mappings: p.variable_mappings.map((v, i) => i === index ? { ...v, ...updates } : v),
    }));
  };

  const removeVariable = (index: number) => {
    setNewTemplate(p => ({
      ...p,
      variable_mappings: p.variable_mappings.filter((_, i) => i !== index).map((v, i) => ({ ...v, position: i + 1 })),
      has_variables: p.variable_mappings.length > 1,
    }));
  };

  const saveTemplate = async () => {
    if (!currentTenant?.id || !newTemplate.template_name.trim()) return;
    setSaving(true);

    const payload = {
      tenant_id: currentTenant.id,
      template_name: newTemplate.template_name.trim(),
      language: newTemplate.language,
      description: newTemplate.description.trim() || null,
      has_variables: newTemplate.variable_mappings.length > 0,
      variable_mappings: newTemplate.variable_mappings,
    };

    let error;
    if (editingTemplate) {
      ({ error } = await supabase.from('followup_wa_templates').update(payload as any).eq('id', editingTemplate.id));
    } else {
      ({ error } = await supabase.from('followup_wa_templates').insert(payload as any));
    }

    if (error) {
      toast({ title: '❌ خطأ', description: error.message.includes('duplicate') ? 'اسم القالب موجود بالفعل' : error.message, variant: 'destructive' });
    } else {
      toast({ title: editingTemplate ? '✅ تم التحديث' : '✅ تم الإضافة', description: `قالب "${newTemplate.template_name}"` });
      resetForm();
      setShowAdd(false);
      loadTemplates();
    }
    setSaving(false);
  };

  const openEdit = (t: WATemplate) => {
    setEditingTemplate(t);
    setNewTemplate({
      template_name: t.template_name,
      language: t.language,
      description: t.description || '',
      has_variables: t.has_variables,
      variable_mappings: t.variable_mappings || [],
    });
    setShowAdd(true);
  };

  const deleteTemplate = async (id: string, name: string) => {
    if (!confirm(`حذف قالب "${name}"؟`)) return;
    const { error } = await supabase.from('followup_wa_templates').delete().eq('id', id);
    if (!error) {
      setTemplates(prev => prev.filter(t => t.id !== id));
      toast({ title: '🗑️ تم الحذف' });
    }
  };

  return (
    <div className="p-4 space-y-4 overflow-auto h-full">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-bold text-foreground">قوالب واتساب المتابعة</h3>
          <p className="text-sm text-muted-foreground mt-1">أضف قوالب واتساب المتوافقة مع Meta مع ربط المتغيرات ببيانات الشحنة</p>
        </div>
        <Button onClick={() => { resetForm(); setShowAdd(true); }} className="gap-1.5" size="sm">
          <Plus className="w-4 h-4" />
          إضافة قالب
        </Button>
      </div>

      {/* Important notice */}
      <div className="bg-accent/50 border border-border rounded-lg p-3 flex gap-2">
        <Info className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
        <div className="text-xs text-foreground/80 space-y-1">
          <p className="font-semibold">كيف تشتغل المتغيرات:</p>
          <ul className="list-disc list-inside space-y-0.5">
            <li>في Meta، القالب بيستخدم متغيرات زي <code className="font-mono bg-muted px-1 rounded">{'{{1}}'}</code> و <code className="font-mono bg-muted px-1 rounded">{'{{2}}'}</code></li>
            <li>هنا بتربط كل متغير ببيانات الشحنة (اسم العميل، البوليصة، المبلغ...)</li>
            <li>عند الإرسال النظام بيستبدل المتغيرات بالبيانات الحقيقية من كل شحنة</li>
            <li>الترتيب لازم يطابق ترتيب المتغيرات في القالب على Meta بالضبط</li>
          </ul>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
      ) : templates.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 gap-3 text-muted-foreground">
          <MessageSquare className="w-10 h-10 text-primary/40" />
          <p className="text-sm">لا توجد قوالب بعد</p>
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow className="text-xs">
              <TableHead className="text-right">اسم القالب (Meta)</TableHead>
              <TableHead className="text-right">اللغة</TableHead>
              <TableHead className="text-right">المتغيرات</TableHead>
              <TableHead className="text-right">الوصف</TableHead>
              <TableHead className="w-24" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {templates.map(t => (
              <TableRow key={t.id} className="text-xs">
                <TableCell className="font-mono text-xs font-medium">{t.template_name}</TableCell>
                <TableCell>{LANGUAGES.find(l => l.code === t.language)?.label || t.language}</TableCell>
                <TableCell>
                  {t.variable_mappings?.length > 0 ? (
                    <div className="flex flex-wrap gap-1">
                      {t.variable_mappings.map((v: VariableMapping, i: number) => {
                        const field = SHIPMENT_FIELDS.find(f => f.key === v.field);
                        return (
                          <Badge key={i} variant="secondary" className="text-[9px] gap-0.5">
                            <span className="font-mono">{`{{${v.position}}}`}</span>
                            <span>→</span>
                            <span>{field?.label || v.field}</span>
                          </Badge>
                        );
                      })}
                    </div>
                  ) : (
                    <span className="text-muted-foreground">بدون متغيرات</span>
                  )}
                </TableCell>
                <TableCell className="text-muted-foreground max-w-[150px] truncate">{t.description || '-'}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => openEdit(t)}>
                      <Edit2 className="w-3.5 h-3.5" />
                    </Button>
                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-destructive hover:text-destructive" onClick={() => deleteTemplate(t.id, t.template_name)}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      {/* Add/Edit template dialog */}
      <Dialog open={showAdd} onOpenChange={(open) => { if (!open) { resetForm(); } setShowAdd(open); }}>
        <DialogContent dir="rtl" className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {editingTemplate ? <Edit2 className="w-5 h-5 text-primary" /> : <Plus className="w-5 h-5 text-primary" />}
              {editingTemplate ? 'تعديل قالب واتساب' : 'إضافة قالب واتساب'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>اسم القالب في Meta (Template Name)</Label>
              <Input
                value={newTemplate.template_name}
                onChange={e => setNewTemplate(p => ({ ...p, template_name: e.target.value }))}
                placeholder="مثال: followup_reminder"
                className="font-mono text-sm"
                dir="ltr"
                disabled={!!editingTemplate}
              />
              <p className="text-[10px] text-muted-foreground">نفس الاسم الموجود في Meta Business Manager بالضبط</p>
            </div>
            <div className="space-y-2">
              <Label>اللغة (Language)</Label>
              <Select value={newTemplate.language} onValueChange={v => setNewTemplate(p => ({ ...p, language: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {LANGUAGES.map(l => (
                    <SelectItem key={l.code} value={l.code}>{l.label} ({l.code})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>وصف (اختياري)</Label>
              <Textarea
                value={newTemplate.description}
                onChange={e => setNewTemplate(p => ({ ...p, description: e.target.value }))}
                placeholder="وصف للقالب يسهل عليك اختياره..."
                className="text-sm"
                rows={2}
              />
            </div>

            {/* Variables section */}
            <div className="space-y-3 border-t border-border pt-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Variable className="w-4 h-4 text-primary" />
                  <Label className="text-sm font-semibold">المتغيرات (Variables)</Label>
                </div>
                <Button type="button" variant="outline" size="sm" onClick={addVariable} className="gap-1 text-xs">
                  <Plus className="w-3 h-3" />
                  إضافة متغير
                </Button>
              </div>

              {newTemplate.variable_mappings.length === 0 && (
                <p className="text-xs text-muted-foreground text-center py-2">لم يتم إضافة متغيرات — القالب هيتبعت بدون بيانات ديناميكية</p>
              )}

              {newTemplate.variable_mappings.map((v, index) => (
                <div key={index} className="flex items-center gap-2 p-2 bg-secondary/50 rounded-lg border border-border">
                  <span className="font-mono text-xs font-bold text-primary min-w-[40px]">{`{{${v.position}}}`}</span>
                  <span className="text-xs text-muted-foreground">→</span>

                  {/* Component type */}
                  <Select value={v.component} onValueChange={val => updateVariable(index, { component: val })}>
                    <SelectTrigger className="h-7 text-[10px] w-[80px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="body" className="text-xs">Body</SelectItem>
                      <SelectItem value="header" className="text-xs">Header</SelectItem>
                    </SelectContent>
                  </Select>

                  {/* Field mapping */}
                  <Select value={v.field} onValueChange={val => updateVariable(index, { field: val })}>
                    <SelectTrigger className="h-7 text-xs flex-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {SHIPMENT_FIELDS.map(f => (
                        <SelectItem key={f.key} value={f.key} className="text-xs">
                          {f.label}
                          <span className="text-muted-foreground mr-1">({f.example})</span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Button type="button" variant="ghost" size="sm" className="h-7 w-7 p-0 text-destructive" onClick={() => removeVariable(index)}>
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
              ))}

              {newTemplate.variable_mappings.length > 0 && (
                <div className="bg-muted/50 rounded-lg p-2 text-[10px] text-muted-foreground">
                  <p className="font-semibold mb-1">معاينة:</p>
                  {newTemplate.variable_mappings.map((v, i) => {
                    const field = SHIPMENT_FIELDS.find(f => f.key === v.field);
                    return <p key={i}><span className="font-mono">{`{{${v.position}}}`}</span> في {v.component === 'header' ? 'العنوان' : 'المحتوى'} → <span className="font-medium">{field?.label}</span> (مثال: {field?.example})</p>;
                  })}
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { resetForm(); setShowAdd(false); }}>إلغاء</Button>
            <Button onClick={saveTemplate} disabled={saving || !newTemplate.template_name.trim()} className="gap-1.5">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              {editingTemplate ? 'حفظ التعديلات' : 'إضافة'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default FollowupWATemplates;
