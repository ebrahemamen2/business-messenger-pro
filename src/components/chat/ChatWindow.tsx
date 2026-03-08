import { Send, Paperclip, Smile, Phone, UserCircle, MoreVertical, CheckCheck, Check, Store } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import type { ChatConversation, ChatMessage } from '@/hooks/useConversations';

interface ChatWindowProps {
  conversation: ChatConversation;
  onToggleContact: () => void;
}

const SUPABASE_PROJECT_ID = import.meta.env.VITE_SUPABASE_PROJECT_ID || 'mhbmxvgcdzhqwpznmgei';

const ChatWindow = ({ conversation, onToggleContact }: ChatWindowProps) => {
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
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
          }),
        }
      );
      if (!res.ok) throw new Error('Failed to send');
      setMessage('');
    } catch (err) {
      toast({ title: '❌ خطأ', description: 'فشل إرسال الرسالة', variant: 'destructive' });
    } finally {
      setSending(false);
    }
  };

  const renderStatus = (status?: string) => {
    if (!status) return null;
    if (status === 'read') return <CheckCheck className="w-3.5 h-3.5 text-chat-read" />;
    if (status === 'delivered') return <CheckCheck className="w-3.5 h-3.5 opacity-60" />;
    return <Check className="w-3.5 h-3.5 opacity-60" />;
  };

  return (
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
            <p className="text-xs text-muted-foreground">
              {conversation.contact.phone}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1">
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
        {conversation.messages.map((msg, i) => (
          <div
            key={msg.id}
            className={`flex ${
              msg.sender === 'customer' ? 'justify-start' : 'justify-end'
            } animate-fade-in`}
          >
            <div
              className={`max-w-[65%] px-4 py-2.5 ${
                msg.sender === 'store'
                  ? 'bubble-store bg-[hsl(var(--store-message))] text-[hsl(var(--store-message-foreground))]'
                  : msg.sender === 'agent'
                  ? 'bubble-agent bg-primary text-primary-foreground'
                  : 'bubble-customer bg-card text-foreground'
              }`}
            >
              {msg.sender === 'store' && (
                <div className="flex items-center gap-1 mb-1 opacity-80">
                  <Store className="w-3 h-3" />
                  <span className="text-[10px] font-semibold">رسالة المتجر</span>
                </div>
              )}
              <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.text}</p>
              <div
                className={`flex items-center gap-1 mt-1 ${
                  msg.sender !== 'customer' ? 'justify-end' : ''
                }`}
              >
                <span className="text-[10px] opacity-70">{msg.timestamp}</span>
                {msg.sender === 'agent' && renderStatus(msg.status)}
              </div>
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-3 border-t border-border bg-card flex-shrink-0">
        <div className="flex items-center gap-2">
          <button className="p-2 text-muted-foreground hover:text-foreground transition-colors rounded-lg hover:bg-secondary">
            <Smile className="w-5 h-5" />
          </button>
          <button className="p-2 text-muted-foreground hover:text-foreground transition-colors rounded-lg hover:bg-secondary">
            <Paperclip className="w-5 h-5" />
          </button>
          <Input
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            placeholder="اكتب رسالة..."
            className="flex-1 bg-secondary border-0 text-sm"
          />
          <button
            onClick={handleSend}
            disabled={!message.trim() || sending}
            className="p-2.5 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Send className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default ChatWindow;
