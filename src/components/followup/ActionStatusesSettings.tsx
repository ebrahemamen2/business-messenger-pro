import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, X, GripVertical, Save, Loader2 } from 'lucide-react';

export interface ActionStatus {
  key: string;
  label: string;
  color: string;
}

const COLOR_OPTIONS = [
  { value: 'yellow', label: 'أصفر', css: 'bg-yellow-500' },
  { value: 'blue', label: 'أزرق', css: 'bg-blue-500' },
  { value: 'green', label: 'أخضر', css: 'bg-green-500' },
  { value: 'red', label: 'أحمر', css: 'bg-red-500' },
  { value: 'orange', label: 'برتقالي', css: 'bg-orange-500' },
  { value: 'purple', label: 'بنفسجي', css: 'bg-purple-500' },
  { value: 'gray', label: 'رمادي', css: 'bg-gray-500' },
  { value: 'pink', label: 'وردي', css: 'bg-pink-500' },
  { value: 'teal', label: 'تيل', css: 'bg-teal-500' },
];

interface Props {
  statuses: ActionStatus[];
  onChange: (statuses: ActionStatus[]) => void;
  onSave: () => void;
  saving: boolean;
}

const ActionStatusesSettings = ({ statuses, onChange, onSave, saving }: Props) => {
  const [newLabel, setNewLabel] = useState('');
  const [newColor, setNewColor] = useState('blue');

  const addStatus = () => {
    const trimmed = newLabel.trim();
    if (!trimmed) return;
    const key = trimmed.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_\u0600-\u06FF]/g, '') || `custom_${Date.now()}`;
    if (statuses.some(s => s.key === key)) return;
    onChange([...statuses, { key, label: trimmed, color: newColor }]);
    setNewLabel('');
  };

  const removeStatus = (key: string) => {
    onChange(statuses.filter(s => s.key !== key));
  };

  const updateLabel = (key: string, label: string) => {
    onChange(statuses.map(s => s.key === key ? { ...s, label } : s));
  };

  const updateColor = (key: string, color: string) => {
    onChange(statuses.map(s => s.key === key ? { ...s, color } : s));
  };

  const moveUp = (index: number) => {
    if (index === 0) return;
    const arr = [...statuses];
    [arr[index - 1], arr[index]] = [arr[index], arr[index - 1]];
    onChange(arr);
  };

  const moveDown = (index: number) => {
    if (index === statuses.length - 1) return;
    const arr = [...statuses];
    [arr[index], arr[index + 1]] = [arr[index + 1], arr[index]];
    onChange(arr);
  };

  const getColorCss = (color: string) => {
    return COLOR_OPTIONS.find(c => c.value === color)?.css || 'bg-gray-500';
  };

  return (
    <div className="space-y-5 max-w-2xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-bold text-foreground">حالات المتابعة الداخلية</h3>
          <p className="text-sm text-muted-foreground mt-1">
            الحالات اللي الموظف بيختارها بعد ما يتابع على الشحنة (زي: تم التواصل، تصعيد، إلخ)
          </p>
        </div>
        <Button onClick={onSave} disabled={saving} className="gap-1.5">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          حفظ
        </Button>
      </div>

      {/* Current statuses */}
      <div className="space-y-2">
        {statuses.map((status, index) => (
          <div key={status.key} className="flex items-center gap-2 p-2.5 rounded-lg border border-border bg-card group">
            <div className="flex flex-col gap-0.5">
              <button onClick={() => moveUp(index)} disabled={index === 0} className="text-muted-foreground hover:text-foreground disabled:opacity-30 transition-colors">
                <GripVertical className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Color picker */}
            <div className="flex gap-1">
              {COLOR_OPTIONS.map(c => (
                <button
                  key={c.value}
                  onClick={() => updateColor(status.key, c.value)}
                  className={`w-5 h-5 rounded-full ${c.css} transition-all ${status.color === c.value ? 'ring-2 ring-offset-1 ring-primary scale-110' : 'opacity-40 hover:opacity-70'}`}
                />
              ))}
            </div>

            {/* Label input */}
            <Input
              value={status.label}
              onChange={e => updateLabel(status.key, e.target.value)}
              className="flex-1 h-8 text-sm"
              dir="auto"
            />

            {/* Remove */}
            <button onClick={() => removeStatus(status.key)} className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>
        ))}

        {statuses.length === 0 && (
          <p className="text-center text-sm text-muted-foreground py-6 border border-dashed border-border rounded-lg">
            لا توجد حالات. أضف حالة جديدة من الأسفل.
          </p>
        )}
      </div>

      {/* Add new */}
      <div className="flex gap-2 items-center p-3 rounded-lg border border-dashed border-primary/30 bg-primary/5">
        <div className="flex gap-1">
          {COLOR_OPTIONS.slice(0, 5).map(c => (
            <button
              key={c.value}
              onClick={() => setNewColor(c.value)}
              className={`w-4 h-4 rounded-full ${c.css} transition-all ${newColor === c.value ? 'ring-2 ring-offset-1 ring-primary scale-110' : 'opacity-40 hover:opacity-70'}`}
            />
          ))}
        </div>
        <Input
          value={newLabel}
          onChange={e => setNewLabel(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && addStatus()}
          placeholder="اسم الحالة الجديدة..."
          className="flex-1 h-8 text-sm"
          dir="auto"
        />
        <Button onClick={addStatus} disabled={!newLabel.trim()} size="sm" className="gap-1.5">
          <Plus className="w-4 h-4" />
          إضافة
        </Button>
      </div>
    </div>
  );
};

export default ActionStatusesSettings;
