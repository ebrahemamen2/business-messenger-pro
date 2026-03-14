import { Send, Paperclip, Smile, Phone, UserCircle, MoreVertical, StickyNote, Reply, X, Loader2, Ban, CheckCircle, Clock, Copy, Search, AlertTriangle, Timer, Pin, Archive, UserCheck, Upload } from 'lucide-react';
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
import VoiceRecorder from './VoiceRecorder';
import MessageSearch from './MessageSearch';
import ScrollToBottom from './ScrollToBottom';
import ForwardModal from './ForwardModal';
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
  onLoadOlder?: (phone: string) => Promise<boolean>;
  hideHeader?: boolean;
  allConversations?: ChatConversation[];
  onTogglePin?: (dbId: string, currentlyPinned: boolean) => void;
  onToggleArchive?: (dbId: string, currentlyArchived: boolean) => void;
  onAssign?: (dbId: string, userId: string | null) => void;
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

const ChatWindow = ({ conversation, onToggleContact, module = 'confirm', tenantId, conversationDbId, onStatusChange, onLoadOlder, hideHeader, allConversations = [], onTogglePin, onToggleArchive, onAssign }: ChatWindowProps) => {
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [showQuickReplies, setShowQuickReplies] = useState(false);
  const [quickReplyQuery, setQuickReplyQuery] = useState('');
  const [replyTo, setReplyTo] = useState<ChatMessage | null>(null);
  const [showNotes, setShowNotes] = useState(false);
  const [showEmoji, setShowEmoji] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [attachmentPreviews, setAttachmentPreviews] = useState<{ url: string; file: File }[]>([]);
  const [optimisticMessages, setOptimisticMessages] = useState<ChatMessage[]>([]);
  const [highlightedMsgId, setHighlightedMsgId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showScrollBtn, setShowScrollBtn] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [hasOlder, setHasOlder] = useState(true);
  const [reactions, setReactions] = useState<Record<string, Record<string, number>>>({});
  const [isDragging, setIsDragging] = useState(false);
  const [forwardMessage, setForwardMessage] = useState<ChatMessage | null>(null);
  const [teamMembers, setTeamMembers] = useState<{ id: string; name: string }[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dragCounterRef = useRef(0);
  const conversationIdRef = useRef(conversation.id);
  conversationIdRef.current = conversation.id;
  const [windowExpired, setWindowExpired] = useState(false);
  const [windowRemainingText, setWindowRemainingText] = useState<string | null>(null);
  const { toast } = useToast();

  const allMessages = [
    ...conversation.messages,
    ...optimisticMessages.filter((om) => !conversation.messages.some((m) => m.text === om.text && m.sender === 'agent' && m.rawTimestamp >= om.rawTimestamp)),
  ];

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [allMessages.length]);

  useEffect(() => {
    if (conversation.messages.length > 0) {
      setOptimisticMessages((prev) =>
        prev.filter((om) => !conversation.messages.some((m) => m.text === om.text && m.sender === 'agent'))
      );
    }
  }, [conversation.messages]);

  // Show/hide scroll-to-bottom button
  useEffect(() => {
    const el = messagesContainerRef.current;
    if (!el) return;
    const handleScroll = () => {
      const distFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
      setShowScrollBtn(distFromBottom > 200);
    };
    el.addEventListener('scroll', handleScroll);
    return () => el.removeEventListener('scroll', handleScroll);
  }, []);

  // 24-hour window check
  useEffect(() => {
    const check24hWindow = () => {
      const lastAt = conversation.lastCustomerMessageAt;
      if (!lastAt) {
        setWindowExpired(false);
        setWindowRemainingText(null);
        return;
      }
      const diff = Date.now() - new Date(lastAt).getTime();
      const twentyFourH = 24 * 60 * 60 * 1000;
      if (diff > twentyFourH) {
        setWindowExpired(true);
        setWindowRemainingText(null);
      } else {
        setWindowExpired(false);
        const remaining = twentyFourH - diff;
        const hours = Math.floor(remaining / (60 * 60 * 1000));
        const minutes = Math.floor((remaining % (60 * 60 * 1000)) / (60 * 1000));
        if (hours < 1) {
          setWindowRemainingText(`⏰ متبقي ${minutes} دقيقة للرد`);
        } else if (hours < 3) {
          setWindowRemainingText(`⏰ متبقي ${hours} ساعة و ${minutes} دقيقة للرد`);
        } else {
          setWindowRemainingText(null);
        }
      }
    };
    check24hWindow();
    const timer = setInterval(check24hWindow, 60000);
    return () => clearInterval(timer);
  }, [conversation.lastCustomerMessageAt, conversation.id]);

  // Load reactions for current conversation messages
  const loadReactions = useCallback(async (messageIds: string[]) => {
    if (messageIds.length === 0) return;
    const { data } = await supabase
      .from('message_reactions')
      .select('message_id, emoji')
      .in('message_id', messageIds);
    if (!data) return;
    const map: Record<string, Record<string, number>> = {};
    for (const r of data) {
      if (!map[r.message_id]) map[r.message_id] = {};
      map[r.message_id][r.emoji] = (map[r.message_id][r.emoji] || 0) + 1;
    }
    setReactions(map);
  }, []);

  useEffect(() => {
    const ids = allMessages.filter(m => !m.id.startsWith('optimistic')).map(m => m.id);
    if (ids.length > 0) loadReactions(ids);
  }, [allMessages.length]);

  const handleReact = useCallback(async (messageId: string, emoji: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: existing } = await supabase
      .from('message_reactions')
      .select('id')
      .eq('message_id', messageId)
      .eq('emoji', emoji)
      .eq('user_id', user.id)
      .maybeSingle();

    if (existing) {
      await supabase.from('message_reactions').delete().eq('id', existing.id);
    } else {
      await supabase.from('message_reactions').insert({
        message_id: messageId,
        emoji,
        user_id: user.id,
        tenant_id: tenantId || undefined,
      });
    }

    setReactions(prev => {
      const updated = { ...prev };
      if (!updated[messageId]) updated[messageId] = {};
      const current = updated[messageId][emoji] || 0;
      if (existing) {
        if (current <= 1) {
          delete updated[messageId][emoji];
        } else {
          updated[messageId] = { ...updated[messageId], [emoji]: current - 1 };
        }
      } else {
        updated[messageId] = { ...updated[messageId], [emoji]: current + 1 };
      }
      return updated;
    });
  }, [tenantId]);

  // Load team members for assignment
  useEffect(() => {
    if (!tenantId) return;
    const loadMembers = async () => {
      const { data: members } = await supabase
        .from('tenant_members')
        .select('user_id')
        .eq('tenant_id', tenantId);
      if (!members || members.length === 0) return;
      const userIds = members.map(m => m.user_id);
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name')
        .in('id', userIds);
      if (profiles) {
        setTeamMembers(profiles.map(p => ({ id: p.id, name: p.full_name || 'موظف' })));
      }
    };
    loadMembers();
  }, [tenantId]);

  // Reset state on conversation change
  useEffect(() => {
    setHasOlder(true);
    setShowSearch(false);
    setHighlightedMsgId(null);
    setSearchQuery('');
    setReplyTo(null);
    setMessage('');
    setOptimisticMessages([]);
    setReactions({});
    setForwardMessage(null);
    setAttachmentPreviews((prev) => {
      prev.forEach(p => URL.revokeObjectURL(p.url));
      return [];
    });
  }, [conversation.id]);

  const sendToWhatsApp = useCallback(async (opts: { message?: string; mediaUrl?: string; mediaType?: string; replyToMessageId?: string; targetPhone?: string }) => {
    // Capture current values at call time to prevent race conditions
    const targetPhone = opts.targetPhone || conversation.contact.phone;
    const currentTenantId = tenantId;
    const currentModule = module;
    const currentConvDbId = conversationDbId;

    const res = await fetch(
      `https://${SUPABASE_PROJECT_ID}.supabase.co/functions/v1/send-message`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: targetPhone,
          message: opts.message || '',
          mediaUrl: opts.mediaUrl || undefined,
          mediaType: opts.mediaType || undefined,
          replyToMessageId: opts.replyToMessageId || undefined,
          tenantId: currentTenantId || undefined,
          module: currentModule,
          conversationId: currentConvDbId || undefined,
        }),
      }
    );

    const payload = await res.json().catch(() => null);
    if (!res.ok) {
      const details = payload?.details?.error_data?.details || payload?.details?.message || payload?.error || 'Failed to send';
      throw new Error(details);
    }
  }, [conversation.contact.phone, tenantId, module, conversationDbId]);

  const handleSend = async () => {
    if (!message.trim() || sending) return;
    const text = message.trim();
    const replyId = replyTo?.id || undefined;
    setSending(true);
    setMessage('');
    setReplyTo(null);
    setShowQuickReplies(false);
    if (textareaRef.current) textareaRef.current.style.height = '40px';

    const sendConversationId = conversation.id;
    const optimisticMsg: ChatMessage = {
      id: `optimistic-${Date.now()}`,
      text,
      timestamp: new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }),
      rawTimestamp: new Date().toISOString(),
      sender: 'agent',
      status: 'sending',
      replyToId: replyId,
    };
    setOptimisticMessages((prev) => [...prev, optimisticMsg]);

    try {
      await sendToWhatsApp({ message: text, replyToMessageId: replyId });
    } catch (err) {
      toast({ title: '❌ خطأ', description: err instanceof Error ? err.message : 'فشل إرسال الرسالة', variant: 'destructive' });
      if (conversationIdRef.current === sendConversationId) {
        setOptimisticMessages((prev) => prev.filter((m) => m.id !== optimisticMsg.id));
        setMessage(text);
      }
    } finally {
      setSending(false);
    }
  };

  const handleRetry = useCallback(async (msg: ChatMessage) => {
    try {
      await sendToWhatsApp({
        message: msg.text || '',
        mediaUrl: msg.mediaUrl || undefined,
        mediaType: msg.mediaType || undefined,
        replyToMessageId: msg.replyToId || undefined,
      });
      // Update DB message status
      if (!msg.id.startsWith('optimistic')) {
        await supabase.from('messages').update({ status: 'sent' }).eq('id', msg.id);
      }
      toast({ title: '✅ تم إعادة الإرسال' });
    } catch (err) {
      toast({ title: '❌ فشل إعادة الإرسال', description: err instanceof Error ? err.message : '', variant: 'destructive' });
    }
  }, [conversation.contact.phone, tenantId, module, conversationDbId]);

  const handleForward = useCallback((msg: ChatMessage) => {
    setForwardMessage(msg);
  }, []);

  const handleForwardSend = useCallback(async (targetPhone: string, msg: ChatMessage) => {
    try {
      await sendToWhatsApp({
        message: msg.text || '',
        mediaUrl: msg.mediaUrl || undefined,
        mediaType: msg.mediaType || undefined,
        targetPhone,
      });
      toast({ title: '✅ تم إعادة التوجيه' });
      setForwardMessage(null);
    } catch (err) {
      toast({ title: '❌ فشل إعادة التوجيه', description: err instanceof Error ? err.message : '', variant: 'destructive' });
    }
  }, [tenantId, module, conversationDbId]);

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
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const newPreviews = Array.from(files).map(file => ({
      url: URL.createObjectURL(file),
      file,
    }));
    setAttachmentPreviews(prev => [...prev, ...newPreviews]);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const addFilesFromDrop = (files: FileList) => {
    const newPreviews = Array.from(files).map(file => ({
      url: URL.createObjectURL(file),
      file,
    }));
    setAttachmentPreviews(prev => [...prev, ...newPreviews]);
  };

  // Drag & Drop handlers
  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current++;
    if (e.dataTransfer.types.includes('Files')) {
      setIsDragging(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current--;
    if (dragCounterRef.current === 0) {
      setIsDragging(false);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current = 0;
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0 && !windowExpired) {
      addFilesFromDrop(e.dataTransfer.files);
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items || windowExpired) return;
    const mediaFiles: File[] = [];
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.kind === 'file' && (item.type.startsWith('image/') || item.type.startsWith('video/'))) {
        const file = item.getAsFile();
        if (file) mediaFiles.push(file);
      }
    }
    if (mediaFiles.length > 0) {
      e.preventDefault();
      const newPreviews = mediaFiles.map(file => ({
        url: URL.createObjectURL(file),
        file,
      }));
      setAttachmentPreviews(prev => [...prev, ...newPreviews]);
    }
  };

  const uploadAndSendFiles = async (files: { url: string; file: File }[], caption?: string) => {
    setUploading(true);
    try {
      for (let i = 0; i < files.length; i++) {
        const { file, url } = files[i];
        const ext = file.name.split('.').pop();
        const path = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
        const { error: uploadError } = await supabase.storage.from('chat-attachments').upload(path, file, {
          contentType: file.type || undefined,
          upsert: false,
        });
        if (uploadError) throw uploadError;
        const { data: { publicUrl } } = supabase.storage.from('chat-attachments').getPublicUrl(path);

        await sendToWhatsApp({
          message: i === 0 ? (caption || undefined) : undefined,
          mediaUrl: publicUrl,
          mediaType: file.type,
          replyToMessageId: i === 0 ? (replyTo?.id || undefined) : undefined,
        });

        URL.revokeObjectURL(url);
      }

      setMessage('');
      setReplyTo(null);
      setAttachmentPreviews([]);
      toast({ title: `✅ تم إرسال ${files.length > 1 ? files.length + ' ملفات' : 'الملف'}` });
    } catch (err) {
      toast({ title: '❌ خطأ', description: err instanceof Error ? err.message : 'فشل رفع الملف', variant: 'destructive' });
    } finally {
      setUploading(false);
    }
  };

  const handleVoiceRecordComplete = async (file: File) => {
    setUploading(true);
    try {
      const ext = file.name.split('.').pop() || 'ogg';
      const path = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const { error: uploadError } = await supabase.storage.from('chat-attachments').upload(path, file, {
        contentType: file.type || 'audio/ogg',
        upsert: false,
      });
      if (uploadError) throw uploadError;
      const { data: { publicUrl } } = supabase.storage.from('chat-attachments').getPublicUrl(path);

      await sendToWhatsApp({
        message: '[رسالة صوتية]',
        mediaUrl: publicUrl,
        mediaType: file.type || 'audio/ogg',
        replyToMessageId: replyTo?.id || undefined,
      });

      if (conversationIdRef.current === conversation.id) {
        const optimisticMsg: ChatMessage = {
          id: `optimistic-${Date.now()}`,
          text: '[رسالة صوتية]',
          timestamp: new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }),
          rawTimestamp: new Date().toISOString(),
          sender: 'agent' as const,
          status: 'sent',
          mediaType: file.type || 'audio/ogg',
          mediaUrl: publicUrl,
        };
        setOptimisticMessages(prev => [...prev, optimisticMsg]);
        setReplyTo(null);
      }

      toast({ title: '✅ تم إرسال الرسالة الصوتية' });
    } catch (err) {
      toast({ title: '❌ خطأ', description: err instanceof Error ? err.message : 'فشل إرسال الفويس', variant: 'destructive' });
    } finally {
      setUploading(false);
    }
  };

  const handleVoiceRecordError = (errorMessage: string) => {
    toast({ title: '❌ خطأ في تسجيل الفويس', description: errorMessage, variant: 'destructive' });
  };

  const searchQueryRef = useRef('');
  const handleSearchHighlight = useCallback((msgId: string | null, _idx: number, _total: number) => {
    setHighlightedMsgId(msgId);
    if (msgId) {
      setTimeout(() => {
        document.getElementById(`msg-${msgId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 50);
    }
  }, []);

  const handleSearchQueryChange = useCallback((q: string) => {
    setSearchQuery(q);
  }, []);

  const handleLoadOlder = async () => {
    if (!onLoadOlder || loadingOlder) return;
    setLoadingOlder(true);
    const el = messagesContainerRef.current;
    const prevHeight = el?.scrollHeight || 0;
    const hasMore = await onLoadOlder(conversation.contact.phone);
    setHasOlder(hasMore);
    requestAnimationFrame(() => {
      if (el) el.scrollTop = el.scrollHeight - prevHeight;
    });
    setLoadingOlder(false);
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

  const isPinned = !!(conversation as any).pinnedAt;
  const isArchived = !!(conversation as any).archivedAt;

  // Group messages by date
  const messagesWithDates: (ChatMessage | { type: 'date'; label: string })[] = [];
  let lastDate = '';
  for (const msg of allMessages) {
    const dateKey = msg.rawTimestamp ? new Date(msg.rawTimestamp).toDateString() : '';
    if (dateKey && dateKey !== lastDate) {
      lastDate = dateKey;
      messagesWithDates.push({ type: 'date', label: getDateLabel(msg.rawTimestamp) });
    }
    messagesWithDates.push(msg);
  }

  const statusConfig: Record<string, { label: string; cssVar: string }> = {
    open: { label: 'مفتوح', cssVar: '--status-active' },
    pending: { label: 'قيد المعالجة', cssVar: '--status-pending' },
    resolved: { label: 'مغلق', cssVar: '--status-resolved' },
  };
  const st = statusConfig[conversation.status] || statusConfig.open;

  return (
    <div className="flex-1 flex h-full min-w-0">
      <div
        className="flex-1 flex flex-col h-full min-w-0 relative"
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
      >
        {/* Drag overlay */}
        {isDragging && (
          <div className="absolute inset-0 z-40 bg-primary/10 backdrop-blur-sm border-2 border-dashed border-primary rounded-lg flex items-center justify-center pointer-events-none">
            <div className="flex flex-col items-center gap-3 text-primary">
              <Upload className="w-12 h-12" />
              <span className="text-lg font-semibold">أفلت الملفات هنا</span>
            </div>
          </div>
        )}

        {/* Header - conditionally hidden on mobile */}
        {!hideHeader && (
          <div className="h-14 sm:h-16 border-b border-border flex items-center justify-between px-3 sm:px-5 bg-card flex-shrink-0">
            <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
              <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-primary/15 flex items-center justify-center flex-shrink-0">
                <span className="text-xs sm:text-sm font-bold text-primary">{conversation.contact.name.charAt(0)}</span>
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 sm:gap-2">
                  {isPinned && <Pin className="w-3 h-3 text-primary rotate-45 flex-shrink-0" />}
                  <h3 className="font-semibold text-xs sm:text-sm text-foreground truncate">{conversation.contact.name}</h3>
                  <span
                    className="text-[8px] sm:text-[9px] font-medium px-1 sm:px-1.5 py-0.5 rounded-full flex-shrink-0 hidden sm:inline"
                    style={{
                      backgroundColor: `hsl(var(${st.cssVar}) / 0.15)`,
                      color: `hsl(var(${st.cssVar}))`,
                    }}
                  >
                    {st.label}
                  </span>
                </div>
                <p className="text-[10px] sm:text-xs text-muted-foreground truncate">{conversation.contact.phone}</p>
              </div>
            </div>
            <div className="flex items-center gap-0.5 sm:gap-1 flex-shrink-0">
              <button
                onClick={() => setShowSearch(!showSearch)}
                className={`p-2 sm:p-2.5 rounded-lg transition-colors ${showSearch ? 'bg-primary/15 text-primary' : 'hover:bg-secondary text-muted-foreground'}`}
                title="بحث في الرسائل"
              >
                <Search className="w-4 h-4" />
              </button>
              <button
                onClick={() => setShowNotes(!showNotes)}
                className={`p-2 sm:p-2.5 rounded-lg transition-colors hidden sm:flex ${showNotes ? 'bg-primary/15 text-primary' : 'hover:bg-secondary text-muted-foreground'}`}
                title="ملاحظات داخلية"
              >
                <StickyNote className="w-4 h-4" />
              </button>
              <button onClick={copyPhone} className="p-2 sm:p-2.5 rounded-lg hover:bg-secondary text-muted-foreground transition-colors hidden sm:flex" title="نسخ رقم الهاتف">
                <Phone className="w-4 h-4" />
              </button>
              <button onClick={onToggleContact} className="p-2 sm:p-2.5 rounded-lg hover:bg-secondary text-muted-foreground transition-colors" title="معلومات العميل">
                <UserCircle className="w-4 h-4" />
              </button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="p-2 sm:p-2.5 rounded-lg hover:bg-secondary text-muted-foreground transition-colors">
                    <MoreVertical className="w-4 h-4" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-52">
                  <DropdownMenuItem onClick={() => setShowNotes(!showNotes)} className="gap-2 sm:hidden">
                    <StickyNote className="w-3.5 h-3.5" /> الملاحظات
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={copyPhone} className="gap-2 sm:hidden">
                    <Copy className="w-3.5 h-3.5" /> نسخ رقم الهاتف
                  </DropdownMenuItem>
                  <DropdownMenuSeparator className="sm:hidden" />
                  <DropdownMenuItem onClick={() => handleMarkStatus('open')} className="gap-2">
                    <CheckCircle className="w-3.5 h-3.5 text-[hsl(var(--status-active))]" /> تحديد كمفتوح
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleMarkStatus('pending')} className="gap-2">
                    <Clock className="w-3.5 h-3.5 text-[hsl(var(--status-pending))]" /> قيد المعالجة
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleMarkStatus('resolved')} className="gap-2">
                    <Ban className="w-3.5 h-3.5 text-[hsl(var(--status-resolved))]" /> إغلاق المحادثة
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  {onTogglePin && conversationDbId && (
                    <DropdownMenuItem onClick={() => onTogglePin(conversationDbId, isPinned)} className="gap-2">
                      <Pin className={`w-3.5 h-3.5 ${isPinned ? 'text-primary' : ''}`} />
                      {isPinned ? 'إلغاء التثبيت' : 'تثبيت المحادثة'}
                    </DropdownMenuItem>
                  )}
                  {onToggleArchive && conversationDbId && (
                    <DropdownMenuItem onClick={() => onToggleArchive(conversationDbId, isArchived)} className="gap-2">
                      <Archive className={`w-3.5 h-3.5 ${isArchived ? 'text-primary' : ''}`} />
                      {isArchived ? 'إلغاء الأرشفة' : 'أرشفة المحادثة'}
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuSeparator />
                  {onAssign && conversationDbId && teamMembers.length > 0 && (
                    <>
                      {conversation.assignedTo && (
                        <DropdownMenuItem onClick={() => onAssign(conversationDbId, null)} className="gap-2">
                          <UserCheck className="w-3.5 h-3.5 text-destructive" /> إلغاء التعيين
                        </DropdownMenuItem>
                      )}
                      {teamMembers.map(member => (
                        <DropdownMenuItem
                          key={member.id}
                          onClick={() => onAssign(conversationDbId, member.id)}
                          className={`gap-2 ${conversation.assignedTo === member.id ? 'bg-primary/10' : ''}`}
                        >
                          <UserCheck className={`w-3.5 h-3.5 ${conversation.assignedTo === member.id ? 'text-primary' : ''}`} />
                          تعيين لـ {member.name}
                        </DropdownMenuItem>
                      ))}
                    </>
                  )}
                  <DropdownMenuSeparator className="hidden sm:block" />
                  <DropdownMenuItem onClick={copyPhone} className="gap-2 hidden sm:flex">
                    <Copy className="w-3.5 h-3.5" /> نسخ رقم الهاتف
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        )}

        {/* Search bar */}
        {showSearch && (
          <div className="message-search-input">
            <MessageSearch
              messages={allMessages}
              onClose={() => { setShowSearch(false); setHighlightedMsgId(null); setSearchQuery(''); }}
              onHighlight={handleSearchHighlight}
              onQueryChange={handleSearchQueryChange}
            />
          </div>
        )}

        {/* Messages */}
        <div ref={messagesContainerRef} className="flex-1 overflow-y-auto p-4 space-y-1 bg-background chat-messages relative">
          {/* Load older */}
          {hasOlder && onLoadOlder && allMessages.length >= 100 && (
            <div className="text-center py-2">
              <button
                onClick={handleLoadOlder}
                disabled={loadingOlder}
                className="text-xs text-primary hover:underline disabled:opacity-50"
              >
                {loadingOlder ? <Loader2 className="w-4 h-4 animate-spin inline" /> : 'تحميل رسائل أقدم'}
              </button>
            </div>
          )}

          {allMessages.length === 0 && optimisticMessages.length === 0 && (
            <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
              {conversation.messages.length === 0 ? (
                <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
              ) : 'لا توجد رسائل بعد'}
            </div>
          )}
          {messagesWithDates.map((item, i) => {
            if ('type' in item && item.type === 'date') {
              return <DateSeparator key={`date-${i}`} date={item.label} />;
            }
            const msg = item as ChatMessage;
            return (
              <MessageBubble
                key={msg.id}
                message={msg}
                onReply={handleReply}
                onReact={handleReact}
                onRetry={handleRetry}
                onForward={handleForward}
                allMessages={allMessages}
                highlight={searchQuery}
                isHighlighted={msg.id === highlightedMsgId}
                reactions={reactions[msg.id] || {}}
              />
            );
          })}
          <div ref={messagesEndRef} />

          {/* Scroll to bottom */}
          {showScrollBtn && <ScrollToBottom onClick={scrollToBottom} />}
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

        {/* Attachment previews (multiple) */}
        {attachmentPreviews.length > 0 && (
          <div className="px-4 py-2 bg-secondary/50 border-t border-border">
            <div className="flex items-center gap-2 overflow-x-auto pb-1">
              {attachmentPreviews.map((ap, idx) => (
                <div key={idx} className="relative flex-shrink-0 group/att">
                  {ap.file.type.startsWith('image') ? (
                    <img src={ap.url} alt="" className="w-16 h-16 rounded-lg object-cover" />
                  ) : (
                    <div className="w-16 h-16 rounded-lg bg-secondary flex items-center justify-center">
                      <Paperclip className="w-6 h-6 text-muted-foreground" />
                    </div>
                  )}
                  <button
                    onClick={() => {
                      URL.revokeObjectURL(ap.url);
                      setAttachmentPreviews(prev => prev.filter((_, i) => i !== idx));
                    }}
                    className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center opacity-0 group-hover/att:opacity-100 transition-opacity"
                  >
                    <X className="w-3 h-3" />
                  </button>
                  <p className="text-[9px] text-muted-foreground truncate w-16 text-center mt-0.5">{ap.file.name}</p>
                </div>
              ))}
              <button
                onClick={() => fileInputRef.current?.click()}
                className="w-16 h-16 rounded-lg border-2 border-dashed border-muted-foreground/30 flex items-center justify-center hover:border-primary/50 transition-colors flex-shrink-0"
              >
                <Paperclip className="w-5 h-5 text-muted-foreground/50" />
              </button>
            </div>
          </div>
        )}

        {/* 24h window warning */}
        {windowExpired && (
          <div className="px-4 py-3 bg-destructive/10 border-t border-destructive/20 flex items-center gap-3 text-sm">
            <AlertTriangle className="w-5 h-5 text-destructive flex-shrink-0" />
            <p className="text-destructive font-medium">
              ⚠️ انتهت نافذة الـ 24 ساعة - لا يمكن الرد على هذه المحادثة حالياً. يجب أن يرسل العميل رسالة جديدة أولاً.
            </p>
          </div>
        )}
        {!windowExpired && windowRemainingText && (
          <div className="px-4 py-2 bg-[hsl(var(--status-pending)/0.1)] border-t border-[hsl(var(--status-pending)/0.2)] flex items-center gap-2 text-xs">
            <Timer className="w-4 h-4 text-[hsl(var(--status-pending))] flex-shrink-0" />
            <p className="text-[hsl(var(--status-pending))] font-medium">{windowRemainingText}</p>
          </div>
        )}

        {/* Input */}
        <div className="p-3 border-t border-border bg-card flex-shrink-0 relative">
          {showEmoji && !windowExpired && <EmojiPicker onSelect={handleEmojiSelect} onClose={() => setShowEmoji(false)} />}
          {showQuickReplies && !windowExpired && (
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
          <input ref={fileInputRef} type="file" accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx" className="hidden" onChange={handleFileSelect} multiple />
          <div className="flex items-end gap-2">
            <button
              onClick={() => !windowExpired && setShowEmoji(!showEmoji)}
              disabled={windowExpired}
              className={`p-2 transition-colors rounded-lg hover:bg-secondary mb-0.5 ${showEmoji ? 'text-primary' : 'text-muted-foreground hover:text-foreground'} ${windowExpired ? 'opacity-40 cursor-not-allowed' : ''}`}
            >
              <Smile className="w-5 h-5" />
            </button>
            <button
              onClick={() => !windowExpired && fileInputRef.current?.click()}
              disabled={windowExpired}
              className={`p-2 text-muted-foreground hover:text-foreground transition-colors rounded-lg hover:bg-secondary mb-0.5 ${windowExpired ? 'opacity-40 cursor-not-allowed' : ''}`}
            >
              <Paperclip className="w-5 h-5" />
            </button>
            <Textarea
              ref={textareaRef}
              value={message}
              onChange={(e) => {
                handleMessageChange(e.target.value);
                const el = e.target;
                el.style.height = 'auto';
                el.style.height = Math.min(el.scrollHeight, 160) + 'px';
              }}
              onKeyDown={handleKeyDown}
              onPaste={handlePaste}
              placeholder={windowExpired ? "انتهت نافذة الـ 24 ساعة..." : "اكتب رسالة... أو / للردود السريعة"}
              className="flex-1 bg-secondary border-0 text-sm min-h-[40px] max-h-[160px] resize-none py-2.5 overflow-y-auto"
              rows={1}
              style={{ height: '40px' }}
              disabled={windowExpired}
            />
            {windowExpired ? (
              <div className="p-2.5 rounded-xl bg-muted text-muted-foreground mb-0.5 cursor-not-allowed">
                <Ban className="w-5 h-5" />
              </div>
            ) : attachmentPreviews.length > 0 ? (
              <button onClick={() => uploadAndSendFiles(attachmentPreviews, message.trim())} disabled={uploading} className="p-2.5 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 transition-all duration-200 disabled:opacity-40 mb-0.5">
                {uploading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
              </button>
            ) : message.trim() ? (
              <button onClick={handleSend} disabled={sending} className="p-2.5 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed mb-0.5">
                <Send className="w-5 h-5" />
              </button>
            ) : (
              <VoiceRecorder onRecordComplete={handleVoiceRecordComplete} onError={handleVoiceRecordError} disabled={uploading || windowExpired} />
            )}
          </div>
        </div>
      </div>

      {/* Notes panel - Sheet on mobile, side panel on desktop */}
      {showNotes && (
        <>
          <div className="hidden sm:block w-[280px] border-l border-border bg-card flex-shrink-0">
            <ChatNotes conversationId={conversationDbId || null} onClose={() => setShowNotes(false)} />
          </div>
          <div className="sm:hidden fixed inset-0 z-50 bg-background/80 backdrop-blur-sm" onClick={() => setShowNotes(false)}>
            <div className="absolute left-0 top-0 bottom-0 w-[280px] bg-card border-r border-border shadow-xl" onClick={(e) => e.stopPropagation()}>
              <ChatNotes conversationId={conversationDbId || null} onClose={() => setShowNotes(false)} />
            </div>
          </div>
        </>
      )}

      {/* Forward modal */}
      {forwardMessage && (
        <ForwardModal
          message={forwardMessage}
          conversations={allConversations}
          currentConversationId={conversation.id}
          onForward={handleForwardSend}
          onClose={() => setForwardMessage(null)}
        />
      )}
    </div>
  );
};

export default ChatWindow;
