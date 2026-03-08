import { Send, Paperclip, Smile, Phone, UserCircle, MoreVertical, StickyNote, Reply, X, Image, Loader2 } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import type { ChatConversation, ChatMessage } from '@/hooks/useConversations';
import MessageBubble from './MessageBubble';
import DateSeparator from './DateSeparator';
import QuickReplies from './QuickReplies';
import ChatNotes from './ChatNotes';
import EmojiPicker from './EmojiPicker';

interface ChatWindowProps {
  conversation: ChatConversation;
  onToggleContact: () => void;
  module?: string;
  tenantId?: string | null;
  conversationDbId?: string | null;
}

const SUPABASE_PROJECT_ID = import.meta.env.VITE_SUPABASE_PROJECT_ID || 'mhbmxvgcdzhqwpznmgei';

function getDateLabel(dateStr: string): string {
  const d = new Date(dateStr);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);

  if (d.toDateString() === today.toDateString()) return 'اليوم';
  if (d.toDateString() === yesterday.toDateString()) return 'أمس';
  return d.toLocaleDateString('ar-EG', { year: 'numeric', month: 'long', day: 'numeric' });
}

const ChatWindow = ({ conversation, onToggleContact, module = 'confirm', tenantId, conversationDbId }: ChatWindowProps) => {
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [showQuickReplies, setShowQuickReplies] = useState(false);
  const [quickReplyQuery, setQuickReplyQuery] = useState('');
  const [replyTo, setReplyTo] = useState<ChatMessage | null>(null);
  const [showNotes, setShowNotes] = useState(false);
  const [showEmoji, setShowEmoji] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [attachmentPreview, setAttachmentPreview] = useState<{ url: string; file: File } | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [conversation.messages]);

  const handleSend = async () => {
    if (!message.trim() || sending) return;
    setSending(true);
    try {
      const res = await fetch(
        `https://${SUPABASE_PROJECT_ID}.supabase.co/functions/v1/send-message`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            to: conversation.contact.phone,
            message: message.trim(),
            replyToMessageId: replyTo?.id || undefined,
          }),
        }
      );
      if (!res.ok) throw new Error('Failed to send');
      setMessage('');
      setReplyTo(null);
      setShowQuickReplies(false);
    } catch (err) {
      toast({ title: '❌ خطأ', description: 'فشل إرسال الرسالة', variant: 'destructive' });
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleMessageChange = (val: string) => {
    setMessage(val);
    // Detect slash command
    if (val.startsWith('/')) {
      setShowQuickReplies(true);
      setQuickReplyQuery(val.slice(1));
    } else {
      setShowQuickReplies(false);
    }
  };

  const handleQuickReplySelect = (text: string) => {
    setMessage(text);
    setShowQuickReplies(false);
    textareaRef.current?.focus();
  };

  const handleReply = useCallback((msg: ChatMessage) => {
    setReplyTo(msg);
    textareaRef.current?.focus();
  }, []);

  // Group messages by date
  const messagesWithDates: (ChatMessage | { type: 'date'; label: string })[] = [];
  let lastDate = '';
  for (const msg of conversation.messages) {
    const dateKey = msg.rawTimestamp ? new Date(msg.rawTimestamp).toDateString() : '';
    if (dateKey && dateKey !== lastDate) {
      lastDate = dateKey;
      messagesWithDates.push({ type: 'date', label: getDateLabel(msg.rawTimestamp) });
    }
    messagesWithDates.push(msg);
  }

  return (
    <div className="flex-1 flex h-full min-w-0">
      <div className="flex-1 flex flex-col h-full min-w-0">
        {/* Header */}
        <div className="h-16 border-b border-border flex items-center justify-between px-5 bg-card flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-primary/15 flex items-center justify-center">
              <span className="text-sm font-bold text-primary">
                {conversation.contact.name.charAt(0)}
              </span>
            </div>
            <div>
              <h3 className="font-semibold text-sm text-foreground">
                {conversation.contact.name}
              </h3>
              <p className="text-xs text-muted-foreground">{conversation.contact.phone}</p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setShowNotes(!showNotes)}
              className={`p-2.5 rounded-lg transition-colors ${showNotes ? 'bg-primary/15 text-primary' : 'hover:bg-secondary text-muted-foreground'}`}
              title="ملاحظات داخلية"
            >
              <StickyNote className="w-4 h-4" />
            </button>
            <button className="p-2.5 rounded-lg hover:bg-secondary text-muted-foreground transition-colors">
              <Phone className="w-4 h-4" />
            </button>
            <button
              onClick={onToggleContact}
              className="p-2.5 rounded-lg hover:bg-secondary text-muted-foreground transition-colors"
            >
              <UserCircle className="w-4 h-4" />
            </button>
            <button className="p-2.5 rounded-lg hover:bg-secondary text-muted-foreground transition-colors">
              <MoreVertical className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-5 space-y-3 bg-background">
          {conversation.messages.length === 0 && (
            <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
              لا توجد رسائل بعد
            </div>
          )}
          {messagesWithDates.map((item, i) => {
            if ('type' in item && item.type === 'date') {
              return <DateSeparator key={`date-${i}`} date={item.label} />;
            }
            const msg = item as ChatMessage;
            return (
              <MessageBubble
                key={msg.id}
                message={msg}
                onReply={handleReply}
                allMessages={conversation.messages}
              />
            );
          })}
          <div ref={messagesEndRef} />
        </div>

        {/* Reply quote bar */}
        {replyTo && (
          <div className="px-4 py-2 bg-secondary/50 border-t border-border flex items-center gap-3">
            <Reply className="w-4 h-4 text-primary flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-[10px] text-primary font-semibold">
                {replyTo.sender === 'customer' ? 'العميل' : 'أنت'}
              </p>
              <p className="text-xs text-muted-foreground truncate">{replyTo.text}</p>
            </div>
            <button onClick={() => setReplyTo(null)} className="p-1 hover:bg-secondary rounded">
              <X className="w-3.5 h-3.5 text-muted-foreground" />
            </button>
          </div>
        )}

        {/* Input */}
        <div className="p-3 border-t border-border bg-card flex-shrink-0 relative">
          {showQuickReplies && (
            <QuickReplies
              query={quickReplyQuery}
              tenantId={tenantId}
              module={module}
              contactName={conversation.contact.name}
              contactPhone={conversation.contact.phone}
              onSelect={handleQuickReplySelect}
              onClose={() => setShowQuickReplies(false)}
            />
          )}
          <div className="flex items-end gap-2">
            <button
              onClick={() => setShowEmoji(!showEmoji)}
              className="p-2 text-muted-foreground hover:text-foreground transition-colors rounded-lg hover:bg-secondary mb-0.5"
            >
              <Smile className="w-5 h-5" />
            </button>
            <button className="p-2 text-muted-foreground hover:text-foreground transition-colors rounded-lg hover:bg-secondary mb-0.5">
              <Paperclip className="w-5 h-5" />
            </button>
            <Textarea
              ref={textareaRef}
              value={message}
              onChange={(e) => handleMessageChange(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="اكتب رسالة... أو / للردود السريعة"
              className="flex-1 bg-secondary border-0 text-sm min-h-[40px] max-h-[120px] resize-none py-2.5"
              rows={1}
            />
            <button
              onClick={handleSend}
              disabled={!message.trim() || sending}
              className="p-2.5 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed mb-0.5"
            >
              <Send className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>

      {/* Notes panel */}
      {showNotes && (
        <div className="w-[280px] border-l border-border bg-card flex-shrink-0">
          <ChatNotes
            conversationId={conversationDbId || null}
            onClose={() => setShowNotes(false)}
          />
        </div>
      )}
    </div>
  );
};

export default ChatWindow;
