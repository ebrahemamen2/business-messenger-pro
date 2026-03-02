import { Send, Paperclip, Smile, Phone, UserCircle, MoreVertical, CheckCheck, Check, Image } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { useState, useEffect, useRef } from 'react';
import type { Conversation, Message } from '@/data/mockData';

interface ChatWindowProps {
  conversation: Conversation;
  onToggleContact: () => void;
}

const ChatWindow = ({ conversation, onToggleContact }: ChatWindowProps) => {
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState<Message[]>(conversation.messages);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMessages(conversation.messages);
  }, [conversation.id]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = () => {
    if (!message.trim()) return;
    const newMsg: Message = {
      id: `new-${Date.now()}`,
      text: message,
      timestamp: new Date().toLocaleTimeString('ar-EG', {
        hour: '2-digit',
        minute: '2-digit',
      }),
      sender: 'agent',
      status: 'sent',
    };
    setMessages((prev) => [...prev, newMsg]);
    setMessage('');
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
        {/* Date separator */}
        <div className="flex items-center justify-center mb-4">
          <span className="text-[11px] text-muted-foreground bg-card px-3 py-1 rounded-full">
            اليوم
          </span>
        </div>

        {messages.map((msg, i) => (
          <div
            key={msg.id}
            className={`flex ${
              msg.sender === 'agent' ? 'justify-end' : 'justify-start'
            } animate-fade-in`}
            style={{ animationDelay: `${i * 30}ms` }}
          >
            <div
              className={`max-w-[65%] px-4 py-2.5 ${
                msg.sender === 'agent'
                  ? 'bubble-agent bg-primary text-primary-foreground'
                  : 'bubble-customer bg-card text-foreground'
              }`}
            >
              <p className="text-sm leading-relaxed">{msg.text}</p>
              <div
                className={`flex items-center gap-1 mt-1 ${
                  msg.sender === 'agent' ? 'justify-end' : ''
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
          <button className="p-2 text-muted-foreground hover:text-foreground transition-colors rounded-lg hover:bg-secondary">
            <Image className="w-5 h-5" />
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
            disabled={!message.trim()}
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
