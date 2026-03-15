import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useTenantContext } from '@/contexts/TenantContext';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Plus, Trash2, MessageSquare, Info } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

interface WATemplate {
  id: string;
  template_name: string;
  language: string;
  description: string | null;
  has_variables: boolean;
  variable_mappings: any[];
  created_at: string;
}

const LANGUAGES = [
  { code: 'ar', label: 'العربية' },
  { code: 'en', label: 'English' },
  { code: 'en_US', label: 'English (US)' },
  { code: 'en_GB', label: 'English (UK)' },
];

const FollowupWATemplates = () => {
  const { currentTenant } = useTenantContext();
  const { toast } = useToast();
  const [templates, setTemplates] = useState<WATemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [saving, setSaving] = useState(false);
  const [newTemplate, setNewTemplate] = useState({ template_name: '', language: 'ar', description: '' });

  const loadTemplates = useCallback(async () => {
    if (!currentTenant?.id) { setLoading(false); return; }
    setLoading(true);
    const { data } = await supabase
      .from('followup_wa_templates')
      .select('*')
      .eq('tenant_id', currentTenant.id)
      .order('created_at', { ascending: false });
    setTemplates((data as WATemplate[]) || []);
    setLoading(false);
  }, [currentTenant?.id]);

  useEffect(() => { loadTemplates(); }, [loadTemplates]);

  const addTemplate = async () => {
    if (!currentTenant?.id || !newTemplate.template_name.trim()) return;
    setSaving(true);
    const { error } = await supabase
      .from('followup_wa_templates')
      .insert({
        tenant_id: currentTenant.id,
        template_name: newTemplate.template_name.trim(),
        language: newTemplate.language,
        description: newTemplate.description.trim() || null,
      } as any);

    if (error) {
      toast({ title: '❌ خطأ', description: error.message.includes('duplicate') ? 'اسم القالب موجود بالفعل' : error.message, variant: 'destructive' });
    } else {
      toast({ title: '✅ تم الإضافة', description: `تم إضافة قالب "${newTemplate.template_name}"` });
      setNewTemplate({ template_name: '', language: 'ar', description: '' });
      setShowAdd(false);
      loadTemplates();
    }
    setSaving(false);
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
          <p className="text-sm text-muted-foreground mt-1">أضف قوالب واتساب المتوافقة مع Meta لإرسالها من جدول المتابعة</p>
        </div>
        <Button onClick={() => setShowAdd(true)} className="gap-1.5" size="sm">
          <Plus className="w-4 h-4" />
          إضافة قالب
        </Button>
      </div>

      {/* Important notice */}
      <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-3 flex gap-2">
        <Info className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
        <div className="text-xs text-blue-700 space-y-1">
          <p className="font-semibold">ملاحظات مهمة:</p>
          <ul className="list-disc list-inside space-y-0.5">
            <li>اسم القالب (Template Name) لازم يكون نفس الاسم الموجود في Meta Business Manager</li>
            <li>اللغة لازم تطابق اللغة المحددة في القالب على Meta</li>
            <li>القالب لازم يكون معتمد (Approved) من Meta قبل الإرسال</li>
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
              <TableHead className="text-right">الوصف</TableHead>
              <TableHead className="text-right">تاريخ الإضافة</TableHead>
              <TableHead className="w-16" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {templates.map(t => (
              <TableRow key={t.id} className="text-xs">
                <TableCell className="font-mono text-xs font-medium">{t.template_name}</TableCell>
                <TableCell>{LANGUAGES.find(l => l.code === t.language)?.label || t.language}</TableCell>
                <TableCell className="text-muted-foreground max-w-[200px] truncate">{t.description || '-'}</TableCell>
                <TableCell className="text-muted-foreground">{new Date(t.created_at).toLocaleDateString('ar-EG')}</TableCell>
                <TableCell>
                  <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-destructive hover:text-destructive" onClick={() => deleteTemplate(t.id, t.template_name)}>
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      {/* Add template dialog */}
      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent dir="rtl" className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Plus className="w-5 h-5 text-primary" />إضافة قالب واتساب</DialogTitle>
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
                placeholder="وصف للقالب يسهل عليك اختياره بعدين..."
                className="text-sm"
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAdd(false)}>إلغاء</Button>
            <Button onClick={addTemplate} disabled={saving || !newTemplate.template_name.trim()} className="gap-1.5">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              إضافة
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default FollowupWATemplates;
