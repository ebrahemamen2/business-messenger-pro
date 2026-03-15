import { useState } from 'react';
import { useConversations } from '@/hooks/useConversations';
import { useTenantContext } from '@/contexts/TenantContext';
import { useAuth } from '@/contexts/AuthContext';
import ChatList from '@/components/chat/ChatList';
import ChatWindow from '@/components/chat/ChatWindow';
import ContactPanel from '@/components/chat/ContactPanel';
import { Truck, Loader2, MessageSquare, ArrowRight, Package, Settings2, Table2 } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import AllShipmentsTable from '@/components/followup/AllShipmentsTable';
import FollowupShipmentsTable from '@/components/followup/FollowupShipmentsTable';
import FollowupSettings from '@/components/followup/FollowupSettings';
import { useIsMobile } from '@/hooks/use-mobile';
import { Sheet, SheetContent } from '@/components/ui/sheet';

const FollowUp = () => {
  const { currentTenant } = useTenantContext();
  const { user } = useAuth();
  const { conversations, loading, reload, updateStatus, updateAssignment, selectConversation, loadOlderMessages, togglePin, toggleArchive, bulkUpdateChatStatus, moveConversation } = useConversations(currentTenant?.id, 'followup');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showContact, setShowContact] = useState(false);
  const isMobile = useIsMobile();

  const handleSelect = (id: string) => { setSelectedId(id); selectConversation(id); };
  const handleBack = () => { setSelectedId(null); setShowContact(false); };
  const selected = conversations.find(c => c.id === selectedId);

  if (loading) {
    return <div className="flex items-center justify-center h-full"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  }

  const chatWindowProps = (conv: typeof selected) => conv ? ({
    conversation: conv, module: "followup" as const, tenantId: currentTenant?.id, conversationDbId: conv.dbId,
    onStatusChange: updateStatus, onLoadOlder: loadOlderMessages, allConversations: conversations,
    onTogglePin: togglePin, onToggleArchive: toggleArchive, onAssign: updateAssignment, onMoveConversation: moveConversation,
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
            <TabsTrigger value="all-shipments" className="gap-1.5 text-xs sm:text-sm data-[state=active]:bg-primary/10 data-[state=active]:text-primary">
              <Package className="w-4 h-4" />
              <span className="hidden sm:inline">كل الشحنات</span>
              <span className="sm:hidden">الشحنات</span>
            </TabsTrigger>
            <TabsTrigger value="followup-table" className="gap-1.5 text-xs sm:text-sm data-[state=active]:bg-primary/10 data-[state=active]:text-primary">
              <Table2 className="w-4 h-4" />
              <span className="hidden sm:inline">جدول المتابعة</span>
              <span className="sm:hidden">المتابعة</span>
            </TabsTrigger>
            <TabsTrigger value="settings" className="gap-1.5 text-xs sm:text-sm data-[state=active]:bg-primary/10 data-[state=active]:text-primary">
              <Settings2 className="w-4 h-4" />
              <span className="hidden sm:inline">الإعدادات</span>
              <span className="sm:hidden">⚙️</span>
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="chat" className="flex-1 m-0 overflow-hidden">
          {isMobile ? (
            <div className="flex flex-col h-full">
              {!selectedId ? (
                <ChatList conversations={conversations} selectedId={selectedId} onSelect={handleSelect} title="محادثات المتابعة" tenantId={currentTenant?.id} fullWidth autoSelect={false} currentUserId={user?.id} onBulkUpdateChatStatus={bulkUpdateChatStatus} />
              ) : selected ? (
                <div className="flex flex-col h-full">
                  <div className="flex items-center gap-2 px-3 py-2 border-b border-border bg-card flex-shrink-0">
                    <button onClick={handleBack} className="p-2 rounded-lg hover:bg-secondary text-muted-foreground transition-colors"><ArrowRight className="w-5 h-5" /></button>
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
                    <ChatWindow {...chatWindowProps(selected)!} onToggleContact={() => setShowContact(true)} hideHeader />
                  </div>
                  <Sheet open={showContact} onOpenChange={setShowContact}>
                    <SheetContent side="right" className="p-0 w-[300px]">
                      <ContactPanel contact={selected.contact} onClose={() => setShowContact(false)} tenantId={currentTenant?.id} conversationDbId={selected.dbId} conversationStatus={selected.status} labels={selected.labels} onContactUpdate={reload} onStatusChange={updateStatus} />
                    </SheetContent>
                  </Sheet>
                </div>
              ) : (
                <EmptyState conversations={conversations} />
              )}
            </div>
          ) : (
            <div className="flex h-full">
              <ChatList conversations={conversations} selectedId={selectedId} onSelect={handleSelect} title="محادثات المتابعة" tenantId={currentTenant?.id} currentUserId={user?.id} onBulkUpdateChatStatus={bulkUpdateChatStatus} />
              {selected ? (
                <>
                  <ChatWindow {...chatWindowProps(selected)!} onToggleContact={() => setShowContact(!showContact)} />
                  {showContact && (
                    <ContactPanel contact={selected.contact} onClose={() => setShowContact(false)} tenantId={currentTenant?.id} conversationDbId={selected.dbId} conversationStatus={selected.status} labels={selected.labels} onContactUpdate={reload} onStatusChange={updateStatus} />
                  )}
                </>
              ) : (
                <EmptyState conversations={conversations} />
              )}
            </div>
          )}
        </TabsContent>

        <TabsContent value="all-shipments" className="flex-1 m-0 overflow-hidden">
          <AllShipmentsTable />
        </TabsContent>

        <TabsContent value="followup-table" className="flex-1 m-0 overflow-hidden">
          <FollowupShipmentsTable />
        </TabsContent>

        <TabsContent value="settings" className="flex-1 m-0 overflow-hidden">
          <FollowupSettings />
        </TabsContent>
      </Tabs>
    </div>
  );
};

const EmptyState = ({ conversations }: { conversations: any[] }) => (
  <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground gap-4 p-8">
    <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center">
      <Truck className="w-8 h-8 text-primary" />
    </div>
    <div className="text-center">
      <p className="font-semibold text-foreground">قسم المتابعة</p>
      <p className="text-sm mt-1">{conversations.length === 0 ? 'لا توجد محادثات متابعة بعد' : 'اختر محادثة للبدء'}</p>
    </div>
  </div>
);

export default FollowUp;
