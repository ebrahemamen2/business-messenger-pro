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

export interface ChatConversation {
  id: string;
  contact: ChatContact;
  messages: ChatMessage[];
  lastMessage: string;
  lastMessageTime: string;
  unreadCount: number;
  status: 'active' | 'pending' | 'resolved';
}

/** Normalize phone to consistent format (remove leading 0, ensure country code) */
function normalizePhone(phone: string): string {
  let p = phone.replace(/[\s\-\+]/g, '');
  if (/^0\d{10}$/.test(p)) p = '2' + p;
  if (/^200\d{9}$/.test(p)) p = '20' + p.slice(3);
  return p;
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
    sender,
    status: m.status || undefined,
  };
}

export function useConversations(tenantId?: string | null) {
  const [conversations, setConversations] = useState<ChatConversation[]>([]);
  const [loading, setLoading] = useState(true);
  const intervalRef = useRef<ReturnType<typeof setInterval>>();

  const loadData = useCallback(async () => {
    let contactsQuery = supabase.from('contacts').select('*');
    let messagesQuery = supabase
      .from('messages')
      .select('*')
      .order('created_at', { ascending: true });

    if (tenantId) {
      contactsQuery = contactsQuery.eq('tenant_id', tenantId);
      messagesQuery = messagesQuery.eq('tenant_id', tenantId);
    }

    const { data: contacts } = await contactsQuery;
    const { data: messages } = await messagesQuery;

    if (!contacts || !messages) {
      setLoading(false);
      return;
    }

    // Group messages by normalized phone
    const msgByPhone: Record<string, any[]> = {};
    for (const m of messages) {
      const phone = normalizePhone(m.contact_phone);
      if (!msgByPhone[phone]) msgByPhone[phone] = [];
      msgByPhone[phone].push(m);
    }

    const convs: ChatConversation[] = [];
    const processedPhones = new Set<string>();

    for (const c of contacts) {
      const phone = normalizePhone(c.phone);
      processedPhones.add(phone);
      const msgs = msgByPhone[phone] || [];
      const lastMsg = msgs[msgs.length - 1];
      convs.push({
        id: phone,
        contact: {
          id: c.id,
          name: c.name || c.phone,
          phone: c.phone,
          email: c.email,
          tags: c.tags || [],
          notes: c.notes,
        },
        messages: msgs.map(mapDbMessage),
        lastMessage: lastMsg?.body || '',
        lastMessageTime: lastMsg ? formatTime(lastMsg.created_at) : '',
        unreadCount: 0,
        status: 'active',
      });
    }

    // Messages from phones not in contacts
    for (const phone of Object.keys(msgByPhone)) {
      if (processedPhones.has(phone)) continue;
      const msgs = msgByPhone[phone];
      const lastMsg = msgs[msgs.length - 1];
      convs.push({
        id: phone,
        contact: {
          id: phone,
          name: lastMsg?.contact_name || phone,
          phone,
          tags: [],
        },
        messages: msgs.map(mapDbMessage),
        lastMessage: lastMsg?.body || '',
        lastMessageTime: lastMsg ? formatTime(lastMsg.created_at) : '',
        unreadCount: 0,
        status: 'active',
      });
    }

    convs.sort((a, b) => {
      const aTime = msgByPhone[a.id]?.[msgByPhone[a.id].length - 1]?.created_at || '';
      const bTime = msgByPhone[b.id]?.[msgByPhone[b.id].length - 1]?.created_at || '';
      return bTime.localeCompare(aTime);
    });

    setConversations(convs);
    setLoading(false);
  }, [tenantId]);

  useEffect(() => {
    loadData();

    // Realtime subscription
    const channel = supabase
      .channel('messages-realtime')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages' },
        () => loadData()
      )
      .subscribe();

    // Fallback polling every 20s
    intervalRef.current = setInterval(loadData, 20000);

    return () => {
      supabase.removeChannel(channel);
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [loadData]);

  return { conversations, loading, reload: loadData };
}
