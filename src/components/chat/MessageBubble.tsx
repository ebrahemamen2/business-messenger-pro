import { CheckCheck, Check, Clock, Store, Reply, Image, FileText, Play, Mic } from 'lucide-react';
import type { ChatMessage } from '@/hooks/useConversations';

interface MessageBubbleProps {
  message: ChatMessage;
  onReply?: (message: ChatMessage) => void;
  allMessages?: ChatMessage[];
}

const MessageBubble = ({ message, onReply, allMessages = [] }: MessageBubbleProps) => {
  const isCustomer = message.sender === 'customer';
  const isStore = message.sender === 'store';
  const isAgent = message.sender === 'agent';

  const replyTarget = message.replyToId
    ? allMessages.find((m) => m.id === message.replyToId)
    : null;

  const renderStatus = (status?: string) => {
    if (!status) return null;
    switch (status) {
      case 'read':
        return <CheckCheck className="w-3.5 h-3.5 text-[hsl(var(--chat-read))]" />;
      case 'delivered':
        return <CheckCheck className="w-3.5 h-3.5 opacity-60" />;
      case 'sent':
        return <Check className="w-3.5 h-3.5 opacity-60" />;
      case 'pending':
        return <Clock className="w-3.5 h-3.5 opacity-40" />;
      default:
        return <Check className="w-3.5 h-3.5 opacity-40" />;
    }
  };

  const renderMedia = () => {
    if (!message.mediaUrl) return null;
    const type = message.mediaType || '';

    if (type.startsWith('image')) {
      return (
        <div className="mb-1.5 rounded-lg overflow-hidden max-w-[280px]">
          <img src={message.mediaUrl} alt="" className="w-full h-auto object-cover" loading="lazy" />
        </div>
      );
    }
    if (type.startsWith('video')) {
      return (
        <div className="mb-1.5 rounded-lg overflow-hidden max-w-[280px] relative bg-black/20 flex items-center justify-center h-40">
          <Play className="w-10 h-10 text-primary-foreground/80" />
        </div>
      );
    }
    if (type.startsWith('audio')) {
      return (
        <div className="mb-1.5 flex items-center gap-2 px-3 py-2 rounded-lg bg-background/20">
          <Mic className="w-4 h-4" />
          <div className="flex-1 h-1 bg-foreground/20 rounded-full">
            <div className="w-1/3 h-full bg-foreground/60 rounded-full" />
          </div>
          <span className="text-[10px] opacity-70">0:12</span>
        </div>
      );
    }
    // Document
    return (
      <div className="mb-1.5 flex items-center gap-2 px-3 py-2 rounded-lg bg-background/10">
        <FileText className="w-5 h-5" />
        <span className="text-xs truncate">مستند مرفق</span>
      </div>
    );
  };

  const bubbleClass = isStore
    ? 'bubble-store bg-[hsl(var(--store-message))] text-[hsl(var(--store-message-foreground))]'
    : isAgent
    ? 'bubble-agent bg-primary text-primary-foreground'
    : 'bubble-customer bg-card text-foreground border border-border';

  return (
    <div
      className={`group flex ${isCustomer ? 'justify-start' : 'justify-end'} animate-fade-in`}
    >
      <div className={`relative max-w-[65%] px-4 py-2.5 ${bubbleClass}`}>
        {/* Reply button on hover */}
        {onReply && (
          <button
            onClick={() => onReply(message)}
            className="absolute -top-2 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity bg-secondary text-foreground p-1 rounded-full shadow-md"
          >
            <Reply className="w-3.5 h-3.5" />
          </button>
        )}

        {/* Store badge */}
        {isStore && (
          <div className="flex items-center gap-1 mb-1 opacity-80">
            <Store className="w-3 h-3" />
            <span className="text-[10px] font-semibold">رسالة المتجر</span>
          </div>
        )}

        {/* Reply quote */}
        {replyTarget && (
          <div className="mb-2 px-2.5 py-1.5 rounded-md bg-background/15 border-r-2 border-primary/60 text-xs opacity-80 truncate max-w-full">
            <span className="font-semibold">{replyTarget.sender === 'customer' ? 'العميل' : 'أنت'}</span>
            <p className="truncate mt-0.5">{replyTarget.text}</p>
          </div>
        )}

        {/* Media */}
        {renderMedia()}

        {/* Text */}
        {message.text && (
          <p className="text-sm leading-relaxed whitespace-pre-wrap">{message.text}</p>
        )}

        {/* Footer: time + status */}
        <div className={`flex items-center gap-1 mt-1 ${!isCustomer ? 'justify-end' : ''}`}>
          <span className="text-[10px] opacity-70">{message.timestamp}</span>
          {isAgent && renderStatus(message.status)}
        </div>
      </div>
    </div>
  );
};

export default MessageBubble;
