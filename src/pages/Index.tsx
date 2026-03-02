import { useState } from 'react';
import { conversations } from '@/data/mockData';
import ChatList from '@/components/chat/ChatList';
import ChatWindow from '@/components/chat/ChatWindow';
import ContactPanel from '@/components/chat/ContactPanel';
import { MessageSquare } from 'lucide-react';

const Index = () => {
  const [selectedId, setSelectedId] = useState<string | null>(
    conversations[0]?.id || null
  );
  const [showContact, setShowContact] = useState(false);

  const selected = conversations.find((c) => c.id === selectedId);

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
            <p className="text-sm mt-1">اختر محادثة من القائمة للبدء</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default Index;
