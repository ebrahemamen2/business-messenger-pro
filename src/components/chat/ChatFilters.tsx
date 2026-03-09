import { Tag, Settings } from 'lucide-react';
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import LabelManager from './LabelManager';
import type { ChatConversation } from '@/hooks/useConversations';

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
  conversations?: ChatConversation[];
}

const baseFilters: { value: ChatFilter; label: string }[] = [
  { value: 'all', label: 'الكل' },
  { value: 'unread', label: 'غير مقروء' },
  { value: 'no_reply', label: 'لم يتم الرد' },
];

const ChatFilters = ({ activeFilter, onFilterChange, tenantId, conversations = [] }: ChatFiltersProps) => {
  const [labels, setLabels] = useState<LabelOption[]>([]);
  const [labelManagerOpen, setLabelManagerOpen] = useState(false);

  useEffect(() => {
    const loadLabels = async () => {
      let query = supabase.from('conversation_labels').select('*').order('name');
      if (tenantId) query = query.eq('tenant_id', tenantId);
      const { data } = await query;
      setLabels(data || []);
    };
    loadLabels();
  }, [tenantId]);

  // Only show labels that are actually used in conversations
  const labelsWithConversations = labels.filter(label => 
    conversations.some(conv => conv.labels.some(l => l.id === label.id))
  );

  const handleLabelsChanged = () => {
    // Reload labels and inform parent to reload conversations
    const loadLabels = async () => {
      let query = supabase.from('conversation_labels').select('*').order('name');
      if (tenantId) query = query.eq('tenant_id', tenantId);
      const { data } = await query;
      setLabels(data || []);
    };
    loadLabels();
  };

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
        {labelsWithConversations.length > 0 && (
          <div className="flex items-center px-1">
            <Tag className="w-3 h-3 text-muted-foreground" />
          </div>
        )}

        {/* Label filters */}
        {labelsWithConversations.map((label) => {
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
