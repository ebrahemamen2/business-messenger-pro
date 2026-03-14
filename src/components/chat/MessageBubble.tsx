import { CheckCheck, Check, Clock, Store, Reply, FileText, Download, Ban, RefreshCw, Forward } from 'lucide-react';
import type { ChatMessage } from '@/hooks/useConversations';
import { useState } from 'react';
import ImageLightbox from './ImageLightbox';
import FormattedText from './FormattedText';
import AudioPlayer from './AudioPlayer';
import MessageReactions from './MessageReactions';

interface MessageBubbleProps {
  message: ChatMessage;
  onReply?: (message: ChatMessage) => void;
  onReact?: (messageId: string, emoji: string) => void;
  onRetry?: (message: ChatMessage) => void;
  onForward?: (message: ChatMessage) => void;
  allMessages?: ChatMessage[];
  highlight?: string;
  isHighlighted?: boolean;
  reactions?: Record<string, number>;
}

const MessageBubble = ({ message, onReply, onReact, onRetry, onForward, allMessages = [], highlight, isHighlighted, reactions = {} }: MessageBubbleProps) => {
  const isCustomer = message.sender === 'customer';
  const isStore = message.sender === 'store';
  const isAgent = message.sender === 'agent';
  const isFailed = message.status === 'failed';
  const [imgLoaded, setImgLoaded] = useState(false);
  const [lightboxOpen, setLightboxOpen] = useState(false);

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
      case 'sending':
        return <Clock className="w-3.5 h-3.5 opacity-40" />;
      case 'failed':
        return <Ban className="w-3.5 h-3.5 text-destructive" />;
      default:
        return <Check className="w-3.5 h-3.5 opacity-40" />;
    }
  };

  const hasMediaContent = !!message.mediaUrl;
  const isMediaOnly = hasMediaContent && (!message.text || message.text.startsWith('['));
  const showText = message.text && !message.text.startsWith('[');

  const renderMedia = () => {
    if (!message.mediaUrl) return null;
    const type = message.mediaType || '';

    // Image
    if (type.startsWith('image') || type === 'webp') {
      return (
        <>
          <div
            onClick={() => setLightboxOpen(true)}
            className="block rounded-xl overflow-hidden relative group/img cursor-pointer"
          >
            {!imgLoaded && (
              <div className="w-[260px] h-[180px] bg-muted/30 animate-pulse rounded-xl" />
            )}
            <img
              src={message.mediaUrl!}
              alt=""
              className={`w-full max-w-[280px] h-auto object-cover rounded-xl transition-opacity ${imgLoaded ? 'opacity-100' : 'opacity-0 absolute inset-0'}`}
              loading="lazy"
              onLoad={() => setImgLoaded(true)}
            />
            {isMediaOnly && imgLoaded && (
              <div className="absolute bottom-2 right-2 flex items-center gap-1 bg-black/50 backdrop-blur-sm px-2 py-0.5 rounded-full">
                <span className="text-[10px] text-white/90">{message.timestamp}</span>
                {isAgent && <span className="text-white/80">{renderStatus(message.status)}</span>}
              </div>
            )}
          </div>
          {lightboxOpen && (
            <ImageLightbox src={message.mediaUrl!} onClose={() => setLightboxOpen(false)} />
          )}
        </>
      );
    }

    // Video
    if (type.startsWith('video')) {
      return (
        <div className="rounded-xl overflow-hidden max-w-[280px]">
          <video
            controls
            className="w-full h-auto max-h-[300px] rounded-xl bg-black"
            preload="metadata"
            playsInline
          >
            <source src={message.mediaUrl!} type={type.includes('/') ? type : `video/${type}`} />
          </video>
        </div>
      );
    }

    // Audio / Voice note
    if (type.startsWith('audio') || type === 'ogg' || type === 'opus') {
      return <AudioPlayer src={message.mediaUrl!} isAgent={isAgent} />;
    }

    // Document
    const fileName = message.text?.replace(/^\[مستند\]\s*/, '').replace(/^\[.*?\]\s*/, '') || 'مستند مرفق';
    return (
      <a
        href={message.mediaUrl!}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-muted/20 hover:bg-muted/30 transition-colors min-w-[200px]"
      >
        <div className="w-10 h-10 rounded-lg bg-destructive/15 flex items-center justify-center flex-shrink-0">
          <FileText className="w-5 h-5 text-destructive" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium truncate">{fileName}</p>
          <p className="text-[10px] opacity-50">مستند • اضغط للتحميل</p>
        </div>
        <Download className="w-4 h-4 opacity-40 flex-shrink-0" />
      </a>
    );
  };

  const bubbleBase = 'relative max-w-[75%] shadow-sm';
  const bubbleClass = isStore
    ? `${bubbleBase} bubble-store bg-[hsl(var(--store-message))] text-[hsl(var(--store-message-foreground))]`
    : isAgent
    ? `${bubbleBase} bubble-agent bg-primary text-primary-foreground`
    : `${bubbleBase} bubble-customer bg-card text-foreground border border-border`;

  // Tighter padding for media-only messages
  const paddingClass = isMediaOnly ? 'p-1.5' : 'px-3 py-2';

  return (
    <div className={`group flex ${isCustomer ? 'justify-start' : 'justify-end'} animate-fade-in mb-0.5 ${isHighlighted ? 'scroll-mt-20' : ''}`} id={`msg-${message.id}`}>
      <div className={`${bubbleClass} ${paddingClass} ${isHighlighted ? 'ring-2 ring-primary/50 transition-all duration-500' : ''} ${isFailed ? 'opacity-70' : ''}`}>
        {/* Hover action buttons */}
        <div className={`absolute -top-2 ${isCustomer ? '-left-2' : '-right-2'} opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-0.5 z-10`}>
          {onReply && (
            <button
              onClick={() => onReply(message)}
              className="bg-card text-foreground p-1.5 rounded-full shadow-lg border border-border"
              title="رد"
            >
              <Reply className="w-3 h-3" />
            </button>
          )}
          {onForward && !message.id.startsWith('optimistic') && (
            <button
              onClick={() => onForward(message)}
              className="bg-card text-foreground p-1.5 rounded-full shadow-lg border border-border"
              title="إعادة توجيه"
            >
              <Forward className="w-3 h-3" />
            </button>
          )}
        </div>

        {/* Store badge */}
        {isStore && (
          <div className="flex items-center gap-1 mb-1 px-1.5 opacity-80">
            <Store className="w-3 h-3" />
            <span className="text-[10px] font-semibold">رسالة المتجر</span>
          </div>
        )}

        {/* Reply quote - WhatsApp style */}
        {replyTarget && (
          <div
            className={`mb-1.5 ${isMediaOnly ? 'mx-1' : ''} flex items-stretch rounded-lg overflow-hidden bg-background/10 border-r-2 border-primary/50 cursor-pointer`}
            onClick={() => {
              const el = document.getElementById(`msg-${replyTarget.id}`);
              if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }}
          >
            <div className="flex-1 px-2.5 py-1.5 min-w-0">
              <span className="text-[10px] font-bold opacity-80">
                {replyTarget.sender === 'customer' ? 'العميل' : 'أنت'}
              </span>
              {replyTarget.mediaUrl && replyTarget.mediaType?.startsWith('image') && !replyTarget.text?.replace(/^\[.*?\]/, '').trim() ? (
                <p className="text-[11px] opacity-70 mt-0.5 flex items-center gap-1">📷 صورة</p>
              ) : replyTarget.mediaUrl && replyTarget.mediaType?.startsWith('video') ? (
                <p className="text-[11px] opacity-70 mt-0.5 flex items-center gap-1">🎥 فيديو</p>
              ) : replyTarget.mediaUrl && (replyTarget.mediaType?.startsWith('audio') || replyTarget.mediaType?.includes('ogg')) ? (
                <p className="text-[11px] opacity-70 mt-0.5 flex items-center gap-1">🎤 رسالة صوتية</p>
              ) : replyTarget.mediaUrl && replyTarget.mediaType?.includes('document') ? (
                <p className="text-[11px] opacity-70 mt-0.5 flex items-center gap-1">📄 مستند</p>
              ) : (
                <p className="text-[11px] opacity-70 truncate mt-0.5">
                  {replyTarget.text && replyTarget.text.length > 80
                    ? replyTarget.text.slice(0, 80) + '…'
                    : replyTarget.text}
                </p>
              )}
            </div>
            {/* Thumbnail for images */}
            {replyTarget.mediaUrl && replyTarget.mediaType?.startsWith('image') && (
              <div className="w-12 h-12 flex-shrink-0">
                <img
                  src={replyTarget.mediaUrl}
                  alt=""
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
              </div>
            )}
          </div>
        )}

        {/* Media */}
        {renderMedia()}

        {/* Text (hide placeholder text like [صورة]) */}
        {showText && (
          <p className={`text-[13px] leading-relaxed whitespace-pre-wrap ${hasMediaContent ? 'mt-1 px-1' : ''}`}>
            <FormattedText text={message.text!} highlight={highlight} />
          </p>
        )}

        {/* Footer: time + status (skip for image-only, shown as overlay) */}
        {!(isMediaOnly && (message.mediaType || '').startsWith('image')) && (
          <div className={`flex items-center gap-1 mt-0.5 ${hasMediaContent && isMediaOnly ? 'px-1' : ''} ${!isCustomer ? 'justify-end' : ''}`}>
            <span className="text-[10px] opacity-50">{message.timestamp}</span>
            {isAgent && renderStatus(message.status)}
          </div>
        )}

        {/* Failed message retry */}
        {isFailed && onRetry && (
          <button
            onClick={() => onRetry(message)}
            className="mt-1 flex items-center gap-1.5 text-[11px] text-destructive hover:text-destructive/80 transition-colors w-full justify-center py-1 rounded-lg bg-destructive/10 hover:bg-destructive/15"
          >
            <RefreshCw className="w-3 h-3" />
            إعادة الإرسال
          </button>
        )}

        {/* Emoji reactions */}
        <MessageReactions
          reactions={reactions}
          onReact={(emoji) => onReact?.(message.id, emoji)}
          isCustomer={isCustomer}
        />
      </div>
    </div>
  );
};

export default MessageBubble;
