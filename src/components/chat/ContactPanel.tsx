import { Mail, Phone, Tag, FileText, X, Save, Edit2 } from 'lucide-react';
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import type { ChatContact as Contact, ConversationLabel } from '@/hooks/useConversations';
import ConversationLabels from './ConversationLabels';

interface ContactPanelProps {
  contact: Contact;
  onClose: () => void;
  conversationDbId?: string | null;
  tenantId?: string | null;
  conversationStatus?: string;
  labels?: ConversationLabel[];
  onContactUpdate?: () => void;
  onStatusChange?: (dbId: string, status: string) => void;
}

const ContactPanel = ({
  contact, onClose, conversationDbId, tenantId,
  conversationStatus = 'open', labels = [],
  onContactUpdate, onStatusChange,
}: ContactPanelProps) => {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(contact.name);
  const [email, setEmail] = useState(contact.email || '');
  const [notes, setNotes] = useState(contact.notes || '');
  const [newTag, setNewTag] = useState('');
  const [tags, setTags] = useState<string[]>(contact.tags);
  const [saving, setSaving] = useState(false);
  const [currentStatus, setCurrentStatus] = useState(conversationStatus);
  const { toast } = useToast();

  // Sync with parent
  useEffect(() => {
    setName(contact.name);
    setEmail(contact.email || '');
    setNotes(contact.notes || '');
    setTags(contact.tags);
  }, [contact]);

  useEffect(() => {
    setCurrentStatus(conversationStatus);
  }, [conversationStatus]);

  const handleSave = async () => {
    setSaving(true);
    const { error } = await supabase
      .from('contacts')
      .update({ name, email: email || null, notes: notes || null, tags })
      .eq('id', contact.id);
    
    if (error) {
      toast({ title: '❌ خطأ', description: 'فشل حفظ البيانات', variant: 'destructive' });
    } else {
      toast({ title: '✅ تم الحفظ' });
      setEditing(false);
      onContactUpdate?.();
    }
    setSaving(false);
  };

  const handleStatusChange = (status: string) => {
    if (!conversationDbId) {
      toast({ title: '⚠️', description: 'لا يمكن تغيير الحالة - لا توجد محادثة مسجلة' });
      return;
    }
    setCurrentStatus(status);
    onStatusChange?.(conversationDbId, status);
    toast({ title: '✅ تم تحديث الحالة' });
  };

  const addTag = () => {
    if (newTag.trim() && !tags.includes(newTag.trim())) {
      setTags([...tags, newTag.trim()]);
      setNewTag('');
    }
  };

  const removeTag = (tag: string) => {
    setTags(tags.filter((t) => t !== tag));
  };

  const statusOptions = [
    { value: 'open', label: 'مفتوح', cssVar: '--status-active' },
    { value: 'pending', label: 'قيد المعالجة', cssVar: '--status-pending' },
    { value: 'resolved', label: 'مغلق', cssVar: '--status-resolved' },
  ];

  return (
    <div className="w-[300px] h-full border-l border-border bg-card flex-shrink-0 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-border flex items-center justify-between">
        <h3 className="font-semibold text-sm text-foreground">معلومات العميل</h3>
        <div className="flex items-center gap-1">
          <button
            onClick={() => editing ? handleSave() : setEditing(true)}
            disabled={saving}
            className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground transition-colors"
          >
            {editing ? <Save className="w-4 h-4 text-primary" /> : <Edit2 className="w-4 h-4" />}
          </button>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Profile */}
      <div className="p-6 text-center border-b border-border">
        <div className="w-20 h-20 rounded-full bg-primary/15 flex items-center justify-center mx-auto mb-3">
          <span className="text-3xl font-bold text-primary">{contact.name.charAt(0)}</span>
        </div>
        {editing ? (
          <Input value={name} onChange={(e) => setName(e.target.value)} className="text-center font-bold text-lg h-9" />
        ) : (
          <h3 className="font-bold text-foreground text-lg">{contact.name}</h3>
        )}
        <p className="text-sm text-muted-foreground mt-1">{contact.phone}</p>
      </div>

      {/* Details */}
      <div className="flex-1 overflow-y-auto p-4 space-y-5">
        {/* Phone */}
        <div className="flex items-start gap-3">
          <Phone className="w-4 h-4 text-muted-foreground mt-0.5" />
          <div>
            <p className="text-xs text-muted-foreground font-medium">رقم الهاتف</p>
            <p className="text-sm text-foreground" dir="ltr">{contact.phone}</p>
          </div>
        </div>

        {/* Email */}
        <div className="flex items-start gap-3">
          <Mail className="w-4 h-4 text-muted-foreground mt-0.5" />
          <div className="flex-1">
            <p className="text-xs text-muted-foreground font-medium">البريد الإلكتروني</p>
            {editing ? (
              <Input value={email} onChange={(e) => setEmail(e.target.value)} className="text-sm h-8 mt-1" placeholder="email@example.com" />
            ) : (
              <p className="text-sm text-foreground">{contact.email || '—'}</p>
            )}
          </div>
        </div>

        {/* Tags */}
        <div className="flex items-start gap-3">
          <Tag className="w-4 h-4 text-muted-foreground mt-0.5" />
          <div className="flex-1">
            <p className="text-xs text-muted-foreground font-medium mb-1.5">التصنيفات</p>
            <div className="flex flex-wrap gap-1.5">
              {tags.map((tag) => (
                <span key={tag} className="px-2.5 py-0.5 rounded-full bg-primary/10 text-primary text-xs font-medium flex items-center gap-1">
                  {tag}
                  {editing && <button onClick={() => removeTag(tag)}><X className="w-3 h-3" /></button>}
                </span>
              ))}
            </div>
            {editing && (
              <div className="flex gap-1 mt-2">
                <Input value={newTag} onChange={(e) => setNewTag(e.target.value)} placeholder="تصنيف جديد" className="text-xs h-7 flex-1" onKeyDown={(e) => e.key === 'Enter' && addTag()} />
                <Button size="sm" variant="secondary" onClick={addTag} className="h-7 text-xs px-2">+</Button>
              </div>
            )}
          </div>
        </div>

        {/* Conversation Labels */}
        <ConversationLabels
          conversationId={conversationDbId || null}
          tenantId={tenantId}
          initialLabels={labels}
          onLabelsChange={() => onContactUpdate?.()}
        />

        {/* Notes */}
        <div className="flex items-start gap-3">
          <FileText className="w-4 h-4 text-muted-foreground mt-0.5" />
          <div className="flex-1">
            <p className="text-xs text-muted-foreground font-medium mb-1.5">ملاحظات</p>
            {editing ? (
              <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} className="text-sm min-h-[60px]" placeholder="أضف ملاحظات..." />
            ) : (
              <p className="text-sm text-foreground bg-secondary p-3 rounded-lg leading-relaxed">
                {contact.notes || 'لا توجد ملاحظات'}
              </p>
            )}
          </div>
        </div>

        {/* Conversation Status section has been removed as per user request */}
      </div>
    </div>
  );
};

export default ContactPanel;
