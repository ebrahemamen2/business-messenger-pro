import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Zap, Plus, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';

interface QuickReply {
  id: string;
  shortcut: string;
  title: string;
  body: string;
}

interface QuickRepliesProps {
  query: string;
  tenantId?: string | null;
  module: string;
  contactName?: string;
  contactPhone?: string;
  onSelect: (text: string) => void;
  onClose: () => void;
}

function replaceVars(text: string, vars: Record<string, string>) {
  return text.replace(/\{(\w+)\}/g, (_, key) => vars[key] || `{${key}}`);
}

const QuickReplies = ({ query, tenantId, module, contactName, contactPhone, onSelect, onClose }: QuickRepliesProps) => {
  const [replies, setReplies] = useState<QuickReply[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [newShortcut, setNewShortcut] = useState('');
  const [newTitle, setNewTitle] = useState('');
  const [newBody, setNewBody] = useState('');
  const { toast } = useToast();

  useEffect(() => {
    loadReplies();
  }, [tenantId, module]);

  const loadReplies = async () => {
    let q = supabase.from('quick_replies').select('*').eq('module', module);
    if (tenantId) q = q.eq('tenant_id', tenantId);
    const { data } = await q;
    if (data) setReplies(data);
  };

  const filtered = replies.filter(
    (r) =>
      r.shortcut.toLowerCase().includes(query.toLowerCase()) ||
      r.title.toLowerCase().includes(query.toLowerCase())
  );

  const handleSelect = (reply: QuickReply) => {
    const vars = { name: contactName || '', phone: contactPhone || '' };
    onSelect(replaceVars(reply.body, vars));
  };

  const handleAdd = async () => {
    if (!newShortcut || !newBody) return;
    const { error } = await supabase.from('quick_replies').insert({
      shortcut: newShortcut,
      title: newTitle || newShortcut,
      body: newBody,
      module,
      tenant_id: tenantId || undefined,
    });
    if (error) {
      toast({ title: '❌ خطأ', description: 'فشل إضافة الرد السريع', variant: 'destructive' });
    } else {
      setNewShortcut('');
      setNewTitle('');
      setNewBody('');
      setShowAdd(false);
      loadReplies();
    }
  };

  return (
    <div className="absolute bottom-full left-0 right-0 mb-1 bg-popover border border-border rounded-xl shadow-xl max-h-64 overflow-y-auto z-50">
      <div className="flex items-center justify-between px-3 py-2 border-b border-border">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Zap className="w-3.5 h-3.5 text-primary" />
          <span>ردود سريعة</span>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={() => setShowAdd(!showAdd)} className="p-1 hover:bg-secondary rounded">
            <Plus className="w-3.5 h-3.5 text-muted-foreground" />
          </button>
          <button onClick={onClose} className="p-1 hover:bg-secondary rounded">
            <X className="w-3.5 h-3.5 text-muted-foreground" />
          </button>
        </div>
      </div>

      {showAdd && (
        <div className="p-3 border-b border-border space-y-2">
          <Input placeholder="الاختصار (مثل: مرحبا)" value={newShortcut} onChange={(e) => setNewShortcut(e.target.value)} className="text-xs h-8" />
          <Input placeholder="العنوان" value={newTitle} onChange={(e) => setNewTitle(e.target.value)} className="text-xs h-8" />
          <Textarea placeholder="نص الرد... {name} {phone}" value={newBody} onChange={(e) => setNewBody(e.target.value)} className="text-xs min-h-[60px]" />
          <Button size="sm" onClick={handleAdd} className="w-full text-xs h-7">إضافة</Button>
        </div>
      )}

      {filtered.length === 0 && !showAdd && (
        <div className="p-4 text-center text-xs text-muted-foreground">لا توجد ردود سريعة مطابقة</div>
      )}

      {filtered.map((r) => (
        <button
          key={r.id}
          onClick={() => handleSelect(r)}
          className="w-full text-right px-3 py-2.5 hover:bg-secondary/60 transition-colors border-b border-border/30 last:border-0"
        >
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-mono bg-primary/15 text-primary px-1.5 py-0.5 rounded">/{r.shortcut}</span>
            <span className="text-xs font-medium text-foreground">{r.title}</span>
          </div>
          <p className="text-[11px] text-muted-foreground mt-0.5 truncate">{r.body}</p>
        </button>
      ))}
    </div>
  );
};

export default QuickReplies;
