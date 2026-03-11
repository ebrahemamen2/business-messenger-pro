import { useState, useRef, useEffect } from 'react';
import { SmilePlus } from 'lucide-react';

const QUICK_REACTIONS = ['❤️', '😂', '😮', '😢', '🙏', '👍'];

interface MessageReactionsProps {
  reactions: Record<string, number>;
  onReact: (emoji: string) => void;
  isCustomer: boolean;
}

const MessageReactions = ({ reactions, onReact, isCustomer }: MessageReactionsProps) => {
  const [showPicker, setShowPicker] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!showPicker) return;
    const handler = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setShowPicker(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showPicker]);

  const hasReactions = Object.keys(reactions).length > 0;

  return (
    <>
      {/* Reaction picker trigger - shows on hover via parent group */}
      <button
        onClick={(e) => { e.stopPropagation(); setShowPicker(!showPicker); }}
        className={`absolute ${isCustomer ? '-right-1' : '-left-1'} -bottom-1 opacity-0 group-hover:opacity-100 transition-opacity bg-card text-muted-foreground p-1 rounded-full shadow-md border border-border z-10 hover:text-foreground`}
      >
        <SmilePlus className="w-3 h-3" />
      </button>

      {/* Quick reaction picker */}
      {showPicker && (
        <div
          ref={pickerRef}
          className={`absolute ${isCustomer ? 'left-0' : 'right-0'} -bottom-10 z-50 flex items-center gap-0.5 bg-card border border-border rounded-full px-1.5 py-1 shadow-lg`}
        >
          {QUICK_REACTIONS.map((emoji) => (
            <button
              key={emoji}
              onClick={(e) => { e.stopPropagation(); onReact(emoji); setShowPicker(false); }}
              className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-secondary transition-colors text-base hover:scale-125 transform duration-150"
            >
              {emoji}
            </button>
          ))}
        </div>
      )}

      {/* Display existing reactions */}
      {hasReactions && (
        <div className={`flex flex-wrap gap-1 mt-1 ${!isCustomer ? 'justify-end' : ''}`}>
          {Object.entries(reactions).map(([emoji, count]) => (
            <button
              key={emoji}
              onClick={(e) => { e.stopPropagation(); onReact(emoji); }}
              className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-secondary/80 hover:bg-secondary border border-border text-xs transition-colors"
            >
              <span>{emoji}</span>
              {count > 1 && <span className="text-[10px] text-muted-foreground">{count}</span>}
            </button>
          ))}
        </div>
      )}
    </>
  );
};

export default MessageReactions;
