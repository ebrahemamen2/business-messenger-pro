import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { StickyNote, Send, X } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';

interface ChatNote {
  id: string;
  content: string;
  user_id: string;
  created_at: string;
}

interface ChatNotesProps {
  conversationId: string | null;
  onClose: () => void;
}

const ChatNotes = ({ conversationId, onClose }: ChatNotesProps) => {
  const [notes, setNotes] = useState<ChatNote[]>([]);
  const [newNote, setNewNote] = useState('');
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!conversationId) return;
    loadNotes();
  }, [conversationId]);

  const loadNotes = async () => {
    if (!conversationId) return;
    const { data } = await supabase
      .from('chat_notes')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: false });
    if (data) setNotes(data);
  };

  const handleAdd = async () => {
    if (!newNote.trim() || !conversationId || sending) return;
    setSending(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setSending(false); return; }

    await supabase.from('chat_notes').insert({
      conversation_id: conversationId,
      user_id: user.id,
      content: newNote.trim(),
    });
    setNewNote('');
    setSending(false);
    loadNotes();
  };

  const formatTime = (d: string) => new Date(d).toLocaleString('ar-EG', {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
  });

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <div className="flex items-center gap-2">
          <StickyNote className="w-4 h-4 text-primary" />
          <span className="text-sm font-semibold text-foreground">ملاحظات داخلية</span>
        </div>
        <button onClick={onClose} className="p-1 hover:bg-secondary rounded-lg">
          <X className="w-4 h-4 text-muted-foreground" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {notes.length === 0 && (
          <p className="text-center text-xs text-muted-foreground py-6">لا توجد ملاحظات بعد</p>
        )}
        {notes.map((n) => (
          <div key={n.id} className="bg-accent/10 border border-accent/20 rounded-lg p-3">
            <p className="text-sm text-foreground whitespace-pre-wrap">{n.content}</p>
            <p className="text-[10px] text-muted-foreground mt-1.5">{formatTime(n.created_at)}</p>
          </div>
        ))}
      </div>

      <div className="p-3 border-t border-border flex gap-2">
        <Textarea
          value={newNote}
          onChange={(e) => setNewNote(e.target.value)}
          placeholder="اكتب ملاحظة داخلية..."
          className="text-xs min-h-[40px] flex-1 bg-secondary border-0"
          onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), handleAdd())}
        />
        <button
          onClick={handleAdd}
          disabled={!newNote.trim() || sending}
          className="p-2 rounded-lg bg-accent text-accent-foreground hover:opacity-90 disabled:opacity-40 self-end"
        >
          <Send className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

export default ChatNotes;
