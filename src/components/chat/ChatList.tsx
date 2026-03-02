import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { useState } from 'react';
import type { Conversation } from '@/data/mockData';

interface ChatListProps {
  conversations: Conversation[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

const statusLabels: Record<string, string> = {
  all: 'الكل',
  active: 'نشط',
  pending: 'معلق',
  resolved: 'مكتمل',
};

const ChatList = ({ conversations, selectedId, onSelect }: ChatListProps) => {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');

  const filtered = conversations.filter((c) => {
    const matchSearch =
      c.contact.name.includes(search) || c.contact.phone.includes(search);
    const matchFilter = filter === 'all' || c.status === filter;
    return matchSearch && matchFilter;
  });

  return (
    <div className="w-[340px] h-full border-r border-border flex flex-col bg-card flex-shrink-0">
      {/* Header */}
      <div className="p-4 border-b border-border">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-bold text-foreground">المحادثات</h2>
          <span className="text-xs text-muted-foreground bg-secondary px-2 py-1 rounded-full">
            {conversations.length}
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
        <div className="flex gap-1.5 mt-3">
          {Object.entries(statusLabels).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setFilter(key)}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-all duration-200 ${
                filter === key
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'bg-secondary text-muted-foreground hover:text-foreground'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto">
        {filtered.map((conv) => (
          <button
            key={conv.id}
            onClick={() => onSelect(conv.id)}
            className={`w-full p-3.5 flex gap-3 items-center border-b border-border/50 transition-all duration-150 text-right ${
              selectedId === conv.id
                ? 'bg-secondary/80'
                : 'hover:bg-secondary/40'
            }`}
          >
            {/* Avatar */}
            <div className="relative flex-shrink-0">
              <div className="w-11 h-11 rounded-full bg-primary/15 flex items-center justify-center">
                <span className="text-sm font-bold text-primary">
                  {conv.contact.name.charAt(0)}
                </span>
              </div>
              <div
                className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-card ${
                  conv.status === 'active'
                    ? 'bg-status-active'
                    : conv.status === 'pending'
                    ? 'bg-status-pending'
                    : 'bg-status-resolved'
                }`}
              />
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-sm text-foreground truncate">
                  {conv.contact.name}
                </span>
                <span className="text-[11px] text-muted-foreground flex-shrink-0 mr-2">
                  {conv.lastMessageTime}
                </span>
              </div>
              <div className="flex items-center justify-between mt-0.5">
                <p className="text-xs text-muted-foreground truncate max-w-[200px]">
                  {conv.lastMessage}
                </p>
                {conv.unreadCount > 0 && (
                  <span className="min-w-[20px] h-5 rounded-full bg-primary text-primary-foreground text-[11px] font-bold flex items-center justify-center flex-shrink-0 px-1.5">
                    {conv.unreadCount}
                  </span>
                )}
              </div>
            </div>
          </button>
        ))}
        {filtered.length === 0 && (
          <div className="p-8 text-center text-muted-foreground text-sm">
            لا توجد محادثات
          </div>
        )}
      </div>
    </div>
  );
};

export default ChatList;
