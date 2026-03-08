import { Send, Paperclip, Smile, Phone, UserCircle, MoreVertical, StickyNote, Reply, X, Loader2, Ban, CheckCircle, Clock, Copy } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import type { ChatConversation, ChatMessage } from '@/hooks/useConversations';
import MessageBubble from './MessageBubble';
import DateSeparator from './DateSeparator';
import QuickReplies from './QuickReplies';
import ChatNotes from './ChatNotes';
import EmojiPicker from './EmojiPicker';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface ChatWindowProps {
  conversation: ChatConversation;
  onToggleContact: () => void;
  module?: string;
  tenantId?: string | null;
  conversationDbId?: string | null;
  onStatusChange?: (dbId: string, status: string) => void;
}

const SUPABASE_PROJECT_ID = import.meta.env.VITE_SUPABASE_PROJECT_ID || 'mhbmxvgcdzhqwpznmgei';

function getDateLabel(dateStr: string): string {
  const d = new Date(dateStr);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return 'اليوم';
  if (d.toDateString() === yesterday.toDateString()) return 'أمس';
  return d.toLocaleDateString('ar-EG', { year: 'numeric', month: 'long', day: 'numeric' });
}

const ChatWindow = ({ conversation, onToggleContact, module = 'confirm', tenantId, conversationDbId, onStatusChange }: ChatWindowProps) => {
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [showQuickReplies, setShowQuickReplies] = useState(false);
  const [quickReplyQuery, setQuickReplyQuery] = useState('');
  const [replyTo, setReplyTo] = useState<ChatMessage | null>(null);
  const [showNotes, setShowNotes] = useState(false);
  const [showEmoji, setShowEmoji] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [attachmentPreview, setAttachmentPreview] = useState<{ url: string; file: File } | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [conversation.messages]);

  const sendToWhatsApp = async (opts: { message?: string; mediaUrl?: string; mediaType?: string; replyToMessageId?: string }) => {
    const res = await fetch(
      `https://${SUPABASE_PROJECT_ID}.supabase.co/functions/v1/send-message`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: conversation.contact.phone,
          message: opts.message || '',
          mediaUrl: opts.mediaUrl || undefined,
          mediaType: opts.mediaType || undefined,
          replyToMessageId: opts.replyToMessageId || undefined,
        }),
      }
    );
    if (!res.ok) throw new Error('Failed to send');
  };

  const handleSend = async () => {
    if (!message.trim() || sending) return;
    setSending(true);
    try {
      await sendToWhatsApp({ message: message.trim(), replyToMessageId: replyTo?.id || undefined });
      setMessage('');
      setReplyTo(null);
      setShowQuickReplies(false);
    } catch (err) {
      toast({ title: '❌ خطأ', description: 'فشل إرسال الرسالة', variant: 'destructive' });
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleMessageChange = (val: string) => {
    setMessage(val);
    if (val.startsWith('/')) {
      setShowQuickReplies(true);
      setQuickReplyQuery(val.slice(1));
    } else {
      setShowQuickReplies(false);
    }
  };

  const handleQuickReplySelect = (text: string) => {
    setMessage(text);
    setShowQuickReplies(false);
    textareaRef.current?.focus();
  };

  const handleReply = useCallback((msg: ChatMessage) => {
    setReplyTo(msg);
    textareaRef.current?.focus();
  }, []);

  const handleEmojiSelect = (emoji: string) => {
    setMessage((prev) => prev + emoji);
    setShowEmoji(false);
    textareaRef.current?.focus();
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const previewUrl = URL.createObjectURL(file);
    setAttachmentPreview({ url: previewUrl, file });
  };

  const uploadAndSendAttachment = async () => {
    if (!attachmentPreview) return;
    setUploading(true);
    try {
      const file = attachmentPreview.file;
      const ext = file.name.split('.').pop();
      const path = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const { error: uploadError } = await supabase.storage.from('chat-attachments').upload(path, file);
      if (uploadError) throw uploadError;
      const { data: { publicUrl } } = supabase.storage.from('chat-attachments').getPublicUrl(path);
      
      await sendToWhatsApp({
        message: message.trim() || undefined,
        mediaUrl: publicUrl,
        mediaType: file.type,
        replyToMessageId: replyTo?.id || undefined,
      });
      
      setMessage('');
      setReplyTo(null);
      setAttachmentPreview(null);
      toast({ title: '✅ تم إرسال المرفق' });
    } catch (err) {
      toast({ title: '❌ خطأ', description: 'فشل رفع الملف', variant: 'destructive' });
    } finally {
      setUploading(false);
    }
  };

  const copyPhone = () => {
    navigator.clipboard.writeText(conversation.contact.phone);
    toast({ title: '📋 تم نسخ الرقم' });
  };

  const handleMarkStatus = (status: string) => {
    if (conversationDbId && onStatusChange) {
      onStatusChange(conversationDbId, status);
      toast({ title: '✅ تم تحديث الحالة' });
    }
  };

  // Group messages by date
  const messagesWithDates: (ChatMessage | { type: 'date'; label: string })[] = [];
  let lastDate = '';
  for (const msg of conversation.messages) {
    const dateKey = msg.rawTimestamp ? new Date(msg.rawTimestamp).toDateString() : '';
    if (dateKey && dateKey !== lastDate) {
      lastDate = dateKey;
      messagesWithDates.push({ type: 'date', label: getDateLabel(msg.rawTimestamp) });
    }
    messagesWithDates.push(msg);
  }

  // Status badge
  const statusConfig: Record<string, { label: string; cssVar: string }> = {
    open: { label: 'مفتوح', cssVar: '--status-active' },
    pending: { label: 'قيد المعالجة', cssVar: '--status-pending' },
    resolved: { label: 'مغلق', cssVar: '--status-resolved' },
  };
  const st = statusConfig[conversation.status] || statusConfig.open;

  return (
    <div className="flex-1 flex h-full min-w-0">
      <div className="flex-1 flex flex-col h-full min-w-0">
        {/* Header */}
        <div className="h-16 border-b border-border flex items-center justify-between px-5 bg-card flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-primary/15 flex items-center justify-center">
              <span className="text-sm font-bold text-primary">{conversation.contact.name.charAt(0)}</span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-sm text-foreground">{conversation.contact.name}</h3>
                <span
                  className="text-[9px] font-medium px-1.5 py-0.5 rounded-full"
                  style={{
                    backgroundColor: `hsl(var(${st.cssVar}) / 0.15)`,
                    color: `hsl(var(${st.cssVar}))`,
                  }}
                >
                  {st.label}
                </span>
              </div>
              <p className="text-xs text-muted-foreground">{conversation.contact.phone}</p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setShowNotes(!showNotes)}
              className={`p-2.5 rounded-lg transition-colors ${showNotes ? 'bg-primary/15 text-primary' : 'hover:bg-secondary text-muted-foreground'}`}
              title="ملاحظات داخلية"
            >
              <StickyNote className="w-4 h-4" />
            </button>
            <button
              onClick={copyPhone}
              className="p-2.5 rounded-lg hover:bg-secondary text-muted-foreground transition-colors"
              title="نسخ رقم الهاتف"
            >
              <Phone className="w-4 h-4" />
            </button>
            <button
              onClick={onToggleContact}
              className="p-2.5 rounded-lg hover:bg-secondary text-muted-foreground transition-colors"
              title="معلومات العميل"
            >
              <UserCircle className="w-4 h-4" />
            </button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="p-2.5 rounded-lg hover:bg-secondary text-muted-foreground transition-colors">
                  <MoreVertical className="w-4 h-4" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem onClick={() => handleMarkStatus('open')} className="gap-2">
                  <CheckCircle className="w-3.5 h-3.5 text-[hsl(var(--status-active))]" />
                  تحديد كمفتوح
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleMarkStatus('pending')} className="gap-2">
                  <Clock className="w-3.5 h-3.5 text-[hsl(var(--status-pending))]" />
                  قيد المعالجة
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleMarkStatus('resolved')} className="gap-2">
                  <Ban className="w-3.5 h-3.5 text-[hsl(var(--status-resolved))]" />
                  إغلاق المحادثة
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={copyPhone} className="gap-2">
                  <Copy className="w-3.5 h-3.5" />
                  نسخ رقم الهاتف
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-5 space-y-3 bg-background">
          {conversation.messages.length === 0 && (
            <div className="flex items-center justify-center h-full text-muted-foreground text-sm">لا توجد رسائل بعد</div>
          )}
          {messagesWithDates.map((item, i) => {
            if ('type' in item && item.type === 'date') {
              return <DateSeparator key={`date-${i}`} date={item.label} />;
            }
            const msg = item as ChatMessage;
            return <MessageBubble key={msg.id} message={msg} onReply={handleReply} allMessages={conversation.messages} />;
          })}
          <div ref={messagesEndRef} />
        </div>

        {/* Reply quote bar */}
        {replyTo && (
          <div className="px-4 py-2 bg-secondary/50 border-t border-border flex items-center gap-3">
            <Reply className="w-4 h-4 text-primary flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-[10px] text-primary font-semibold">{replyTo.sender === 'customer' ? 'العميل' : 'أنت'}</p>
              <p className="text-xs text-muted-foreground truncate">{replyTo.text}</p>
            </div>
            <button onClick={() => setReplyTo(null)} className="p-1 hover:bg-secondary rounded">
              <X className="w-3.5 h-3.5 text-muted-foreground" />
            </button>
          </div>
        )}

        {/* Attachment preview */}
        {attachmentPreview && (
          <div className="px-4 py-2 bg-secondary/50 border-t border-border flex items-center gap-3">
            {attachmentPreview.file.type.startsWith('image') ? (
              <img src={attachmentPreview.url} alt="" className="w-16 h-16 rounded-lg object-cover" />
            ) : (
              <div className="w-16 h-16 rounded-lg bg-secondary flex items-center justify-center">
                <Paperclip className="w-6 h-6 text-muted-foreground" />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-foreground truncate">{attachmentPreview.file.name}</p>
              <p className="text-[10px] text-muted-foreground">{(attachmentPreview.file.size / 1024).toFixed(0)} KB</p>
            </div>
            <button onClick={() => setAttachmentPreview(null)} className="p-1 hover:bg-secondary rounded">
              <X className="w-3.5 h-3.5 text-muted-foreground" />
            </button>
          </div>
        )}

        {/* Input */}
        <div className="p-3 border-t border-border bg-card flex-shrink-0 relative">
          {showEmoji && <EmojiPicker onSelect={handleEmojiSelect} onClose={() => setShowEmoji(false)} />}
          {showQuickReplies && (
            <QuickReplies
              query={quickReplyQuery}
              tenantId={tenantId}
              module={module}
              contactName={conversation.contact.name}
              contactPhone={conversation.contact.phone}
              onSelect={handleQuickReplySelect}
              onClose={() => setShowQuickReplies(false)}
            />
          )}
          <input ref={fileInputRef} type="file" accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx" className="hidden" onChange={handleFileSelect} />
          <div className="flex items-end gap-2">
            <button
              onClick={() => setShowEmoji(!showEmoji)}
              className={`p-2 transition-colors rounded-lg hover:bg-secondary mb-0.5 ${showEmoji ? 'text-primary' : 'text-muted-foreground hover:text-foreground'}`}
            >
              <Smile className="w-5 h-5" />
            </button>
            <button onClick={() => fileInputRef.current?.click()} className="p-2 text-muted-foreground hover:text-foreground transition-colors rounded-lg hover:bg-secondary mb-0.5">
              <Paperclip className="w-5 h-5" />
            </button>
            <Textarea
              ref={textareaRef}
              value={message}
              onChange={(e) => handleMessageChange(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="اكتب رسالة... أو / للردود السريعة"
              className="flex-1 bg-secondary border-0 text-sm min-h-[40px] max-h-[120px] resize-none py-2.5"
              rows={1}
            />
            {attachmentPreview ? (
              <button onClick={uploadAndSendAttachment} disabled={uploading} className="p-2.5 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 transition-all duration-200 disabled:opacity-40 mb-0.5">
                {uploading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
              </button>
            ) : (
              <button onClick={handleSend} disabled={!message.trim() || sending} className="p-2.5 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed mb-0.5">
                <Send className="w-5 h-5" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Notes panel */}
      {showNotes && (
        <div className="w-[280px] border-l border-border bg-card flex-shrink-0">
          <ChatNotes conversationId={conversationDbId || null} onClose={() => setShowNotes(false)} />
        </div>
      )}
    </div>
  );
};

export default ChatWindow;
