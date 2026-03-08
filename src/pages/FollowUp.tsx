import { useState } from 'react';
import { useConversations } from '@/hooks/useConversations';
import { useTenantContext } from '@/contexts/TenantContext';
import ChatList from '@/components/chat/ChatList';
import ChatWindow from '@/components/chat/ChatWindow';
import ContactPanel from '@/components/chat/ContactPanel';
import { Truck, Loader2, MessageSquare, Settings, Bot } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';

const FollowUp = () => {
  const { currentTenant } = useTenantContext();
  const { conversations, loading, reload } = useConversations(currentTenant?.id);
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
    <div className="flex flex-col h-full">
      <Tabs defaultValue="chat" className="flex flex-col h-full" dir="rtl">
        <div className="border-b border-border bg-card px-4 flex-shrink-0">
          <TabsList className="bg-transparent h-12 gap-1">
            <TabsTrigger value="chat" className="gap-2 data-[state=active]:bg-primary/10 data-[state=active]:text-primary">
              <MessageSquare className="w-4 h-4" />
              المحادثات
            </TabsTrigger>
            <TabsTrigger value="settings" className="gap-2 data-[state=active]:bg-primary/10 data-[state=active]:text-primary">
              <Settings className="w-4 h-4" />
              إعدادات الواتساب
            </TabsTrigger>
            <TabsTrigger value="auto-reply" className="gap-2 data-[state=active]:bg-primary/10 data-[state=active]:text-primary">
              <Bot className="w-4 h-4" />
              الرد التلقائي
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="chat" className="flex-1 m-0 overflow-hidden">
          <div className="flex h-full">
            <ChatList
              conversations={conversations}
              selectedId={selectedId}
              onSelect={setSelectedId}
              title="محادثات المتابعة"
            />
            {selected ? (
              <>
                <ChatWindow
                  conversation={selected}
                  onToggleContact={() => setShowContact(!showContact)}
                  module="followup"
                  tenantId={currentTenant?.id}
                />
                {showContact && (
                  <ContactPanel
                    contact={selected.contact}
                    onClose={() => setShowContact(false)}
                    tenantId={currentTenant?.id}
                    onContactUpdate={reload}
                  />
                )}
              </>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground gap-4">
                <div className="w-20 h-20 rounded-2xl bg-primary/10 flex items-center justify-center">
                  <Truck className="w-10 h-10 text-primary" />
                </div>
                <div className="text-center">
                  <p className="font-semibold text-foreground text-lg">قسم المتابعة</p>
                  <p className="text-sm mt-1">
                    {conversations.length === 0
                      ? 'لا توجد محادثات متابعة بعد'
                      : 'اختر محادثة من القائمة للبدء'}
                  </p>
                </div>
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="settings" className="flex-1 m-0 overflow-hidden">
          <div className="p-8 text-center text-muted-foreground">
            <p>إعدادات المتابعة - قريباً</p>
          </div>
        </TabsContent>

        <TabsContent value="auto-reply" className="flex-1 m-0 overflow-hidden">
          <div className="p-8 text-center text-muted-foreground">
            <p>الرد التلقائي للمتابعة - قريباً</p>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default FollowUp;
