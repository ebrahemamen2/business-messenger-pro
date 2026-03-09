import { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, X, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import type { ConversationLabel } from '@/hooks/useConversations';

interface LabelManagerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tenantId?: string | null;
  onLabelsChanged?: () => void;
}

const PRESET_COLORS = [
  '#10b981', // emerald
  '#f59e0b', // amber
  '#ef4444', // red
  '#3b82f6', // blue
  '#8b5cf6', // violet
  '#ec4899', // pink
  '#06b6d4', // cyan
  '#84cc16', // lime
  '#f97316', // orange
  '#6366f1', // indigo
];

const LabelManager = ({ open, onOpenChange, tenantId, onLabelsChanged }: LabelManagerProps) => {
  const [labels, setLabels] = useState<ConversationLabel[]>([]);
  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editColor, setEditColor] = useState('');
  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState(PRESET_COLORS[0]);
  const { toast } = useToast();

  useEffect(() => {
    if (open) {
      loadLabels();
    }
  }, [open, tenantId]);

  const loadLabels = async () => {
    setLoading(true);
    let query = supabase.from('conversation_labels').select('*').order('name');
    if (tenantId) query = query.eq('tenant_id', tenantId);
    
    const { data, error } = await query;
    if (!error && data) {
      setLabels(data);
    }
    setLoading(false);
  };

  const createLabel = async () => {
    if (!newName.trim()) return;
    
    const { error } = await supabase.from('conversation_labels').insert({
      name: newName.trim(),
      color: newColor,
      tenant_id: tenantId || undefined,
    });

    if (error) {
      toast({ title: '❌ خطأ', description: 'فشل إنشاء التصنيف', variant: 'destructive' });
    } else {
      toast({ title: '✅ تم إنشاء التصنيف' });
      setNewName('');
      setNewColor(PRESET_COLORS[0]);
      loadLabels();
      onLabelsChanged?.();
    }
  };

  const updateLabel = async () => {
    if (!editingId || !editName.trim()) return;
    
    const { error } = await supabase
      .from('conversation_labels')
      .update({ name: editName.trim(), color: editColor })
      .eq('id', editingId);

    if (error) {
      toast({ title: '❌ خطأ', description: 'فشل تحديث التصنيف', variant: 'destructive' });
    } else {
      toast({ title: '✅ تم تحديث التصنيف' });
      setEditingId(null);
      setEditName('');
      setEditColor('');
      loadLabels();
      onLabelsChanged?.();
    }
  };

  const deleteLabel = async (id: string) => {
    // First delete all assignments
    await supabase.from('conversation_label_assignments').delete().eq('label_id', id);
    
    // Then delete the label
    const { error } = await supabase.from('conversation_labels').delete().eq('id', id);

    if (error) {
      toast({ title: '❌ خطأ', description: 'فشل حذف التصنيف', variant: 'destructive' });
    } else {
      toast({ title: '✅ تم حذف التصنيف' });
      loadLabels();
      onLabelsChanged?.();
    }
  };

  const startEdit = (label: ConversationLabel) => {
    setEditingId(label.id);
    setEditName(label.name);
    setEditColor(label.color);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditName('');
    setEditColor('');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>إدارة التصنيفات</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4 max-h-96 overflow-y-auto">
          {/* Create new label */}
          <div className="space-y-3 p-3 border border-dashed border-border rounded-lg">
            <div className="text-sm font-medium text-muted-foreground">إنشاء تصنيف جديد</div>
            <div className="space-y-2">
              <Input
                placeholder="اسم التصنيف"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                className="text-sm"
                onKeyDown={(e) => e.key === 'Enter' && createLabel()}
              />
              <div className="flex gap-1 flex-wrap">
                {PRESET_COLORS.map((color) => (
                  <button
                    key={color}
                    onClick={() => setNewColor(color)}
                    className={`w-6 h-6 rounded-full border-2 transition-all ${
                      newColor === color ? 'border-foreground scale-110' : 'border-transparent hover:scale-105'
                    }`}
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
              <Button size="sm" onClick={createLabel} disabled={!newName.trim()}>
                <Plus className="w-3 h-3 mr-1" />
                إنشاء
              </Button>
            </div>
          </div>

          {/* Existing labels */}
          <div className="space-y-2">
            {loading ? (
              <div className="text-center text-sm text-muted-foreground py-4">جاري التحميل...</div>
            ) : labels.length === 0 ? (
              <div className="text-center text-sm text-muted-foreground py-4">لا توجد تصنيفات</div>
            ) : (
              labels.map((label) => (
                <div key={label.id} className="flex items-center gap-2 p-2 border border-border rounded-lg">
                  {editingId === label.id ? (
                    <>
                      <div
                        className="w-4 h-4 rounded-full flex-shrink-0 border border-border"
                        style={{ backgroundColor: editColor }}
                      />
                      <Input
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        className="text-sm h-8 flex-1"
                        onKeyDown={(e) => e.key === 'Enter' && updateLabel()}
                      />
                      <div className="flex gap-1">
                        {PRESET_COLORS.slice(0, 5).map((color) => (
                          <button
                            key={color}
                            onClick={() => setEditColor(color)}
                            className={`w-4 h-4 rounded-full border ${
                              editColor === color ? 'border-foreground' : 'border-transparent'
                            }`}
                            style={{ backgroundColor: color }}
                          />
                        ))}
                      </div>
                      <Button size="sm" variant="ghost" onClick={updateLabel}>
                        <Save className="w-3 h-3" />
                      </Button>
                      <Button size="sm" variant="ghost" onClick={cancelEdit}>
                        <X className="w-3 h-3" />
                      </Button>
                    </>
                  ) : (
                    <>
                      <div
                        className="w-4 h-4 rounded-full flex-shrink-0"
                        style={{ backgroundColor: label.color }}
                      />
                      <span className="text-sm flex-1">{label.name}</span>
                      <Button size="sm" variant="ghost" onClick={() => startEdit(label)}>
                        <Edit2 className="w-3 h-3" />
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => deleteLabel(label.id)}>
                        <Trash2 className="w-3 h-3 text-destructive" />
                      </Button>
                    </>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default LabelManager;
