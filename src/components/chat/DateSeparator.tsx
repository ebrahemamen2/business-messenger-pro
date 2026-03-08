interface DateSeparatorProps {
  date: string;
}

const DateSeparator = ({ date }: DateSeparatorProps) => {
  return (
    <div className="flex items-center gap-3 my-4">
      <div className="flex-1 h-px bg-border" />
      <span className="text-[11px] text-muted-foreground bg-secondary px-3 py-1 rounded-full font-medium">
        {date}
      </span>
      <div className="flex-1 h-px bg-border" />
    </div>
  );
};

export default DateSeparator;
