import { useState, useEffect } from 'react';
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
  sender: 'customer' | 'agent';
  status?: string;
}

export interface ChatConversation {
  id: string; // phone number as ID
  contact: ChatContact;
  messages: ChatMessage[];
  lastMessage: string;
  lastMessageTime: string;
  unreadCount: number;
  status: 'active' | 'pending' | 'resolved';
}

function formatTime(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' });
}

function mapDbMessage(m: any): ChatMessage {
  return {
    id: m.id,
    text: m.body,
    timestamp: formatTime(m.created_at),
    sender: m.direction === 'inbound' ? 'customer' : 'agent',
    status: m.status || undefined,
  };
}

export function useConversations() {
  const [conversations, setConversations] = useState<ChatConversation[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    // Get all contacts
    const { data: contacts } = await supabase.from('contacts').select('*');
    // Get all messages ordered by time
    const { data: messages } = await supabase
      .from('messages')
      .select('*')
      .order('created_at', { ascending: true });

    if (!contacts || !messages) {
      setLoading(false);
      return;
    }

    // Group messages by contact_phone
    const msgByPhone: Record<string, any[]> = {};
    for (const m of messages) {
      if (!msgByPhone[m.contact_phone]) msgByPhone[m.contact_phone] = [];
      msgByPhone[m.contact_phone].push(m);
    }

    // Build conversations
    const convs: ChatConversation[] = [];
    const processedPhones = new Set<string>();

    // From contacts
    for (const c of contacts) {
      processedPhones.add(c.phone);
      const msgs = msgByPhone[c.phone] || [];
      const lastMsg = msgs[msgs.length - 1];
      convs.push({
        id: c.phone,
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

    // Sort by last message time (most recent first)
    convs.sort((a, b) => {
      const aTime = msgByPhone[a.id]?.[msgByPhone[a.id].length - 1]?.created_at || '';
      const bTime = msgByPhone[b.id]?.[msgByPhone[b.id].length - 1]?.created_at || '';
      return bTime.localeCompare(aTime);
    });

    setConversations(convs);
    setLoading(false);
  };

  useEffect(() => {
    loadData();

    // Realtime subscription for new messages
    const channel = supabase
      .channel('messages-realtime')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages' },
        () => {
          loadData(); // Reload all data on new message
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  return { conversations, loading, reload: loadData };
}
