import { Tag } from 'lucide-react';
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export type ChatFilter = 'all' | 'unread' | 'no_reply' | `label:${string}`;

export interface LabelOption {
  id: string;
  name: string;
  color: string;
}

interface ChatFiltersProps {
  activeFilter: ChatFilter;
  onFilterChange: (f: ChatFilter) => void;
  tenantId?: string | null;
}

const baseFilters: { value: ChatFilter; label: string }[] = [
  { value: 'all', label: 'الكل' },
  { value: 'unread', label: 'غير مقروء' },
  { value: 'no_reply', label: 'لم يتم الرد' },
];

const ChatFilters = ({ activeFilter, onFilterChange, tenantId }: ChatFiltersProps) => {
  const [labels, setLabels] = useState<LabelOption[]>([]);

  useEffect(() => {
    const loadLabels = async () => {
      let query = supabase.from('conversation_labels').select('*').order('name');
      if (tenantId) query = query.eq('tenant_id', tenantId);
      const { data } = await query;
      setLabels(data || []);
    };
    loadLabels();
  }, [tenantId]);

  return (
    <div className="px-3 py-2 border-b border-border space-y-2">
      {/* Filter chips */}
      <div className="flex gap-1.5 overflow-x-auto scrollbar-none pb-1">
        {baseFilters.map((f) => (
          <button
            key={f.value}
            onClick={() => onFilterChange(f.value)}
            className={`px-2.5 py-1 rounded-full text-[11px] font-medium whitespace-nowrap transition-colors ${
              activeFilter === f.value
                ? 'bg-primary text-primary-foreground'
                : 'bg-secondary text-muted-foreground hover:text-foreground'
            }`}
          >
            {f.label}
          </button>
        ))}

        {/* Labels separator */}
        {labels.length > 0 && (
          <div className="flex items-center px-1">
            <Tag className="w-3 h-3 text-muted-foreground" />
          </div>
        )}

        {/* Label filters */}
        {labels.map((label) => {
          const filterValue = `label:${label.id}` as ChatFilter;
          const isActive = activeFilter === filterValue;
          return (
            <button
              key={label.id}
              onClick={() => onFilterChange(filterValue)}
              className={`px-2.5 py-1 rounded-full text-[11px] font-medium whitespace-nowrap transition-colors flex items-center gap-1.5 ${
                isActive
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-secondary text-muted-foreground hover:text-foreground'
              }`}
            >
              <span
                className="w-2 h-2 rounded-full flex-shrink-0"
                style={{ backgroundColor: isActive ? 'currentColor' : label.color }}
              />
              {label.name}
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default ChatFilters;
