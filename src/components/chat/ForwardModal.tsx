import { useState, useMemo } from 'react';
import { Search, Forward, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import type { ChatConversation, ChatMessage } from '@/hooks/useConversations';

interface ForwardModalProps {
  message: ChatMessage;
  conversations: ChatConversation[];
  currentConversationId: string;
  onForward: (targetPhone: string, message: ChatMessage) => void;
  onClose: () => void;
}

const ForwardModal = ({ message, conversations, currentConversationId, onForward, onClose }: ForwardModalProps) => {
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    return conversations
      .filter(c => c.id !== currentConversationId)
      .filter(c => {
        if (!search) return true;
        return c.contact.name.toLowerCase().includes(search.toLowerCase()) ||
          c.contact.phone.includes(search);
      });
  }, [conversations, currentConversationId, search]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-card rounded-xl shadow-2xl w-[380px] max-h-[500px] flex flex-col border border-border" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="p-4 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Forward className="w-4 h-4 text-primary" />
            <h3 className="text-sm font-semibold text-foreground">إعادة توجيه الرسالة</h3>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-secondary text-muted-foreground">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Message preview */}
        <div className="px-4 py-2 bg-secondary/30 border-b border-border">
          <p className="text-xs text-muted-foreground truncate">
            {message.text || (message.mediaType?.startsWith('image') ? '📷 صورة' : '📎 مرفق')}
          </p>
        </div>

        {/* Search */}
        <div className="p-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="بحث بالاسم أو الرقم..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9 bg-secondary border-0 text-sm"
              autoFocus
            />
          </div>
        </div>

        {/* Conversation list */}
        <div className="flex-1 overflow-y-auto">
          {filtered.map(conv => (
            <button
              key={conv.id}
              onClick={() => onForward(conv.contact.phone, message)}
              className="w-full p-3 flex gap-3 items-center hover:bg-secondary/50 transition-colors text-right"
            >
              <div className="w-9 h-9 rounded-full bg-primary/15 flex items-center justify-center flex-shrink-0">
                <span className="text-sm font-bold text-primary">{conv.contact.name.charAt(0)}</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">{conv.contact.name}</p>
                <p className="text-xs text-muted-foreground">{conv.contact.phone}</p>
              </div>
              <Forward className="w-4 h-4 text-muted-foreground" />
            </button>
          ))}
          {filtered.length === 0 && (
            <div className="p-8 text-center text-muted-foreground text-sm">لا توجد محادثات</div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ForwardModal;
