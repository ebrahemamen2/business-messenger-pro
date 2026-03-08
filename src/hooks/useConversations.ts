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
  dbId: string | null; // conversations table UUID
  contact: ChatContact;
  messages: ChatMessage[];
  lastMessage: string;
  lastMessageTime: string;
  unreadCount: number;
  status: 'open' | 'pending' | 'resolved';
  assignedTo?: string | null;
  labels: ConversationLabel[];
}

/** Normalize phone to consistent format */
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
  const intervalRef = useRef<ReturnType<typeof setInterval>>();

  const loadData = useCallback(async () => {
    // Load contacts, messages, and conversation records in parallel
    let contactsQuery = supabase.from('contacts').select('*');
    let messagesQuery = supabase.from('messages').select('*').order('created_at', { ascending: true });
    let convsQuery = supabase.from('conversations').select('*').eq('module', module);
    let labelsQuery = supabase.from('conversation_label_assignments').select('*, conversation_labels(*)');

    if (tenantId) {
      contactsQuery = contactsQuery.eq('tenant_id', tenantId);
      messagesQuery = messagesQuery.eq('tenant_id', tenantId);
      convsQuery = convsQuery.eq('tenant_id', tenantId);
    }

    const [contactsRes, messagesRes, convsRes, labelsRes] = await Promise.all([
      contactsQuery,
      messagesQuery,
      convsQuery,
      labelsQuery,
    ]);

    const contacts = contactsRes.data || [];
    const messages = messagesRes.data || [];
    const dbConvs = convsRes.data || [];
    const labelAssignments = labelsRes.data || [];

    if (!contacts && !messages) {
      setLoading(false);
      return;
    }

    // Index DB conversations by phone
    const dbConvByPhone: Record<string, any> = {};
    for (const c of dbConvs) {
      dbConvByPhone[normalizePhone(c.contact_phone)] = c;
    }

    // Index labels by conversation_id
    const labelsByConvId: Record<string, ConversationLabel[]> = {};
    for (const la of labelAssignments) {
      const convId = la.conversation_id;
      if (!labelsByConvId[convId]) labelsByConvId[convId] = [];
      const lbl = la.conversation_labels as any;
      if (lbl) {
        labelsByConvId[convId].push({ id: lbl.id, name: lbl.name, color: lbl.color });
      }
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

    // Helper to build conversation
    const buildConv = (phone: string, contact: ChatContact, msgs: any[]) => {
      const lastMsg = msgs[msgs.length - 1];
      const dbConv = dbConvByPhone[phone];
      const dbId = dbConv?.id || null;

      // Calculate unread: inbound messages after last outbound
      let unread = 0;
      for (let i = msgs.length - 1; i >= 0; i--) {
        if (msgs[i].direction === 'inbound') unread++;
        else break; // stop at last outbound
      }

      const status = dbConv?.status || 'open';
      const labels = dbId ? (labelsByConvId[dbId] || []) : [];

      convs.push({
        id: phone,
        dbId,
        contact,
        messages: msgs.map(mapDbMessage),
        lastMessage: lastMsg?.body || '',
        lastMessageTime: lastMsg ? lastMsg.created_at : '',
        unreadCount: unread,
        status,
        assignedTo: dbConv?.assigned_to || null,
        labels,
      });
    };

    // Process contacts first (dedup by normalized phone)
    for (const c of contacts) {
      const phone = normalizePhone(c.phone);
      if (processedPhones.has(phone)) continue;
      processedPhones.add(phone);
      const msgs = msgByPhone[phone] || [];
      buildConv(phone, {
        id: c.id,
        name: c.name || c.phone,
        phone: c.phone,
        email: c.email,
        tags: c.tags || [],
        notes: c.notes,
      }, msgs);
    }

    // Messages from phones not in contacts
    for (const phone of Object.keys(msgByPhone)) {
      if (processedPhones.has(phone)) continue;
      const msgs = msgByPhone[phone];
      const lastMsg = msgs[msgs.length - 1];
      buildConv(phone, {
        id: phone,
        name: lastMsg?.contact_name || phone,
        phone,
        tags: [],
      }, msgs);
    }

    // Sort by last message time (newest first)
    convs.sort((a, b) => (b.lastMessageTime || '').localeCompare(a.lastMessageTime || ''));

    // Auto-create missing conversation DB records
    const phonesNeedingDbRecord = convs.filter((c) => !c.dbId && c.messages.length > 0);
    if (phonesNeedingDbRecord.length > 0) {
      const inserts = phonesNeedingDbRecord.map((c) => ({
        contact_phone: c.contact.phone,
        tenant_id: tenantId || undefined,
        module,
        status: 'open',
        unread_count: c.unreadCount,
        last_message_at: c.lastMessageTime || new Date().toISOString(),
      }));
      const { data: inserted } = await supabase.from('conversations').upsert(inserts, {
        onConflict: 'contact_phone,tenant_id,module',
      }).select();
      if (inserted) {
        for (const row of inserted) {
          const phone = normalizePhone(row.contact_phone);
          const conv = convs.find((c) => c.id === phone);
          if (conv) conv.dbId = row.id;
        }
      }
    }

    setConversations(convs);
    setLoading(false);
  }, [tenantId, module]);

  // Update conversation status in DB
  const updateStatus = useCallback(async (conversationDbId: string, status: string) => {
    await supabase.from('conversations').update({ status }).eq('id', conversationDbId);
    loadData();
  }, [loadData]);

  // Update assigned agent
  const updateAssignment = useCallback(async (conversationDbId: string, userId: string | null) => {
    await supabase.from('conversations').update({ assigned_to: userId }).eq('id', conversationDbId);
    loadData();
  }, [loadData]);

  useEffect(() => {
    loadData();

    const channel = supabase
      .channel('messages-realtime')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, () => loadData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'conversations' }, () => loadData())
      .subscribe();

    intervalRef.current = setInterval(loadData, 20000);

    return () => {
      supabase.removeChannel(channel);
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [loadData]);

  return { conversations, loading, reload: loadData, updateStatus, updateAssignment };
}
