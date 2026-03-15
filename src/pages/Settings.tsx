import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Shield, MessageSquare, Brain, Store } from 'lucide-react';
import { useTenantContext } from '@/contexts/TenantContext';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import ConfirmSettings from '@/components/confirm/ConfirmSettings';
import AISettings from '@/components/settings/AISettings';
import StoreIntegrationSettings from '@/components/settings/StoreIntegrationSettings';

const Settings = () => {
  const { currentTenant } = useTenantContext();
  const [notifications, setNotifications] = useState(true);

  return (
    <div className="flex flex-col h-full">
      <Tabs defaultValue="general" className="flex flex-col h-full" dir="rtl">
        <div className="border-b border-border bg-card px-2 sm:px-4 flex-shrink-0">
          <TabsList className="bg-transparent h-12 gap-1">
            <TabsTrigger value="general" className="gap-1.5 text-xs sm:text-sm data-[state=active]:bg-primary/10 data-[state=active]:text-primary">
              <Shield className="w-4 h-4" />
              <span className="hidden sm:inline">إعدادات عامة</span>
              <span className="sm:hidden">عام</span>
            </TabsTrigger>
            <TabsTrigger value="whatsapp" className="gap-1.5 text-xs sm:text-sm data-[state=active]:bg-primary/10 data-[state=active]:text-primary">
              <MessageSquare className="w-4 h-4" />
              <span className="hidden sm:inline">الواتساب</span>
              <span className="sm:hidden">واتساب</span>
            </TabsTrigger>
            <TabsTrigger value="store" className="gap-1.5 text-xs sm:text-sm data-[state=active]:bg-primary/10 data-[state=active]:text-primary">
              <Store className="w-4 h-4" />
              <span className="hidden sm:inline">ربط المتجر</span>
              <span className="sm:hidden">المتجر</span>
            </TabsTrigger>
            <TabsTrigger value="ai" className="gap-1.5 text-xs sm:text-sm data-[state=active]:bg-primary/10 data-[state=active]:text-primary">
              <Brain className="w-4 h-4" />
              <span className="hidden sm:inline">الذكاء الاصطناعي</span>
              <span className="sm:hidden">AI</span>
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="general" className="flex-1 m-0 overflow-hidden">
          <div className="p-4 sm:p-6 max-w-3xl mx-auto space-y-4 sm:space-y-6 overflow-y-auto h-full">
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-foreground">الإعدادات العامة</h1>
              <p className="text-sm text-muted-foreground mt-1">
                إعدادات عامة لـ {currentTenant?.name || 'البراند'}
              </p>
            </div>

            <Card className="p-4 sm:p-6 bg-card border-border space-y-5">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                  <Shield className="w-5 h-5 text-primary" />
                </div>
                <h2 className="text-base sm:text-lg font-semibold text-foreground">إعدادات عامة</h2>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-foreground">الإشعارات</p>
                  <p className="text-xs text-muted-foreground">إشعارات عند وصول رسالة جديدة</p>
                </div>
                <Switch checked={notifications} onCheckedChange={setNotifications} />
              </div>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="whatsapp" className="flex-1 m-0 overflow-hidden">
          <ConfirmSettings />
        </TabsContent>

        <TabsContent value="store" className="flex-1 m-0 overflow-hidden">
          <StoreIntegrationSettings />
        </TabsContent>

        <TabsContent value="ai" className="flex-1 m-0 overflow-hidden">
          <AISettings />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Settings;
