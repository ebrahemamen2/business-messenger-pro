import { CheckCheck, Check, Clock, Store, Reply, FileText, Download, Mic } from 'lucide-react';
import type { ChatMessage } from '@/hooks/useConversations';
import { useState, useRef } from 'react';

interface MessageBubbleProps {
  message: ChatMessage;
  onReply?: (message: ChatMessage) => void;
  allMessages?: ChatMessage[];
}

const MessageBubble = ({ message, onReply, allMessages = [] }: MessageBubbleProps) => {
  const isCustomer = message.sender === 'customer';
  const isStore = message.sender === 'store';
  const isAgent = message.sender === 'agent';
  const [imgLoaded, setImgLoaded] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);
  const [audioPlaying, setAudioPlaying] = useState(false);
  const [audioDuration, setAudioDuration] = useState('0:00');
  const [audioProgress, setAudioProgress] = useState(0);

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

  const formatDuration = (s: number) => {
    if (!s || !isFinite(s)) return '0:00';
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  const toggleAudio = () => {
    if (!audioRef.current) return;
    if (audioPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
    setAudioPlaying(!audioPlaying);
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
        <a
          href={message.mediaUrl!}
          target="_blank"
          rel="noopener noreferrer"
          className="block rounded-xl overflow-hidden relative group/img"
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
          {/* Overlay timestamp on image-only messages */}
          {isMediaOnly && imgLoaded && (
            <div className="absolute bottom-2 right-2 flex items-center gap-1 bg-black/50 backdrop-blur-sm px-2 py-0.5 rounded-full">
              <span className="text-[10px] text-white/90">{message.timestamp}</span>
              {isAgent && <span className="text-white/80">{renderStatus(message.status)}</span>}
            </div>
          )}
        </a>
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
      return (
        <div className="flex items-center gap-3 min-w-[220px] max-w-[280px]">
          <audio
            ref={audioRef}
            src={message.mediaUrl!}
            preload="metadata"
            onLoadedMetadata={() => {
              if (audioRef.current) setAudioDuration(formatDuration(audioRef.current.duration));
            }}
            onTimeUpdate={() => {
              if (audioRef.current && audioRef.current.duration) {
                setAudioProgress((audioRef.current.currentTime / audioRef.current.duration) * 100);
              }
            }}
            onEnded={() => { setAudioPlaying(false); setAudioProgress(0); }}
            className="hidden"
          />
          {/* Play/Pause button */}
          <button
            onClick={toggleAudio}
            className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0 hover:bg-primary/30 transition-colors"
          >
            {audioPlaying ? (
              <div className="flex gap-0.5">
                <div className="w-1 h-4 bg-primary rounded-full" />
                <div className="w-1 h-4 bg-primary rounded-full" />
              </div>
            ) : (
              <svg className="w-4 h-4 text-primary ml-0.5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M8 5v14l11-7z" />
              </svg>
            )}
          </button>
          {/* Waveform / progress */}
          <div className="flex-1 flex flex-col gap-1.5">
            <div className="relative h-2 bg-muted/30 rounded-full overflow-hidden">
              <div
                className="absolute inset-y-0 left-0 bg-primary/60 rounded-full transition-all"
                style={{ width: `${audioProgress}%` }}
              />
              {/* Fake waveform bars */}
              <div className="absolute inset-0 flex items-center justify-evenly px-0.5 opacity-40">
                {Array.from({ length: 24 }).map((_, i) => (
                  <div
                    key={i}
                    className="w-[2px] bg-foreground/40 rounded-full"
                    style={{ height: `${30 + Math.sin(i * 0.8) * 50 + Math.random() * 20}%` }}
                  />
                ))}
              </div>
            </div>
            <div className="flex justify-between">
              <span className="text-[10px] opacity-60">{audioDuration}</span>
              <Mic className="w-3 h-3 opacity-40" />
            </div>
          </div>
        </div>
      );
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
    <div className={`group flex ${isCustomer ? 'justify-start' : 'justify-end'} animate-fade-in mb-0.5`}>
      <div className={`${bubbleClass} ${paddingClass}`}>
        {/* Reply button on hover */}
        {onReply && (
          <button
            onClick={() => onReply(message)}
            className={`absolute -top-2 ${isCustomer ? '-left-2' : '-right-2'} opacity-0 group-hover:opacity-100 transition-opacity bg-card text-foreground p-1.5 rounded-full shadow-lg border border-border z-10`}
          >
            <Reply className="w-3 h-3" />
          </button>
        )}

        {/* Store badge */}
        {isStore && (
          <div className="flex items-center gap-1 mb-1 px-1.5 opacity-80">
            <Store className="w-3 h-3" />
            <span className="text-[10px] font-semibold">رسالة المتجر</span>
          </div>
        )}

        {/* Reply quote */}
        {replyTarget && (
          <div className={`mb-1.5 ${isMediaOnly ? 'mx-1' : ''} px-2.5 py-1.5 rounded-lg bg-background/10 border-r-2 border-primary/50`}>
            <span className="text-[10px] font-bold opacity-80">
              {replyTarget.sender === 'customer' ? 'العميل' : 'أنت'}
            </span>
            <p className="text-[11px] opacity-70 truncate mt-0.5">{replyTarget.text}</p>
          </div>
        )}

        {/* Media */}
        {renderMedia()}

        {/* Text (hide placeholder text like [صورة]) */}
        {showText && (
          <p className={`text-[13px] leading-relaxed whitespace-pre-wrap ${isMediaOnly ? '' : ''} ${hasMediaContent ? 'mt-1 px-1' : ''}`}>
            {message.text}
          </p>
        )}

        {/* Footer: time + status (skip for image-only, shown as overlay) */}
        {!(isMediaOnly && (message.mediaType || '').startsWith('image')) && (
          <div className={`flex items-center gap-1 mt-0.5 ${hasMediaContent && isMediaOnly ? 'px-1' : ''} ${!isCustomer ? 'justify-end' : ''}`}>
            <span className="text-[10px] opacity-50">{message.timestamp}</span>
            {isAgent && renderStatus(message.status)}
          </div>
        )}
      </div>
    </div>
  );
};

export default MessageBubble;
