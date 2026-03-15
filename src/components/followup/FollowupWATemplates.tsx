import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useTenantContext } from '@/contexts/TenantContext';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Plus, Trash2, MessageSquare, Info, Variable, Edit2, MousePointerClick, Zap, Save } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';

export interface VariableMapping {
  position: number;
  field: string;
  component: string;
  sub_type?: string;
  button_index?: number;
}

interface ButtonAction {
  id?: string;
  template_id: string;
  button_title: string;
  auto_reply_text: string;
  update_status_to: string;
  is_active: boolean;
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

const FOLLOWUP_STATUSES = [
  { value: 'pending', label: 'بانتظار المتابعة' },
  { value: 'contacted', label: 'تم التواصل' },
  { value: 'resolved', label: 'تم الحل' },
  { value: 'escalated', label: 'تصعيد' },
  { value: 'cancelled', label: 'إلغاء' },
];

const FollowupWATemplates = () => {
  const { currentTenant } = useTenantContext();
  const { toast } = useToast();
  const [templates, setTemplates] = useState<WATemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<WATemplate | null>(null);
  const [buttonActions, setButtonActions] = useState<ButtonAction[]>([]);
  const [savingActions, setSavingActions] = useState(false);
  const [selectedTemplateForActions, setSelectedTemplateForActions] = useState<WATemplate | null>(null);
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

  const loadButtonActions = useCallback(async (templateId: string) => {
    if (!currentTenant?.id) return;
    const { data } = await supabase
      .from('followup_button_actions')
      .select('*')
      .eq('tenant_id', currentTenant.id)
      .eq('template_id', templateId);
    setButtonActions((data as unknown as ButtonAction[]) || []);
  }, [currentTenant?.id]);

  const resetForm = () => {
    setNewTemplate({ template_name: '', language: 'ar', description: '', has_variables: false, variable_mappings: [] });
    setEditingTemplate(null);
  };

  const addVariable = (component: string = 'body') => {
    const sameTypeVars = newTemplate.variable_mappings.filter(v => v.component === component);
    const nextPos = sameTypeVars.length + 1;
    const newVar: VariableMapping = { position: nextPos, field: 'customer_name', component };
    if (component === 'button') {
      newVar.sub_type = 'url';
      newVar.button_index = 0;
      newVar.position = 1;
    }
    setNewTemplate(p => ({ ...p, has_variables: true, variable_mappings: [...p.variable_mappings, newVar] }));
  };

  const updateVariable = (index: number, updates: Partial<VariableMapping>) => {
    setNewTemplate(p => ({
      ...p,
      variable_mappings: p.variable_mappings.map((v, i) => i === index ? { ...v, ...updates } : v),
    }));
  };

  const removeVariable = (index: number) => {
    setNewTemplate(p => {
      const updated = p.variable_mappings.filter((_, i) => i !== index);
      const reNumbered = updated.map((v, _i, arr) => {
        const sameTypeBefore = arr.filter((x, xi) => xi < arr.indexOf(v) && x.component === v.component);
        return { ...v, position: sameTypeBefore.length + 1 };
      });
      return { ...p, variable_mappings: reNumbered, has_variables: reNumbered.length > 0 };
    });
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

  // --- Button Actions ---
  const openButtonActions = (t: WATemplate) => {
    setSelectedTemplateForActions(t);
    loadButtonActions(t.id);
  };

  const addButtonAction = () => {
    if (!selectedTemplateForActions) return;
    setButtonActions(prev => [...prev, {
      template_id: selectedTemplateForActions.id,
      button_title: '',
      auto_reply_text: '',
      update_status_to: 'contacted',
      is_active: true,
    }]);
  };

  const updateButtonAction = (index: number, updates: Partial<ButtonAction>) => {
    setButtonActions(prev => prev.map((a, i) => i === index ? { ...a, ...updates } : a));
  };

  const removeButtonAction = (index: number) => {
    const action = buttonActions[index];
    if (action.id) {
      supabase.from('followup_button_actions').delete().eq('id', action.id).then(() => {});
    }
    setButtonActions(prev => prev.filter((_, i) => i !== index));
  };

  const saveButtonActions = async () => {
    if (!currentTenant?.id || !selectedTemplateForActions) return;
    setSavingActions(true);
    for (const action of buttonActions) {
      if (!action.button_title.trim()) continue;
      const payload = {
        tenant_id: currentTenant.id,
        template_id: selectedTemplateForActions.id,
        button_title: action.button_title.trim(),
        auto_reply_text: action.auto_reply_text,
        update_status_to: action.update_status_to,
        is_active: action.is_active,
      };
      if (action.id) {
        await supabase.from('followup_button_actions').update(payload as any).eq('id', action.id);
      } else {
        await supabase.from('followup_button_actions').insert(payload as any);
      }
    }
    toast({ title: '✅ تم حفظ ردود الأزرار' });
    loadButtonActions(selectedTemplateForActions.id);
    setSavingActions(false);
  };

  const renderMappingBadge = (v: VariableMapping, i: number) => {
    const field = SHIPMENT_FIELDS.find(f => f.key === v.field);
    if (v.component === 'button') {
      return (
        <Badge key={i} variant="outline" className="text-[9px] gap-0.5 border-primary/30">
          <MousePointerClick className="w-2.5 h-2.5" />
          <span>زر {(v.button_index ?? 0) + 1}</span>
          <span>→</span>
          <span>{field?.label || v.field}</span>
        </Badge>
      );
    }
    return (
      <Badge key={i} variant="secondary" className="text-[9px] gap-0.5">
        <span className="font-mono">{`{{${v.position}}}`}</span>
        <span className="text-[8px]">{v.component === 'header' ? '(H)' : ''}</span>
        <span>→</span>
        <span>{field?.label || v.field}</span>
      </Badge>
    );
  };

  const bodyHeaderVars = newTemplate.variable_mappings.filter(v => v.component !== 'button');
  const buttonVars = newTemplate.variable_mappings.filter(v => v.component === 'button');

  return (
    <div className="p-4 space-y-4 overflow-auto h-full">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-bold text-foreground">قوالب واتساب المتابعة</h3>
          <p className="text-sm text-muted-foreground mt-1">أضف قوالب واتساب المتوافقة مع Meta مع ربط المتغيرات والأزرار</p>
        </div>
        <Button onClick={() => { resetForm(); setShowAdd(true); }} className="gap-1.5" size="sm">
          <Plus className="w-4 h-4" />
          إضافة قالب
        </Button>
      </div>

      <div className="bg-accent/50 border border-border rounded-lg p-3 flex gap-2">
        <Info className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
        <div className="text-xs text-foreground/80 space-y-1">
          <p className="font-semibold">كيف تشتغل المتغيرات والأزرار:</p>
          <ul className="list-disc list-inside space-y-0.5">
            <li>متغيرات <code className="font-mono bg-muted px-1 rounded">{'{{1}}'}</code> في Body/Header بتتربط ببيانات الشحنة</li>
            <li>أزرار URL الديناميكية بتتربط بالبوليصة أو كود الطلب</li>
            <li>أزرار Quick Reply → اضغط ⚡ لتحديد الرد التلقائي وتحديث حالة الشحنة</li>
            <li>الترتيب لازم يطابق القالب في Meta بالضبط</li>
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
              <TableHead className="text-right">المتغيرات والأزرار</TableHead>
              <TableHead className="text-right">الوصف</TableHead>
              <TableHead className="w-32" />
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
                      {t.variable_mappings.map((v: VariableMapping, i: number) => renderMappingBadge(v, i))}
                    </div>
                  ) : (
                    <span className="text-muted-foreground">بدون متغيرات</span>
                  )}
                </TableCell>
                <TableCell className="text-muted-foreground max-w-[150px] truncate">{t.description || '-'}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-amber-500 hover:text-amber-600" title="ردود الأزرار" onClick={() => openButtonActions(t)}>
                      <Zap className="w-3.5 h-3.5" />
                    </Button>
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
              <Input value={newTemplate.template_name} onChange={e => setNewTemplate(p => ({ ...p, template_name: e.target.value }))} placeholder="مثال: followup_reminder" className="font-mono text-sm" dir="ltr" disabled={!!editingTemplate} />
            </div>
            <div className="space-y-2">
              <Label>اللغة (Language)</Label>
              <Select value={newTemplate.language} onValueChange={v => setNewTemplate(p => ({ ...p, language: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {LANGUAGES.map(l => <SelectItem key={l.code} value={l.code}>{l.label} ({l.code})</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>وصف (اختياري)</Label>
              <Textarea value={newTemplate.description} onChange={e => setNewTemplate(p => ({ ...p, description: e.target.value }))} placeholder="وصف للقالب..." className="text-sm" rows={2} />
            </div>

            {/* Body / Header Variables */}
            <div className="space-y-3 border-t border-border pt-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Variable className="w-4 h-4 text-primary" />
                  <Label className="text-sm font-semibold">متغيرات Body / Header</Label>
                </div>
                <div className="flex gap-1">
                  <Button type="button" variant="outline" size="sm" onClick={() => addVariable('body')} className="gap-1 text-xs"><Plus className="w-3 h-3" />Body</Button>
                  <Button type="button" variant="outline" size="sm" onClick={() => addVariable('header')} className="gap-1 text-xs"><Plus className="w-3 h-3" />Header</Button>
                </div>
              </div>
              {bodyHeaderVars.length === 0 && <p className="text-xs text-muted-foreground text-center py-1">لا توجد متغيرات نصية</p>}
              {newTemplate.variable_mappings.map((v, index) => {
                if (v.component === 'button') return null;
                return (
                  <div key={index} className="flex items-center gap-2 p-2 bg-secondary/50 rounded-lg border border-border">
                    <span className="font-mono text-xs font-bold text-primary min-w-[40px]">{`{{${v.position}}}`}</span>
                    <Badge variant="outline" className="text-[9px] h-5">{v.component === 'header' ? 'Header' : 'Body'}</Badge>
                    <span className="text-xs text-muted-foreground">→</span>
                    <Select value={v.field} onValueChange={val => updateVariable(index, { field: val })}>
                      <SelectTrigger className="h-7 text-xs flex-1"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {SHIPMENT_FIELDS.map(f => <SelectItem key={f.key} value={f.key} className="text-xs">{f.label} <span className="text-muted-foreground">({f.example})</span></SelectItem>)}
                      </SelectContent>
                    </Select>
                    <Button type="button" variant="ghost" size="sm" className="h-7 w-7 p-0 text-destructive" onClick={() => removeVariable(index)}><Trash2 className="w-3 h-3" /></Button>
                  </div>
                );
              })}
            </div>

            {/* URL Button Variables Only */}
            <div className="space-y-3 border-t border-border pt-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <MousePointerClick className="w-4 h-4 text-primary" />
                  <Label className="text-sm font-semibold">أزرار URL الديناميكية</Label>
                </div>
                <Button type="button" variant="outline" size="sm" onClick={() => addVariable('button')} className="gap-1 text-xs"><Plus className="w-3 h-3" />إضافة زر URL</Button>
              </div>
              <p className="text-[10px] text-muted-foreground bg-accent/50 rounded-md px-2 py-1.5 border border-border">
                ⚡ هذا القسم خاص فقط بأزرار URL (روابط ديناميكية) — أزرار Quick Reply لا تحتاج متغيرات، ظبط ردودها التلقائية وتغيير الحالة من زر ⚡ (ردود الأزرار)
              </p>
              {buttonVars.length === 0 && <p className="text-xs text-muted-foreground text-center py-1">لا توجد أزرار URL — لو القالب فيه أزرار Quick Reply فقط مش محتاج تضيف حاجة هنا</p>}
              {newTemplate.variable_mappings.map((v, index) => {
                if (v.component !== 'button') return null;
                return (
                  <div key={index} className="p-2.5 bg-secondary/50 rounded-lg border border-border space-y-2">
                    <div className="flex items-center gap-2">
                      <MousePointerClick className="w-3.5 h-3.5 text-primary flex-shrink-0" />
                      <span className="text-xs font-semibold text-foreground">🔗 زر URL رقم {(v.button_index ?? 0) + 1}</span>
                      <div className="flex-1" />
                      <Button type="button" variant="ghost" size="sm" className="h-6 w-6 p-0 text-destructive" onClick={() => removeVariable(index)}><Trash2 className="w-3 h-3" /></Button>
                    </div>
                    <div className="space-y-1">
                      <p className="text-[10px] text-muted-foreground">ترتيب الزر (Index)</p>
                      <Select value={String(v.button_index ?? 0)} onValueChange={val => updateVariable(index, { button_index: Number(val), sub_type: 'url' })}>
                        <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="0" className="text-xs">الزر الأول (0)</SelectItem>
                          <SelectItem value="1" className="text-xs">الزر الثاني (1)</SelectItem>
                          <SelectItem value="2" className="text-xs">الزر الثالث (2)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <p className="text-[10px] text-muted-foreground">الجزء الديناميكي من الرابط {'{{1}}'}</p>
                      <Select value={v.field} onValueChange={val => updateVariable(index, { field: val })}>
                        <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {SHIPMENT_FIELDS.map(f => <SelectItem key={f.key} value={f.key} className="text-xs">{f.label} <span className="text-muted-foreground">({f.example})</span></SelectItem>)}
                        </SelectContent>
                      </Select>
                      <p className="text-[9px] text-muted-foreground">
                        مثال: لو الرابط في Meta هو <code className="font-mono bg-muted px-0.5 rounded">{'https://site.com/track/{{1}}'}</code> واخترت "رقم البوليصة" → هيبقى <code className="font-mono bg-muted px-0.5 rounded">https://site.com/track/SHP-12345</code>
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Preview */}
            {newTemplate.variable_mappings.length > 0 && (
              <div className="bg-muted/50 rounded-lg p-2.5 text-[10px] text-muted-foreground border-t border-border">
                <p className="font-semibold mb-1.5 text-foreground text-xs">📋 معاينة الربط:</p>
                {newTemplate.variable_mappings.map((v, i) => {
                  const field = SHIPMENT_FIELDS.find(f => f.key === v.field);
                  if (v.component === 'button') {
                    return (
                      <p key={i} className="flex items-center gap-1">
                        <MousePointerClick className="w-2.5 h-2.5 inline" />
                        <span>زر {(v.button_index ?? 0) + 1} ({v.sub_type === 'url' ? 'رابط' : 'رد سريع'})</span>
                        <span>→</span>
                        <span className="font-medium">{field?.label}</span>
                        <span className="text-muted-foreground">({field?.example})</span>
                      </p>
                    );
                  }
                  return (
                    <p key={i}>
                      <span className="font-mono">{`{{${v.position}}}`}</span>
                      {' '}في {v.component === 'header' ? 'العنوان' : 'المحتوى'}
                      {' → '}<span className="font-medium">{field?.label}</span>
                      {' ('}{field?.example}{')'}
                    </p>
                  );
                })}
              </div>
            )}
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

      {/* Button Actions Dialog */}
      <Dialog open={!!selectedTemplateForActions} onOpenChange={(open) => { if (!open) setSelectedTemplateForActions(null); }}>
        <DialogContent dir="rtl" className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Zap className="w-5 h-5 text-amber-500" />
              ردود أزرار القالب
              {selectedTemplateForActions && <Badge variant="outline" className="font-mono text-xs">{selectedTemplateForActions.template_name}</Badge>}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="bg-accent/50 border border-border rounded-lg p-3 flex gap-2">
              <Zap className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" />
              <div className="text-xs text-foreground/80 space-y-1">
                <p className="font-semibold">كيف تشتغل ردود الأزرار:</p>
                <ul className="list-disc list-inside space-y-0.5">
                  <li>لما العميل يدوس على زر Quick Reply في القالب</li>
                  <li>النظام بيرد تلقائياً بالرسالة المحددة</li>
                  <li>وبيحدث حالة الشحنة في جدول المتابعة</li>
                  <li>اسم الزر لازم يطابق النص في Meta بالضبط</li>
                </ul>
              </div>
            </div>

            {buttonActions.map((action, index) => (
              <div key={index} className="p-3 bg-secondary/50 rounded-lg border border-border space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <MousePointerClick className="w-4 h-4 text-primary" />
                    <span className="text-xs font-semibold text-foreground">زر {index + 1}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch checked={action.is_active} onCheckedChange={v => updateButtonAction(index, { is_active: v })} />
                    <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-destructive" onClick={() => removeButtonAction(index)}><Trash2 className="w-3 h-3" /></Button>
                  </div>
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px] text-muted-foreground">نص الزر (كما في Meta بالضبط)</Label>
                  <Input value={action.button_title} onChange={e => updateButtonAction(index, { button_title: e.target.value })} placeholder="مثال: جاهز للاستلام" className="text-sm h-8" />
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px] text-muted-foreground">الرد التلقائي للعميل</Label>
                  <Textarea value={action.auto_reply_text} onChange={e => updateButtonAction(index, { auto_reply_text: e.target.value })} placeholder="مثال: تمام، هنتواصل مع شركة الشحن لتحديد موعد التوصيل..." className="text-sm" rows={2} />
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px] text-muted-foreground">تحديث حالة الشحنة إلى</Label>
                  <Select value={action.update_status_to} onValueChange={v => updateButtonAction(index, { update_status_to: v })}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {FOLLOWUP_STATUSES.map(s => <SelectItem key={s.value} value={s.value} className="text-xs">{s.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            ))}

            <Button variant="outline" size="sm" onClick={addButtonAction} className="w-full gap-1.5 text-xs">
              <Plus className="w-3 h-3" />
              إضافة رد زر
            </Button>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedTemplateForActions(null)}>إلغاء</Button>
            <Button onClick={saveButtonActions} disabled={savingActions} className="gap-1.5">
              {savingActions ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              حفظ ردود الأزرار
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default FollowupWATemplates;