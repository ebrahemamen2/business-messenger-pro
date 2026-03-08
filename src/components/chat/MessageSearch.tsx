import { Search, X, ChevronUp, ChevronDown } from 'lucide-react';
import { useState, useEffect, useCallback } from 'react';
import { Input } from '@/components/ui/input';
import type { ChatMessage } from '@/hooks/useConversations';

interface MessageSearchProps {
  messages: ChatMessage[];
  onClose: () => void;
  onHighlight: (messageId: string | null, index: number, total: number) => void;
  onQueryChange?: (query: string) => void;
}

const MessageSearch = ({ messages, onClose, onHighlight }: MessageSearchProps) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<string[]>([]);
  const [currentIdx, setCurrentIdx] = useState(0);

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      onHighlight(null, 0, 0);
      return;
    }
    const q = query.toLowerCase();
    const ids = messages.filter((m) => m.text?.toLowerCase().includes(q)).map((m) => m.id);
    setResults(ids);
    setCurrentIdx(0);
    if (ids.length > 0) {
      onHighlight(ids[0], 1, ids.length);
    } else {
      onHighlight(null, 0, 0);
    }
  }, [query, messages]);

  const navigate = useCallback((dir: 1 | -1) => {
    if (results.length === 0) return;
    const next = (currentIdx + dir + results.length) % results.length;
    setCurrentIdx(next);
    onHighlight(results[next], next + 1, results.length);
  }, [results, currentIdx, onHighlight]);

  const handleClose = () => {
    onHighlight(null, 0, 0);
    onClose();
  };

  return (
    <div className="flex items-center gap-2 px-4 py-2 bg-card border-b border-border">
      <Search className="w-4 h-4 text-muted-foreground flex-shrink-0" />
      <Input
        autoFocus
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="بحث في الرسائل..."
        className="flex-1 bg-secondary border-0 text-sm h-8"
        onKeyDown={(e) => {
          if (e.key === 'Enter') navigate(e.shiftKey ? -1 : 1);
          if (e.key === 'Escape') handleClose();
        }}
      />
      {results.length > 0 && (
        <span className="text-xs text-muted-foreground flex-shrink-0">
          {currentIdx + 1}/{results.length}
        </span>
      )}
      <button onClick={() => navigate(-1)} disabled={results.length === 0} className="p-1 hover:bg-secondary rounded disabled:opacity-30">
        <ChevronUp className="w-4 h-4" />
      </button>
      <button onClick={() => navigate(1)} disabled={results.length === 0} className="p-1 hover:bg-secondary rounded disabled:opacity-30">
        <ChevronDown className="w-4 h-4" />
      </button>
      <button onClick={handleClose} className="p-1 hover:bg-secondary rounded">
        <X className="w-4 h-4" />
      </button>
    </div>
  );
};

export default MessageSearch;
