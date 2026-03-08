import { Filter, SortAsc } from 'lucide-react';

export type ChatFilter = 'all' | 'unread' | 'open' | 'pending' | 'resolved';
export type ChatSort = 'newest' | 'oldest' | 'unread';

interface ChatFiltersProps {
  activeFilter: ChatFilter;
  onFilterChange: (f: ChatFilter) => void;
  activeSort: ChatSort;
  onSortChange: (s: ChatSort) => void;
}

const filters: { value: ChatFilter; label: string }[] = [
  { value: 'all', label: 'الكل' },
  { value: 'unread', label: 'غير مقروء' },
  { value: 'open', label: 'مفتوح' },
  { value: 'pending', label: 'قيد المعالجة' },
  { value: 'resolved', label: 'مغلق' },
];

const ChatFilters = ({ activeFilter, onFilterChange, activeSort, onSortChange }: ChatFiltersProps) => {
  return (
    <div className="px-3 py-2 border-b border-border space-y-2">
      {/* Filter chips */}
      <div className="flex gap-1.5 overflow-x-auto scrollbar-none">
        {filters.map((f) => (
          <button
            key={f.value}
            onClick={() => onFilterChange(f.value)}
            className={`px-2.5 py-1 rounded-full text-[11px] font-medium whitespace-nowrap transition-colors ${
              activeFilter === f.value
                ? 'bg-primary text-primary-foreground'
                : 'bg-secondary text-muted-foreground hover:text-foreground'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>
    </div>
  );
};

export default ChatFilters;
