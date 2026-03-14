import { Search, Clock, Pin, CheckSquare, X, Mail, MailOpen } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { useState, useEffect, useMemo, useCallback } from 'react';
import type { ChatConversation, ChatStatusType } from '@/hooks/useConversations';
import ChatFilters, { type ChatFilter } from './ChatFilters';

interface ChatListProps {
  conversations: ChatConversation[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  title?: string;
  tenantId?: string | null;
  fullWidth?: boolean;
  autoSelect?: boolean;
  currentUserId?: string | null;
  onBulkUpdateChatStatus?: (dbIds: string[], status: ChatStatusType) => Promise<void>;
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

const ChatList = ({ conversations, selectedId, onSelect, title = 'المحادثات', tenantId, fullWidth, autoSelect = true, currentUserId, onBulkUpdateChatStatus }: ChatListProps) => {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<ChatFilter>('all');
  const [multiSelectMode, setMultiSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const filtered = useMemo(() => {
    return conversations.filter((c) => {
      if (search) {
        const q = normalizeForSearch(search.toLowerCase());
        const matches =
          c.contact.name.toLowerCase().includes(search.toLowerCase()) ||
          normalizeForSearch(c.contact.phone).includes(q) ||
          c.contact.phone.includes(search);
        if (!matches) return false;
      }

      if (filter === 'unread') return c.chatStatus === 'unread';
      if (filter === 'no_reply') return c.chatStatus === 'awaiting_reply';
      if (filter === 'archived') return !!(c as any).archivedAt;
      if (filter === 'my_conversations') return c.assignedTo === currentUserId;
      if (filter.startsWith('label:')) {
        const labelId = filter.replace('label:', '');
        return c.labels.some((l) => l.id === labelId);
      }
      return !(c as any).archivedAt;
    });
  }, [conversations, search, filter, currentUserId]);

  const filteredAndSorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      const aPinned = (a as any).pinnedAt ? 1 : 0;
      const bPinned = (b as any).pinnedAt ? 1 : 0;
      if (aPinned !== bPinned) return bPinned - aPinned;
      const aTime = toTimestamp(a.lastMessageTime);
      const bTime = toTimestamp(b.lastMessageTime);
      return bTime - aTime;
    });
  }, [filtered]);

  useEffect(() => {
    if (!autoSelect) return;
    if (filteredAndSorted.length === 0) return;
    if (!selectedId) {
      onSelect(filteredAndSorted[0].id);
    } else if (filter === 'all' && !filteredAndSorted.some((c) => c.id === selectedId)) {
      onSelect(filteredAndSorted[0].id);
    }
  }, [selectedId, filteredAndSorted, onSelect, filter, autoSelect]);

  const exitMultiSelect = useCallback(() => {
    setMultiSelectMode(false);
    setSelectedIds(new Set());
  }, []);

  const toggleId = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const selectAll = useCallback(() => {
    setSelectedIds(new Set(filteredAndSorted.map((c) => c.id)));
  }, [filteredAndSorted]);

  const handleBulkAction = useCallback(async (status: ChatStatusType) => {
    if (!onBulkUpdateChatStatus) return;
    const dbIds = filteredAndSorted
      .filter((c) => selectedIds.has(c.id) && c.dbId)
      .map((c) => c.dbId!);
    await onBulkUpdateChatStatus(dbIds, status);
    exitMultiSelect();
  }, [onBulkUpdateChatStatus, filteredAndSorted, selectedIds, exitMultiSelect]);

  return (
    <div className={`h-full border-r border-border flex flex-col bg-card flex-shrink-0 ${fullWidth ? 'w-full' : 'w-[340px]'}`}>
      <div className="p-4 border-b border-border">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-bold text-foreground">{title}</h2>
          <div className="flex items-center gap-2">
            {onBulkUpdateChatStatus && (
              <button
                onClick={() => multiSelectMode ? exitMultiSelect() : setMultiSelectMode(true)}
                className={`p-1.5 rounded-lg transition-colors ${multiSelectMode ? 'bg-primary/15 text-primary' : 'text-muted-foreground hover:bg-secondary'}`}
                title={multiSelectMode ? 'إلغاء التحديد' : 'تحديد متعدد'}
              >
                {multiSelectMode ? <X className="w-4 h-4" /> : <CheckSquare className="w-4 h-4" />}
              </button>
            )}
            <span className="text-xs text-muted-foreground bg-secondary px-2 py-1 rounded-full">
              {filteredAndSorted.length}
            </span>
          </div>
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

      {multiSelectMode && (
        <div className="flex items-center gap-1 px-3 py-2 border-b border-border bg-secondary/50 flex-shrink-0">
          <Button variant="ghost" size="sm" className="text-xs h-7 px-2" onClick={selectAll}>
            تحديد الكل
          </Button>
          <div className="flex-1" />
          <span className="text-xs text-muted-foreground ml-1">{selectedIds.size} محدد</span>
          <Button
            variant="ghost"
            size="sm"
            className="text-xs h-7 px-2 gap-1"
            disabled={selectedIds.size === 0}
            onClick={() => handleBulkAction('unread')}
            title="غير مقروء"
          >
            <Mail className="w-3.5 h-3.5" />
            غير مقروء
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="text-xs h-7 px-2 gap-1"
            disabled={selectedIds.size === 0}
            onClick={() => handleBulkAction('replied')}
            title="مقروء"
          >
            <MailOpen className="w-3.5 h-3.5" />
            مقروء
          </Button>
        </div>
      )}

      <ChatFilters
        activeFilter={filter}
        onFilterChange={setFilter}
        tenantId={tenantId}
        conversations={conversations}
        currentUserId={currentUserId}
      />

      <div className="flex-1 overflow-y-auto">
        {filteredAndSorted.map((conv) => (
          <button
            key={conv.id}
            onClick={() => multiSelectMode ? toggleId(conv.id) : onSelect(conv.id)}
            className={`w-full p-3.5 flex gap-3 items-center border-b border-border/50 transition-all duration-150 text-right ${
              multiSelectMode && selectedIds.has(conv.id)
                ? 'bg-primary/10'
                : selectedId === conv.id
                  ? 'bg-secondary/80'
                  : 'hover:bg-secondary/40'
            }`}
          >
            {multiSelectMode && (
              <div className="flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                <Checkbox
                  checked={selectedIds.has(conv.id)}
                  onCheckedChange={() => toggleId(conv.id)}
                />
              </div>
            )}
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
              {conv.lastCustomerMessageAt && (Date.now() - new Date(conv.lastCustomerMessageAt).getTime() > 24 * 60 * 60 * 1000) && (
                <span className="absolute -bottom-1 -left-1 w-4 h-4 bg-destructive/15 text-destructive rounded-full flex items-center justify-center" title="انتهت نافذة الـ 24 ساعة">
                  <Clock className="w-2.5 h-2.5" />
                </span>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 min-w-0">
                  {(conv as any).pinnedAt && (
                    <Pin className="w-3 h-3 text-primary flex-shrink-0 rotate-45" />
                  )}
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
                {conv.lastMessage || conv.contact.phone}
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
