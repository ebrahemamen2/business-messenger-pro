import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Shield } from 'lucide-react';
import { useTenantContext } from '@/contexts/TenantContext';

const Settings = () => {
  const { currentTenant } = useTenantContext();
  const [notifications, setNotifications] = useState(true);

  return (
    <div className="p-4 sm:p-6 max-w-3xl mx-auto space-y-4 sm:space-y-6 overflow-y-auto h-full">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-foreground">الإعدادات العامة</h1>
        <p className="text-sm text-muted-foreground mt-1">
          إعدادات عامة لـ {currentTenant?.name || 'البراند'}
        </p>
        <p className="text-xs text-muted-foreground mt-2 bg-secondary/50 p-3 rounded-xl">
          💡 إعدادات الواتساب والرد التلقائي موجودة داخل كل قسم (التأكيد / المتابعة)
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
  );
};

export default Settings;
