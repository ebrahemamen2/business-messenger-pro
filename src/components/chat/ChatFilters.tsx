import { Tag, Settings, Archive, User } from 'lucide-react';
import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import LabelManager from './LabelManager';
import type { ChatConversation } from '@/hooks/useConversations';

export type ChatFilter = 'all' | 'unread' | 'no_reply' | 'archived' | 'my_conversations' | `label:${string}`;

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
  currentUserId?: string | null;
}

const ChatFilters = ({ activeFilter, onFilterChange, tenantId, conversations = [], currentUserId }: ChatFiltersProps) => {
  const [labels, setLabels] = useState<LabelOption[]>([]);
  const [labelManagerOpen, setLabelManagerOpen] = useState(false);

  // Compute filter counts
  const counts = useMemo(() => {
    const nonArchived = conversations.filter(c => !(c as any).archivedAt);
    const unread = nonArchived.filter(c => c.chatStatus === 'unread').length;
    const noReply = nonArchived.filter(c => c.chatStatus === 'awaiting_reply').length;
    const archived = conversations.filter(c => !!(c as any).archivedAt).length;
    const mine = currentUserId ? nonArchived.filter(c => c.assignedTo === currentUserId).length : 0;
    return { unread, noReply, archived, mine };
  }, [conversations, currentUserId]);

  const baseFilters: { value: ChatFilter; label: string; count?: number }[] = [
    { value: 'all', label: 'الكل' },
    { value: 'unread', label: 'غير مقروء', count: counts.unread },
    { value: 'no_reply', label: 'لم يتم الرد', count: counts.noReply },
  ];

  // Only show "my conversations" if user is logged in
  if (currentUserId) {
    baseFilters.push({ value: 'my_conversations', label: 'محادثاتي', count: counts.mine });
  }

  // Show archive filter if there are archived convs or if it's active
  if (counts.archived > 0 || activeFilter === 'archived') {
    baseFilters.push({ value: 'archived', label: 'الأرشيف', count: counts.archived });
  }

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
            className={`px-2.5 py-1 rounded-full text-[11px] font-medium whitespace-nowrap transition-colors flex items-center gap-1 ${
              activeFilter === f.value
                ? 'bg-primary text-primary-foreground'
                : 'bg-secondary text-muted-foreground hover:text-foreground'
            }`}
          >
            {f.value === 'archived' && <Archive className="w-3 h-3" />}
            {f.value === 'my_conversations' && <User className="w-3 h-3" />}
            {f.label}
            {f.count !== undefined && f.count > 0 && (
              <span className={`text-[9px] font-bold min-w-[16px] h-4 rounded-full flex items-center justify-center px-1 ${
                activeFilter === f.value
                  ? 'bg-primary-foreground/20 text-primary-foreground'
                  : 'bg-primary/15 text-primary'
              }`}>
                {f.count}
              </span>
            )}
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
          const labelCount = conversations.filter(conv => conv.labels.some(l => l.id === label.id)).length;
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
              {labelCount > 0 && (
                <span className={`text-[9px] font-bold min-w-[16px] h-4 rounded-full flex items-center justify-center px-1 ${
                  isActive
                    ? 'bg-primary-foreground/20 text-primary-foreground'
                    : 'bg-primary/15 text-primary'
                }`}>
                  {labelCount}
                </span>
              )}
            </button>
          );
        })}
        
        {/* Label Management Button */}
        <Popover>
          <PopoverTrigger asChild>
            <button className="p-1.5 rounded-full hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors">
              <Settings className="w-3.5 h-3.5" />
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-80 p-0" align="start">
            <div className="p-3">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-medium">إدارة التصنيفات</span>
              </div>
              <button 
                onClick={() => setLabelManagerOpen(true)}
                className="w-full text-left px-3 py-2 text-sm hover:bg-secondary rounded-md transition-colors"
              >
                فتح نافذة التحكم في التصنيفات
              </button>
            </div>
          </PopoverContent>
        </Popover>
      </div>

      <LabelManager 
        open={labelManagerOpen}
        onOpenChange={setLabelManagerOpen}
        tenantId={tenantId}
        onLabelsChanged={handleLabelsChanged}
      />
    </div>
  );
};

export default ChatFilters;
