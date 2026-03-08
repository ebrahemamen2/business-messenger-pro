import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { RefreshCw, Activity } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface WebhookLog {
  id: string;
  created_at: string;
  event_type: string;
  phones: string[];
  message_count: number;
  error: string | null;
  status: string;
}

const WebhookDiagnostics = () => {
  const [logs, setLogs] = useState<WebhookLog[]>([]);
  const [loading, setLoading] = useState(false);

  const loadLogs = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('webhook_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(20);
    setLogs((data as WebhookLog[]) || []);
    setLoading(false);
  };

  useEffect(() => {
    loadLogs();
  }, []);

  return (
    <Card className="p-6 bg-card border-border">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <Activity className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-foreground">سجل أحداث الويبهوك</h2>
            <p className="text-xs text-muted-foreground">آخر 20 حدث وارد من Meta</p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={loadLogs} disabled={loading} className="gap-2">
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          تحديث
        </Button>
      </div>

      {logs.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground text-sm">
          لا توجد أحداث مسجلة بعد. عند إرسال رسالة للرقم، سيظهر الحدث هنا.
        </div>
      ) : (
        <div className="space-y-2 max-h-[400px] overflow-y-auto">
          {logs.map((log) => (
            <div
              key={log.id}
              className="flex items-center justify-between p-3 rounded-lg bg-secondary/50 text-sm"
            >
              <div className="flex items-center gap-3 min-w-0">
                <Badge
                  variant={log.status === 'ok' ? 'default' : 'destructive'}
                  className="text-[10px] flex-shrink-0"
                >
                  {log.event_type}
                </Badge>
                <div className="min-w-0">
                  {log.phones?.length > 0 && (
                    <span className="text-foreground font-mono text-xs" dir="ltr">
                      {log.phones.join(', ')}
                    </span>
                  )}
                  {log.error && (
                    <p className="text-destructive text-xs truncate">{log.error}</p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                {log.message_count > 0 && (
                  <Badge variant="secondary" className="text-[10px]">
                    {log.message_count} رسالة
                  </Badge>
                )}
                <span className="text-muted-foreground text-[11px]" dir="ltr">
                  {new Date(log.created_at).toLocaleString('ar-EG', {
                    hour: '2-digit',
                    minute: '2-digit',
                    day: '2-digit',
                    month: '2-digit',
                  })}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
};

export default WebhookDiagnostics;
