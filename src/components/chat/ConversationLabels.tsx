import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Tag, Plus, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import type { ConversationLabel } from '@/hooks/useConversations';

interface ConversationLabelsProps {
  conversationId: string | null;
  tenantId?: string | null;
  initialLabels?: ConversationLabel[];
  onLabelsChange: () => void;
}

const PRESET_COLORS = ['#10b981', '#f59e0b', '#ef4444', '#3b82f6', '#8b5cf6', '#ec4899'];

const ConversationLabels = ({ conversationId, tenantId, initialLabels = [], onLabelsChange }: ConversationLabelsProps) => {
  const [allLabels, setAllLabels] = useState<ConversationLabel[]>([]);
  const [assignedLabels, setAssignedLabels] = useState<ConversationLabel[]>(initialLabels);
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState(PRESET_COLORS[0]);

  useEffect(() => {
    loadLabels();
  }, [tenantId]);

  useEffect(() => {
    setAssignedLabels(initialLabels);
  }, [initialLabels]);

  const loadLabels = async () => {
    let q = supabase.from('conversation_labels').select('*');
    if (tenantId) q = q.eq('tenant_id', tenantId);
    const { data } = await q;
    if (data) setAllLabels(data);
  };

  const toggleLabel = async (label: ConversationLabel) => {
    if (!conversationId) return;
    const isAssigned = assignedLabels.some((l) => l.id === label.id);
    if (isAssigned) {
      await supabase
        .from('conversation_label_assignments')
        .delete()
        .eq('conversation_id', conversationId)
        .eq('label_id', label.id);
      setAssignedLabels((prev) => prev.filter((l) => l.id !== label.id));
    } else {
      await supabase.from('conversation_label_assignments').insert({
        conversation_id: conversationId,
        label_id: label.id,
      });
      setAssignedLabels((prev) => [...prev, label]);
    }
    onLabelsChange();
  };

  const createLabel = async () => {
    if (!newName.trim()) return;
    const { data } = await supabase.from('conversation_labels').insert({
      name: newName.trim(),
      color: newColor,
      tenant_id: tenantId || undefined,
    }).select().single();
    setNewName('');
    setShowAdd(false);
    if (data) setAllLabels((prev) => [...prev, data]);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Tag className="w-3.5 h-3.5 text-muted-foreground" />
          <span className="text-xs text-muted-foreground font-medium">تصنيفات المحادثة</span>
        </div>
        <button onClick={() => setShowAdd(!showAdd)} className="p-0.5 hover:bg-secondary rounded">
          <Plus className="w-3.5 h-3.5 text-muted-foreground" />
        </button>
      </div>

      {/* Assigned Labels Display */}
      {assignedLabels.length > 0 && (
        <div className="space-y-1">
          <span className="text-[10px] text-muted-foreground">التصنيفات المحددة:</span>
          <div className="flex flex-wrap gap-1.5">
            {assignedLabels.map((label) => (
              <button
                key={label.id}
                onClick={() => toggleLabel(label)}
                className="px-2 py-0.5 rounded-full text-[10px] font-medium transition-all border flex items-center gap-1"
                style={{
                  backgroundColor: label.color + '25',
                  borderColor: label.color,
                  color: label.color,
                }}
              >
                {label.name}
                <X className="w-2.5 h-2.5" />
              </button>
            ))}
          </div>
        </div>
      )}

      {showAdd && (
        <div className="space-y-2 p-2 bg-secondary/50 rounded-lg">
          <div className="flex gap-1.5 items-center">
            <Input
              placeholder="اسم التصنيف الجديد"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className="text-xs h-7 flex-1"
              onKeyDown={(e) => e.key === 'Enter' && createLabel()}
            />
            <div className="flex gap-0.5">
              {PRESET_COLORS.slice(0, 4).map((c) => (
                <button
                  key={c}
                  onClick={() => setNewColor(c)}
                  className={`w-4 h-4 rounded-full border-2 ${newColor === c ? 'border-foreground' : 'border-transparent'}`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Available Labels */}
      {allLabels.length > 0 && (
        <div className="space-y-1">
          <span className="text-[10px] text-muted-foreground">التصنيفات المتاحة:</span>
          <div className="flex flex-wrap gap-1.5">
            {allLabels
              .filter(label => !assignedLabels.some(al => al.id === label.id))
              .map((label) => (
                <button
                  key={label.id}
                  onClick={() => toggleLabel(label)}
                  className="px-2 py-0.5 rounded-full text-[10px] font-medium transition-all border opacity-50 hover:opacity-80"
                  style={{
                    backgroundColor: 'transparent',
                    borderColor: label.color,
                    color: label.color,
                  }}
                >
                  {label.name}
                </button>
              ))
            }
          </div>
        </div>
      )}

      {allLabels.length === 0 && !showAdd && (
        <p className="text-[10px] text-muted-foreground">لا توجد تصنيفات - اضغط + لإنشاء</p>
      )}
    </div>
  );
};

export default ConversationLabels;
