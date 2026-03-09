import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { useState, useEffect, useMemo } from 'react';
import type { ChatConversation } from '@/hooks/useConversations';
import ChatFilters, { type ChatFilter } from './ChatFilters';

interface ChatListProps {
  conversations: ChatConversation[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  title?: string;
  tenantId?: string | null;
}

function normalizeForSearch(text: string): string {
  return text.replace(/[\s\-\+]/g, '').replace(/^0/, '').replace(/^20/, '');
}

function relativeTime(dateStr: string): string {
  if (!dateStr) return '';
  const now = Date.now();
  const d = new Date(dateStr).getTime();
  const diff = Math.floor((now - d) / 1000);
  if (diff < 60) return 'الآن';
  if (diff < 3600) return `منذ ${Math.floor(diff / 60)} د`;
  if (diff < 86400) return `منذ ${Math.floor(diff / 3600)} س`;
  if (diff < 172800) return 'أمس';
  return new Date(dateStr).toLocaleDateString('ar-EG', { month: 'short', day: 'numeric' });
}

function toTimestamp(value?: string | null): number {
  if (!value) return 0;
  const ts = new Date(value).getTime();
  return Number.isNaN(ts) ? 0 : ts;
}

const ChatList = ({ conversations, selectedId, onSelect, title = 'المحادثات', tenantId }: ChatListProps) => {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<ChatFilter>('all');

  const filtered = useMemo(() => {
    return conversations.filter((c) => {
      // Search
      if (search) {
        const q = normalizeForSearch(search.toLowerCase());
        const matches =
          c.contact.name.toLowerCase().includes(search.toLowerCase()) ||
          normalizeForSearch(c.contact.phone).includes(q) ||
          c.contact.phone.includes(search);
        if (!matches) return false;
      }

      // Filter
      if (filter === 'unread') return c.unreadCount > 0;
      if (filter === 'no_reply') return c.lastMessageDirection === 'inbound' && c.unreadCount === 0;
      if (filter.startsWith('label:')) {
        const labelId = filter.replace('label:', '');
        return c.labels.some((l) => l.id === labelId);
      }
      return true; // 'all'
    });
  }, [conversations, search, filter]);

  // Always sort by newest first (like WhatsApp)
  const filteredAndSorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      const aTime = toTimestamp(a.lastMessageTime);
      const bTime = toTimestamp(b.lastMessageTime);
      return bTime - aTime;
    });
  }, [filtered]);

  useEffect(() => {
    if (filteredAndSorted.length === 0) return;
    // Only auto-select first conversation for 'all' filter or when no selection exists
    if (!selectedId) {
      onSelect(filteredAndSorted[0].id);
    } else if (filter === 'all' && !filteredAndSorted.some((c) => c.id === selectedId)) {
      onSelect(filteredAndSorted[0].id);
    }
  }, [selectedId, filteredAndSorted, onSelect, filter]);

  return (
    <div className="w-[340px] h-full border-r border-border flex flex-col bg-card flex-shrink-0">
      <div className="p-4 border-b border-border">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-bold text-foreground">{title}</h2>
          <span className="text-xs text-muted-foreground bg-secondary px-2 py-1 rounded-full">
            {filteredAndSorted.length}
          </span>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="بحث بالاسم أو رقم الهاتف..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 bg-secondary border-0 text-sm"
          />
        </div>
      </div>

      <ChatFilters
        activeFilter={filter}
        onFilterChange={setFilter}
        tenantId={tenantId}
      />

      <div className="flex-1 overflow-y-auto">
        {filteredAndSorted.map((conv) => (
          <button
            key={conv.id}
            onClick={() => onSelect(conv.id)}
            className={`w-full p-3.5 flex gap-3 items-center border-b border-border/50 transition-all duration-150 text-right ${
              selectedId === conv.id
                ? 'bg-secondary/80'
                : 'hover:bg-secondary/40'
            }`}
          >
            <div className="relative flex-shrink-0">
              <div className="w-11 h-11 rounded-full bg-primary/15 flex items-center justify-center">
                <span className="text-sm font-bold text-primary">
                  {conv.contact.name.charAt(0)}
                </span>
              </div>
              {conv.unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 w-5 h-5 bg-primary text-primary-foreground text-[10px] font-bold rounded-full flex items-center justify-center">
                  {conv.unreadCount}
                </span>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className="font-semibold text-sm text-foreground truncate">
                    {conv.contact.name}
                  </span>
                  {conv.labels && conv.labels.length > 0 && (
                    <div className="flex gap-0.5 flex-shrink-0">
                      {conv.labels.slice(0, 2).map((l) => (
                        <span key={l.id} className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: l.color }} />
                      ))}
                    </div>
                  )}
                </div>
                <span className="text-[11px] text-muted-foreground flex-shrink-0 mr-2">
                  {relativeTime(conv.lastMessageTime || '')}
                </span>
              </div>
              <p className="text-xs text-muted-foreground truncate max-w-[200px] mt-0.5">
                {conv.lastMessage}
              </p>
            </div>
          </button>
        ))}
        {filteredAndSorted.length === 0 && (
          <div className="p-8 text-center text-muted-foreground text-sm">
            لا توجد محادثات
          </div>
        )}
      </div>
    </div>
  );
};

export default ChatList;
