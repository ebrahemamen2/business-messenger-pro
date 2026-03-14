import { useState } from 'react';
import { useConversations } from '@/hooks/useConversations';
import { useTenantContext } from '@/contexts/TenantContext';
import { useAuth } from '@/contexts/AuthContext';
import ChatList from '@/components/chat/ChatList';
import ChatWindow from '@/components/chat/ChatWindow';
import ContactPanel from '@/components/chat/ContactPanel';
import { PackageX, Loader2, MessageSquare, Bot, Brain, ArrowRight } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import ConfirmAutoReply from '@/components/confirm/ConfirmAutoReply';
import AIModulePrompt from '@/components/settings/AIModulePrompt';
import { useIsMobile } from '@/hooks/use-mobile';
import { Sheet, SheetContent } from '@/components/ui/sheet';

const LostOrders = () => {
  const { currentTenant } = useTenantContext();
  const { user } = useAuth();
  const { conversations, loading, reload, updateStatus, updateAssignment, selectConversation, loadOlderMessages, togglePin, toggleArchive, bulkUpdateChatStatus, moveConversation } = useConversations(currentTenant?.id, 'lost');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showContact, setShowContact] = useState(false);
  const isMobile = useIsMobile();

  const handleSelect = (id: string) => {
    setSelectedId(id);
    selectConversation(id);
  };

  const handleBack = () => {
    setSelectedId(null);
    setShowContact(false);
  };

  const selected = conversations.find((c) => c.id === selectedId);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const chatWindowProps = (conv: typeof selected) => conv ? ({
    conversation: conv,
    module: "lost" as const,
    tenantId: currentTenant?.id,
    conversationDbId: conv.dbId,
    onStatusChange: updateStatus,
    onLoadOlder: loadOlderMessages,
    allConversations: conversations,
    onTogglePin: togglePin,
    onToggleArchive: toggleArchive,
    onAssign: updateAssignment,
    onMoveConversation: moveConversation,
  }) : null;

  return (
    <div className="flex flex-col h-full">
      <Tabs defaultValue="chat" className="flex flex-col h-full" dir="rtl">
        <div className="border-b border-border bg-card px-2 sm:px-4 flex-shrink-0">
          <TabsList className="bg-transparent h-12 gap-1">
            <TabsTrigger value="chat" className="gap-1.5 text-xs sm:text-sm data-[state=active]:bg-primary/10 data-[state=active]:text-primary">
              <MessageSquare className="w-4 h-4" />
              <span className="hidden sm:inline">المحادثات</span>
              <span className="sm:hidden">الشات</span>
            </TabsTrigger>
            <TabsTrigger value="auto-reply" className="gap-1.5 text-xs sm:text-sm data-[state=active]:bg-primary/10 data-[state=active]:text-primary">
              <Bot className="w-4 h-4" />
              <span className="hidden sm:inline">الرد التلقائي</span>
              <span className="sm:hidden">الرد</span>
            </TabsTrigger>
            <TabsTrigger value="ai-prompt" className="gap-1.5 text-xs sm:text-sm data-[state=active]:bg-primary/10 data-[state=active]:text-primary">
              <Brain className="w-4 h-4" />
              <span className="hidden sm:inline">توجيهات AI</span>
              <span className="sm:hidden">AI</span>
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="chat" className="flex-1 m-0 overflow-hidden">
          {isMobile ? (
            <div className="flex flex-col h-full">
              {!selectedId ? (
                <ChatList
                  conversations={conversations}
                  selectedId={selectedId}
                  onSelect={handleSelect}
                  title="الطلبات المفقودة"
                  tenantId={currentTenant?.id}
                  fullWidth
                  autoSelect={false}
                  currentUserId={user?.id}
                  onBulkUpdateChatStatus={bulkUpdateChatStatus}
                />
              ) : selected ? (
                <div className="flex flex-col h-full">
                  <div className="flex items-center gap-2 px-3 py-2 border-b border-border bg-card flex-shrink-0">
                    <button onClick={handleBack} className="p-2 rounded-lg hover:bg-secondary text-muted-foreground transition-colors">
                      <ArrowRight className="w-5 h-5" />
                    </button>
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <div className="w-8 h-8 rounded-full bg-primary/15 flex items-center justify-center flex-shrink-0">
                        <span className="text-xs font-bold text-primary">{selected.contact.name.charAt(0)}</span>
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-foreground truncate">{selected.contact.name}</p>
                        <p className="text-xs text-muted-foreground truncate" dir="ltr">{selected.contact.phone}</p>
                      </div>
                    </div>
                  </div>
                  <div className="flex-1 overflow-hidden">
                    <ChatWindow
                      {...chatWindowProps(selected)!}
                      onToggleContact={() => setShowContact(true)}
                      hideHeader
                    />
                  </div>
                  <Sheet open={showContact} onOpenChange={setShowContact}>
                    <SheetContent side="right" className="p-0 w-[300px]">
                      <ContactPanel
                        contact={selected.contact}
                        onClose={() => setShowContact(false)}
                        tenantId={currentTenant?.id}
                        conversationDbId={selected.dbId}
                        conversationStatus={selected.status}
                        labels={selected.labels}
                        onContactUpdate={reload}
                        onStatusChange={updateStatus}
                      />
                    </SheetContent>
                  </Sheet>
                </div>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground gap-4 p-8">
                  <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center">
                    <PackageX className="w-8 h-8 text-primary" />
                  </div>
                  <div className="text-center">
                    <p className="font-semibold text-foreground">الطلبات المفقودة</p>
                    <p className="text-sm mt-1">{conversations.length === 0 ? 'لا توجد طلبات مفقودة بعد' : 'اختر محادثة للبدء'}</p>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="flex h-full">
              <ChatList
                conversations={conversations}
                selectedId={selectedId}
                onSelect={handleSelect}
                title="الطلبات المفقودة"
                tenantId={currentTenant?.id}
                currentUserId={user?.id}
                onBulkUpdateChatStatus={bulkUpdateChatStatus}
              />
              {selected ? (
                <>
                  <ChatWindow
                    {...chatWindowProps(selected)!}
                    onToggleContact={() => setShowContact(!showContact)}
                  />
                  {showContact && (
                    <ContactPanel
                      contact={selected.contact}
                      onClose={() => setShowContact(false)}
                      tenantId={currentTenant?.id}
                      conversationDbId={selected.dbId}
                      conversationStatus={selected.status}
                      labels={selected.labels}
                      onContactUpdate={reload}
                      onStatusChange={updateStatus}
                    />
                  )}
                </>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground gap-4">
                  <div className="w-20 h-20 rounded-2xl bg-primary/10 flex items-center justify-center">
                    <PackageX className="w-10 h-10 text-primary" />
                  </div>
                  <div className="text-center">
                    <p className="font-semibold text-foreground text-lg">الطلبات المفقودة</p>
                    <p className="text-sm mt-1">
                      {conversations.length === 0 ? 'لا توجد طلبات مفقودة بعد' : 'اختر محادثة من القائمة للبدء'}
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}
        </TabsContent>

        <TabsContent value="auto-reply" className="flex-1 m-0 overflow-hidden">
          <ConfirmAutoReply module="lost" title="الطلبات المفقودة" />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default LostOrders;
