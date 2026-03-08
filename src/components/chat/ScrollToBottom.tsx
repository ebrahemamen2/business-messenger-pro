import { ChevronDown } from 'lucide-react';

interface ScrollToBottomProps {
  onClick: () => void;
  unreadCount?: number;
}

const ScrollToBottom = ({ onClick, unreadCount = 0 }: ScrollToBottomProps) => {
  return (
    <button
      onClick={onClick}
      className="absolute bottom-20 left-1/2 -translate-x-1/2 z-10 w-10 h-10 rounded-full bg-card shadow-lg border border-border flex items-center justify-center hover:bg-secondary transition-colors"
    >
      {unreadCount > 0 && (
        <span className="absolute -top-2 -right-1 w-5 h-5 bg-primary text-primary-foreground text-[10px] font-bold rounded-full flex items-center justify-center">
          {unreadCount}
        </span>
      )}
      <ChevronDown className="w-5 h-5 text-foreground" />
    </button>
  );
};

export default ScrollToBottom;
