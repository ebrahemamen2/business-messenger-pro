import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { playNotificationSound } from '@/lib/notificationSound';

export interface ChatContact {
  id: string;
  name: string;
  phone: string;
  email?: string | null;
  tags: string[];
  notes?: string | null;
}

export interface ChatMessage {
  id: string;
  text: string;
  timestamp: string;
  rawTimestamp: string;
  sender: 'customer' | 'agent' | 'store';
  status?: string;
  mediaUrl?: string | null;
  mediaType?: string | null;
  replyToId?: string | null;
}

export interface ConversationLabel {
  id: string;
  name: string;
  color: string;
}

export type ChatStatusType = 'unread' | 'awaiting_reply' | 'replied';

export interface ChatConversation {
  id: string;
  dbId: string | null;
  contact: ChatContact;
  messages: ChatMessage[];
  lastMessage: string;
  lastMessageTime: string;
  unreadCount: number;
  chatStatus: ChatStatusType;
  lastMessageDirection: 'inbound' | 'outbound' | null;
  status: 'open' | 'pending' | 'resolved';
  assignedTo?: string | null;
  labels: ConversationLabel[];
  lastCustomerMessageAt: string | null;
  pinnedAt?: string | null;
  archivedAt?: string | null;
}

function normalizePhone(phone: string): string {
  let p = phone.replace(/[\s\-\+]/g, '');
  if (/^0\d{10}$/.test(p)) p = '2' + p;
  if (/^200\d{9}$/.test(p)) p = '20' + p.slice(3);
  return p;
}

function getPhoneVariants(phone: string): string[] {
  const clean = phone.replace(/[\s\-\+]/g, '');
  const normalized = normalizePhone(clean);
  const variants = new Set<string>([clean, normalized]);

  if (/^20\d{10}$/.test(normalized)) {
    variants.add(`0${normalized.slice(2)}`);
  }

  return [...variants];
}

function toTimestamp(value?: string | null): number {
  if (!value) return 0;
  const ts = new Date(value).getTime();
  return Number.isNaN(ts) ? 0 : ts;
}

function formatTime(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' });
}

function mapDbMessage(m: any): ChatMessage {
  let sender: 'customer' | 'agent' | 'store' = 'agent';
  if (m.direction === 'inbound') sender = 'customer';
  else if (m.direction === 'store') sender = 'store';
  return {
    id: m.id,
    text: m.body,
    timestamp: formatTime(m.created_at),
    rawTimestamp: m.created_at,
    sender,
    status: m.status || undefined,
    mediaUrl: m.media_url || undefined,
    mediaType: m.media_type || undefined,
    replyToId: m.reply_to_message_id || undefined,
  };
}

export function useConversations(tenantId?: string | null, module: string = 'confirm') {
  const [conversations, setConversations] = useState<ChatConversation[]>([]);
  const [loading, setLoading] = useState(true);
  const conversationsRef = useRef<ChatConversation[]>([]);
  const selectedPhoneRef = useRef<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval>>();
  const listRequestIdRef = useRef(0);

  // Load conversation list (lightweight - no messages)
  const loadList = useCallback(async () => {
    if (!tenantId) return;

    const reqId = ++listRequestIdRef.current;

    try {
      let convsQuery = supabase.from('conversations').select('*').eq('module', module).order('last_message_at', { ascending: false });
      let contactsQuery = supabase.from('contacts').select('*');
      let labelsQuery = supabase.from('conversation_label_assignments').select('*, conversation_labels(*)');

      if (tenantId) {
        convsQuery = convsQuery.eq('tenant_id', tenantId);
        contactsQuery = contactsQuery.eq('tenant_id', tenantId);
      }

      const [convsRes, contactsRes, labelsRes] = await Promise.all([convsQuery, contactsQuery, labelsQuery]);

      const dbConvs = convsRes.data || [];
      const contacts = contactsRes.data || [];
      const labelAssignments = labelsRes.data || [];

      // Index contacts by normalized phone
      const contactByPhone: Record<string, any> = {};
      for (const c of contacts) {
        contactByPhone[normalizePhone(c.phone)] = c;
      }

      // Index labels by conversation_id
      const labelsByConvId: Record<string, ConversationLabel[]> = {};
      for (const la of labelAssignments) {
        if (!labelsByConvId[la.conversation_id]) labelsByConvId[la.conversation_id] = [];
        const lbl = la.conversation_labels as any;
        if (lbl) labelsByConvId[la.conversation_id].push({ id: lbl.id, name: lbl.name, color: lbl.color });
      }

      // Deduplicate by normalized phone
      const seenPhones = new Set<string>();
      const dedupedConvs = dbConvs.filter((dbConv) => {
        const phone = normalizePhone(dbConv.contact_phone);
        if (seenPhones.has(phone)) return false;
        seenPhones.add(phone);
        return true;
      });

      const convs: ChatConversation[] = dedupedConvs.map((dbConv) => {
        const phone = normalizePhone(dbConv.contact_phone);
        const contact = contactByPhone[phone];
        const chatStatus = (dbConv as any).chat_status as ChatStatusType || 'replied';

        return {
          id: phone,
          dbId: dbConv.id,
          contact: {
            id: contact?.id || phone,
            name: contact?.name || dbConv.contact_phone,
            phone: dbConv.contact_phone,
            email: contact?.email,
            tags: contact?.tags || [],
            notes: contact?.notes,
          },
          messages: [],
          lastMessage: (dbConv as any).last_message_body || '',
          lastMessageTime: dbConv.last_message_at || dbConv.created_at,
          unreadCount: chatStatus === 'unread' ? 1 : 0,
          chatStatus,
          lastMessageDirection: null,
          status: dbConv.status as any || 'open',
          assignedTo: dbConv.assigned_to || null,
          labels: labelsByConvId[dbConv.id] || [],
          lastCustomerMessageAt: (dbConv as any).last_customer_message_at || null,
          pinnedAt: (dbConv as any).pinned_at || null,
          archivedAt: (dbConv as any).archived_at || null,
        };
      });

      if (reqId !== listRequestIdRef.current) return;

      setConversations((prev) => {
        const next = convs.map((newConv) => {
          const existing = prev.find((p) => p.id === newConv.id);
          if (existing && existing.messages.length > 0) {
            return { ...newConv, messages: existing.messages };
          }
          return newConv;
        });

        // Sort: pinned first, then by last message time
        next.sort((a, b) => {
          const aPinned = a.pinnedAt ? 1 : 0;
          const bPinned = b.pinnedAt ? 1 : 0;
          if (aPinned !== bPinned) return bPinned - aPinned;
          return toTimestamp(b.lastMessageTime) - toTimestamp(a.lastMessageTime);
        });

        conversationsRef.current = next;
        return next;
      });
      setLoading(false);
    } catch (err) {
      console.error('Error loading conversations:', err);
      setLoading(false);
    }
  }, [tenantId, module]);

  // Load messages for a specific conversation (by phone)
  const loadMessages = useCallback(async (phone: string) => {
    const normalizedPhone = normalizePhone(phone);

    const phonesToQuery = new Set<string>(getPhoneVariants(phone));
    const conv = conversationsRef.current.find((c) => c.id === normalizedPhone);
    if (conv) {
      getPhoneVariants(conv.contact.phone).forEach((p) => phonesToQuery.add(p));
    }

    let msgQuery = supabase
      .from('messages')
      .select('*')
      .in('contact_phone', [...phonesToQuery])
      .order('created_at', { ascending: false })
      .limit(100);

    if (tenantId) msgQuery = msgQuery.or(`tenant_id.eq.${tenantId},tenant_id.is.null`);

    const { data: rawMsgs } = await msgQuery;
    if (!rawMsgs) return;
    const msgs = rawMsgs.reverse();

    const latest = msgs[msgs.length - 1];
    const latestDirection: ChatConversation['lastMessageDirection'] =
      latest?.direction === 'inbound' || latest?.direction === 'outbound'
        ? latest.direction
        : null;

    setConversations((prev) => {
      const next = prev.map((c) =>
        c.id === normalizedPhone
          ? {
              ...c,
              messages: msgs.map(mapDbMessage),
              lastMessageDirection: latestDirection,
              lastMessage: latest?.body || c.lastMessage,
              lastMessageTime: latest?.created_at || c.lastMessageTime,
            }
          : c
      );

      next.sort((a, b) => {
        const aPinned = a.pinnedAt ? 1 : 0;
        const bPinned = b.pinnedAt ? 1 : 0;
        if (aPinned !== bPinned) return bPinned - aPinned;
        return toTimestamp(b.lastMessageTime) - toTimestamp(a.lastMessageTime);
      });

      conversationsRef.current = next;
      return next;
    });
  }, [tenantId]);

  // Load older messages (pagination)
  const loadOlderMessages = useCallback(async (phone: string): Promise<boolean> => {
    const normalizedPhone = normalizePhone(phone);
    const conv = conversationsRef.current.find((c) => c.id === normalizedPhone);
    if (!conv || conv.messages.length === 0) return false;

    const oldestTimestamp = conv.messages[0].rawTimestamp;
    const phonesToQuery = new Set<string>(getPhoneVariants(phone));
    if (conv) {
      getPhoneVariants(conv.contact.phone).forEach((p) => phonesToQuery.add(p));
    }

    let msgQuery = supabase
      .from('messages')
      .select('*')
      .in('contact_phone', [...phonesToQuery])
      .lt('created_at', oldestTimestamp)
      .order('created_at', { ascending: false })
      .limit(50);

    if (tenantId) msgQuery = msgQuery.or(`tenant_id.eq.${tenantId},tenant_id.is.null`);

    const { data: rawMsgs } = await msgQuery;
    if (!rawMsgs || rawMsgs.length === 0) return false;

    const olderMsgs = rawMsgs.reverse().map(mapDbMessage);

    setConversations((prev) => {
      const next = prev.map((c) =>
        c.id === normalizedPhone
          ? { ...c, messages: [...olderMsgs, ...c.messages] }
          : c
      );
      conversationsRef.current = next;
      return next;
    });

    return rawMsgs.length >= 50;
  }, [tenantId]);

  // Select a conversation: mark as awaiting_reply if unread
  const selectConversation = useCallback((phone: string | null) => {
    const normalized = phone ? normalizePhone(phone) : null;
    selectedPhoneRef.current = normalized;

    if (normalized) {
      const conv = conversationsRef.current.find((c) => c.id === normalized);
      
      // If unread, update to awaiting_reply in DB
      if (conv?.chatStatus === 'unread' && conv.dbId) {
        supabase
          .from('conversations')
          .update({ chat_status: 'awaiting_reply', unread_count: 0 })
          .eq('id', conv.dbId)
          .then(() => {
            // Optimistic update
            setConversations((prev) => {
              const next = prev.map((c) =>
                c.id === normalized
                  ? { ...c, chatStatus: 'awaiting_reply' as ChatStatusType, unreadCount: 0 }
                  : c
              );
              conversationsRef.current = next;
              return next;
            });
          });
      }

      loadMessages(normalized);
    }
  }, [loadMessages]);

  const updateStatus = useCallback(async (conversationDbId: string, status: string) => {
    await supabase.from('conversations').update({ status }).eq('id', conversationDbId);
    loadList();
  }, [loadList]);

  const updateAssignment = useCallback(async (conversationDbId: string, userId: string | null) => {
    await supabase.from('conversations').update({ assigned_to: userId }).eq('id', conversationDbId);
    loadList();
  }, [loadList]);

  const togglePin = useCallback(async (conversationDbId: string, currentlyPinned: boolean) => {
    await supabase
      .from('conversations')
      .update({ pinned_at: currentlyPinned ? null : new Date().toISOString() } as any)
      .eq('id', conversationDbId);
    loadList();
  }, [loadList]);

  const toggleArchive = useCallback(async (conversationDbId: string, currentlyArchived: boolean) => {
    await supabase
      .from('conversations')
      .update({ archived_at: currentlyArchived ? null : new Date().toISOString() } as any)
      .eq('id', conversationDbId);
    loadList();
  }, [loadList]);

  const bulkUpdateChatStatus = useCallback(async (dbIds: string[], newStatus: ChatStatusType) => {
    if (dbIds.length === 0) return;

    const dbIdSet = new Set(dbIds);
    setConversations((prev) => {
      const next = prev.map((c) =>
        c.dbId && dbIdSet.has(c.dbId)
          ? { ...c, chatStatus: newStatus, unreadCount: newStatus === 'unread' ? 1 : 0 }
          : c
      );
      conversationsRef.current = next;
      return next;
    });

    await supabase
      .from('conversations')
      .update({ chat_status: newStatus, unread_count: newStatus === 'unread' ? 1 : 0 })
      .in('id', dbIds);
    loadList();
  }, [loadList]);

  const moveConversation = useCallback(async (dbId: string, newModule: string) => {
    // Optimistic: remove from current list
    setConversations((prev) => {
      const next = prev.filter((c) => c.dbId !== dbId);
      conversationsRef.current = next;
      return next;
    });

    await supabase
      .from('conversations')
      .update({ module: newModule })
      .eq('id', dbId);
  }, []);

  useEffect(() => {
    if (!tenantId) return;

    loadList();

    const channel = supabase
      .channel(`messages-realtime:${tenantId}:${module}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, (payload) => {
        const newMsg = payload.new as any;

        if (tenantId && newMsg.tenant_id && newMsg.tenant_id !== tenantId) return;

        const phone = normalizePhone(newMsg.contact_phone);

        // Play notification sound for inbound messages
        if (newMsg.direction === 'inbound') {
          playNotificationSound();
        }

        loadList();
        if (phone === selectedPhoneRef.current) loadMessages(phone);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'conversations' }, () => loadList())
      .subscribe((status) => {
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          loadList();
        }
      });

    intervalRef.current = setInterval(loadList, 20000);

    return () => {
      supabase.removeChannel(channel);
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [tenantId, module, loadList, loadMessages]);

  return {
    conversations,
    loading,
    reload: loadList,
    updateStatus,
    updateAssignment,
    selectConversation,
    loadMessages,
    loadOlderMessages,
    togglePin,
    toggleArchive,
    bulkUpdateChatStatus,
    moveConversation,
  };
}
