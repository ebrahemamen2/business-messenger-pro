import { useState } from 'react';
import { useConversations } from '@/hooks/useConversations';
import ChatList from '@/components/chat/ChatList';
import ChatWindow from '@/components/chat/ChatWindow';
import ContactPanel from '@/components/chat/ContactPanel';
import { MessageSquare, Loader2 } from 'lucide-react';

const Index = () => {
  const { conversations, loading } = useConversations();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showContact, setShowContact] = useState(false);

  const selected = conversations.find((c) => c.id === selectedId);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="flex h-full">
      <ChatList
        conversations={conversations}
        selectedId={selectedId}
        onSelect={setSelectedId}
      />
      {selected ? (
        <>
          <ChatWindow
            conversation={selected}
            onToggleContact={() => setShowContact(!showContact)}
          />
          {showContact && (
            <ContactPanel
              contact={selected.contact}
              onClose={() => setShowContact(false)}
            />
          )}
        </>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground gap-4">
          <div className="w-20 h-20 rounded-2xl bg-primary/10 flex items-center justify-center">
            <MessageSquare className="w-10 h-10 text-primary" />
          </div>
          <div className="text-center">
            <p className="font-semibold text-foreground text-lg">واتساب CRM</p>
            <p className="text-sm mt-1">
              {conversations.length === 0
                ? 'لا توجد محادثات بعد - ابدأ بإرسال رسالة على رقم الواتساب'
                : 'اختر محادثة من القائمة للبدء'}
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default Index;
