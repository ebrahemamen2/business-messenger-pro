import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

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

export interface ChatConversation {
  id: string;
  dbId: string | null;
  contact: ChatContact;
  messages: ChatMessage[];
  lastMessage: string;
  lastMessageTime: string;
  unreadCount: number;
  lastMessageDirection: 'inbound' | 'outbound' | null;
  status: 'open' | 'pending' | 'resolved';
  assignedTo?: string | null;
  labels: ConversationLabel[];
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
  const openedInboundRef = useRef<Set<string>>(new Set());
  const intervalRef = useRef<ReturnType<typeof setInterval>>();

  // Load conversation list (lightweight - no messages)
  const loadList = useCallback(async () => {
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

    // Deduplicate by normalized phone (keep latest per phone since ordered by last_message_at desc)
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
        lastMessage: '',
        lastMessageTime: dbConv.last_message_at || dbConv.created_at,
        unreadCount: dbConv.unread_count || 0,
        lastMessageDirection: null,
        status: dbConv.status as any || 'open',
        assignedTo: dbConv.assigned_to || null,
        labels: labelsByConvId[dbConv.id] || [],
      };
    });

    // For each conversation, get last few messages per phone for preview + unread
    if (convs.length > 0) {
      const unreadByPhone: Record<string, number> = {};
      const lastByPhone: Record<string, string> = {};
      const lastAtByPhone: Record<string, string> = {};

      // Include normalized/local variants so we don't miss messages بسبب اختلاف تنسيق الرقم
      const phones = [...new Set(convs.flatMap((c) => getPhoneVariants(c.contact.phone)))];
      // Fetch last message per phone using a smarter approach:
      // get last 5 messages per phone to ensure preview coverage
      let lastMsgsQuery = supabase
        .from('messages')
        .select('contact_phone, body, direction, created_at')
        .in('contact_phone', phones)
        .order('created_at', { ascending: false })
        .limit(1000);

      if (tenantId) {
        lastMsgsQuery = lastMsgsQuery.or(`tenant_id.eq.${tenantId},tenant_id.is.null`);
      }

      const { data: lastMsgs } = await lastMsgsQuery;

      if (lastMsgs) {
        const messagesByPhone: Record<string, typeof lastMsgs> = {};
        const lastDirByPhone: Record<string, string> = {};

        for (const m of lastMsgs) {
          const p = normalizePhone(m.contact_phone);
          if (!lastByPhone[p]) {
            lastByPhone[p] = m.body;
            lastDirByPhone[p] = m.direction;
            lastAtByPhone[p] = m.created_at;
          }
          if (!messagesByPhone[p]) messagesByPhone[p] = [];
          if (messagesByPhone[p].length < 20) {
            messagesByPhone[p].push(m);
          }
        }

        // Count consecutive inbound from newest
        for (const [p, msgs] of Object.entries(messagesByPhone)) {
          let count = 0;
          for (const msg of msgs) {
            if (msg.direction === 'inbound') count++;
            else break;
          }
          unreadByPhone[p] = count;
        }

        for (const conv of convs) {
          conv.lastMessage = lastByPhone[conv.id] || conv.lastMessage;
          conv.lastMessageTime = lastAtByPhone[conv.id] || conv.lastMessageTime;
          conv.unreadCount = unreadByPhone[conv.id] ?? conv.unreadCount;
          conv.lastMessageDirection = (lastDirByPhone[conv.id] as any) || conv.lastMessageDirection;

          // If conversation was opened by agent and last message is still inbound,
          // treat it as read but waiting for reply.
          if (openedInboundRef.current.has(conv.id)) {
            if (conv.lastMessageDirection === 'inbound') {
              conv.unreadCount = 0;
            } else {
              openedInboundRef.current.delete(conv.id);
            }
          }
        }
      }
    }

    setConversations((prev) => {
      // Preserve loaded messages for the selected conversation
      const next = convs.map((newConv) => {
        const existing = prev.find((p) => p.id === newConv.id);
        if (existing && existing.messages.length > 0) {
          return { ...newConv, messages: existing.messages };
        }
        return newConv;
      });

      next.sort((a, b) => toTimestamp(b.lastMessageTime) - toTimestamp(a.lastMessageTime));

      conversationsRef.current = next;
      return next;
    });
    setLoading(false);
  }, [tenantId, module]);

  // Load messages for a specific conversation (by phone)
  const loadMessages = useCallback(async (phone: string, markAsRead: boolean = false) => {
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

    let unread = 0;
    for (let i = msgs.length - 1; i >= 0; i--) {
      if (msgs[i].direction === 'inbound') unread++;
      else break;
    }

    const latest = msgs[msgs.length - 1];
    const latestDirection: ChatConversation['lastMessageDirection'] =
      latest?.direction === 'inbound' || latest?.direction === 'outbound'
        ? latest.direction
        : null;

    const shouldMarkAsRead = markAsRead || openedInboundRef.current.has(normalizedPhone);
    if (shouldMarkAsRead && latestDirection === 'inbound') {
      openedInboundRef.current.add(normalizedPhone);
    }
    if (latestDirection && latestDirection !== 'inbound') {
      openedInboundRef.current.delete(normalizedPhone);
    }

    setConversations((prev) => {
      const next = prev.map((c) =>
        c.id === normalizedPhone
          ? {
              ...c,
              messages: msgs.map(mapDbMessage),
              unreadCount: shouldMarkAsRead ? 0 : unread,
              lastMessageDirection: latestDirection,
              lastMessage: latest?.body || c.lastMessage,
              lastMessageTime: latest?.created_at || c.lastMessageTime,
            }
          : c
      );

      next.sort((a, b) => toTimestamp(b.lastMessageTime) - toTimestamp(a.lastMessageTime));

      conversationsRef.current = next;
      return next;
    });
  }, [tenantId]);

  // Load older messages (pagination) — returns true if there are more
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

    return rawMsgs.length >= 50; // has more if we got a full page
  }, [tenantId]);

  // Select a conversation and load its messages
  const selectConversation = useCallback((phone: string | null) => {
    const normalized = phone ? normalizePhone(phone) : null;
    selectedPhoneRef.current = normalized;

    if (normalized) {
      openedInboundRef.current.add(normalized);
      loadMessages(normalized, true);
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

  useEffect(() => {
    loadList();

    const channel = supabase
      .channel('messages-realtime')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, (payload) => {
        const newMsg = payload.new as any;

        if (tenantId && newMsg.tenant_id && newMsg.tenant_id !== tenantId) return;

        const phone = normalizePhone(newMsg.contact_phone);
        loadList();
        if (phone === selectedPhoneRef.current) loadMessages(phone, true);
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
  }, [loadList, loadMessages]);

  return {
    conversations,
    loading,
    reload: loadList,
    updateStatus,
    updateAssignment,
    selectConversation,
    loadMessages,
    loadOlderMessages,
  };
}
