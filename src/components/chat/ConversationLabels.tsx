import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Tag, Plus, X } from 'lucide-react';
import { Input } from '@/components/ui/input';

interface Label {
  id: string;
  name: string;
  color: string;
}

interface ConversationLabelsProps {
  conversationId: string | null;
  tenantId?: string | null;
  assignedLabels: Label[];
  onLabelsChange: () => void;
}

const PRESET_COLORS = ['#10b981', '#f59e0b', '#ef4444', '#3b82f6', '#8b5cf6', '#ec4899'];

const ConversationLabels = ({ conversationId, tenantId, assignedLabels, onLabelsChange }: ConversationLabelsProps) => {
  const [allLabels, setAllLabels] = useState<Label[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState(PRESET_COLORS[0]);

  useEffect(() => {
    loadLabels();
  }, [tenantId]);

  const loadLabels = async () => {
    let q = supabase.from('conversation_labels').select('*');
    if (tenantId) q = q.eq('tenant_id', tenantId);
    const { data } = await q;
    if (data) setAllLabels(data);
  };

  const toggleLabel = async (label: Label) => {
    if (!conversationId) return;
    const isAssigned = assignedLabels.some((l) => l.id === label.id);
    if (isAssigned) {
      await supabase
        .from('conversation_label_assignments')
        .delete()
        .eq('conversation_id', conversationId)
        .eq('label_id', label.id);
    } else {
      await supabase.from('conversation_label_assignments').insert({
        conversation_id: conversationId,
        label_id: label.id,
      });
    }
    onLabelsChange();
  };

  const createLabel = async () => {
    if (!newName.trim()) return;
    await supabase.from('conversation_labels').insert({
      name: newName.trim(),
      color: newColor,
      tenant_id: tenantId || undefined,
    });
    setNewName('');
    setShowAdd(false);
    loadLabels();
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Tag className="w-3.5 h-3.5 text-muted-foreground" />
          <span className="text-xs text-muted-foreground font-medium">التصنيفات</span>
        </div>
        <button onClick={() => setShowAdd(!showAdd)} className="p-0.5 hover:bg-secondary rounded">
          <Plus className="w-3.5 h-3.5 text-muted-foreground" />
        </button>
      </div>

      {showAdd && (
        <div className="flex gap-1.5 items-center">
          <Input
            placeholder="اسم التصنيف"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            className="text-xs h-7 flex-1"
            onKeyDown={(e) => e.key === 'Enter' && createLabel()}
          />
          <div className="flex gap-0.5">
            {PRESET_COLORS.map((c) => (
              <button
                key={c}
                onClick={() => setNewColor(c)}
                className={`w-4 h-4 rounded-full border-2 ${newColor === c ? 'border-foreground' : 'border-transparent'}`}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-1.5">
        {allLabels.map((label) => {
          const isAssigned = assignedLabels.some((l) => l.id === label.id);
          return (
            <button
              key={label.id}
              onClick={() => toggleLabel(label)}
              className={`px-2 py-0.5 rounded-full text-[10px] font-medium transition-all border ${
                isAssigned ? 'opacity-100' : 'opacity-50 hover:opacity-80'
              }`}
              style={{
                backgroundColor: isAssigned ? label.color + '25' : 'transparent',
                borderColor: label.color,
                color: label.color,
              }}
            >
              {label.name}
              {isAssigned && <X className="w-2.5 h-2.5 inline ml-1" />}
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default ConversationLabels;
