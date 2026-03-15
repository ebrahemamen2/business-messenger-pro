import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useTenantContext } from '@/contexts/TenantContext';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Download, Search, Loader2, Truck, Eye, RefreshCw, Filter, Send,
  CheckCircle, XCircle, Clock, AlertTriangle
} from 'lucide-react';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import * as XLSX from 'xlsx';
import { type Shipment, getStatusColor } from './AllShipmentsTable';

// Internal follow-up action statuses
const FOLLOWUP_ACTIONS: Record<string, { label: string; color: string; icon: any }> = {
  pending: { label: 'بانتظار المتابعة', color: 'bg-yellow-500/15 text-yellow-600 border-yellow-500/30', icon: Clock },
  contacted: { label: 'تم التواصل', color: 'bg-blue-500/15 text-blue-600 border-blue-500/30', icon: Send },
  resolved: { label: 'تم الحل', color: 'bg-green-500/15 text-green-600 border-green-500/30', icon: CheckCircle },
  escalated: { label: 'تصعيد', color: 'bg-red-500/15 text-red-600 border-red-500/30', icon: AlertTriangle },
  cancelled: { label: 'ملغي', color: 'bg-muted text-muted-foreground border-border', icon: XCircle },
};

const FollowupShipmentsTable = () => {
  const { currentTenant } = useTenantContext();
  const { toast } = useToast();
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [followupStatuses, setFollowupStatuses] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [actionFilter, setActionFilter] = useState<string>('all');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [detailShipment, setDetailShipment] = useState<Shipment | null>(null);

  // Load configured followup statuses
  const loadConfig = useCallback(async () => {
    if (!currentTenant?.id) return;
    const { data } = await supabase
      .from('followup_status_config')
      .select('followup_statuses')
      .eq('tenant_id', currentTenant.id)
      .maybeSingle();
    setFollowupStatuses((data?.followup_statuses as string[]) || []);
  }, [currentTenant?.id]);

  const loadShipments = useCallback(async () => {
    if (!currentTenant?.id) { setLoading(false); return; }
    await loadConfig();
    setLoading(true);

    const { data: config } = await supabase
      .from('followup_status_config')
      .select('followup_statuses')
      .eq('tenant_id', currentTenant.id)
      .maybeSingle();

    const statuses = (config?.followup_statuses as string[]) || [];
    if (statuses.length === 0) {
      setShipments([]);
      setLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from('shipment_tracking')
      .select('*')
      .eq('tenant_id', currentTenant.id)
      .in('final_status', statuses)
      .order('uploaded_at', { ascending: false })
      .limit(1000);

    if (error) console.error('Load followup shipments error:', error);
    setShipments((data as Shipment[]) || []);
    setLoading(false);
  }, [currentTenant?.id, loadConfig]);

  useEffect(() => { loadShipments(); }, [loadShipments]);

  const filtered = shipments.filter(s => {
    if (actionFilter !== 'all' && s.status !== actionFilter) return false;
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      s.shipment_code.toLowerCase().includes(q) ||
      (s.order_code || '').toLowerCase().includes(q) ||
      s.customer_phone.includes(q) ||
      (s.customer_name || '').toLowerCase().includes(q)
    );
  });

  const updateAction = async (id: string, newStatus: string) => {
    const { error } = await supabase
      .from('shipment_tracking')
      .update({ status: newStatus } as any)
      .eq('id', id);
    if (!error) {
      setShipments(prev => prev.map(s => s.id === id ? { ...s, status: newStatus } : s));
    }
  };

  const bulkUpdateAction = async (newStatus: string) => {
    if (selectedIds.size === 0) return;
    const ids = Array.from(selectedIds);
    const { error } = await supabase
      .from('shipment_tracking')
      .update({ status: newStatus } as any)
      .in('id', ids);
    if (!error) {
      setShipments(prev => prev.map(s => ids.includes(s.id) ? { ...s, status: newStatus } : s));
      setSelectedIds(new Set());
      toast({ title: '✅ تم التحديث', description: `تم تحديث ${ids.length} شحنة` });
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    setSelectedIds(prev => prev.size === filtered.length ? new Set() : new Set(filtered.map(s => s.id)));
  };

  const exportSheet = () => {
    const exportData = filtered.map(s => ({
      'رقم البوليصة': s.shipment_code,
      'كود الطلب': s.order_code || '',
      'اسم العميل': s.customer_name || '',
      'رقم الهاتف': s.customer_phone,
      'المنطقة': s.customer_area || '',
      'حالة الشحن': s.final_status || '',
      'حالة المتابعة': FOLLOWUP_ACTIONS[s.status]?.label || s.status,
      'المبلغ': s.amount || '',
      'ملاحظات': s.proc_notes || '',
    }));
    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'متابعة');
    XLSX.writeFile(wb, `followup-${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  const actionCounts = filtered.reduce((acc, s) => {
    acc[s.status] = (acc[s.status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="p-3 sm:p-4 border-b border-border bg-card space-y-3 flex-shrink-0">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
              <Truck className="w-4.5 h-4.5 text-primary" />
            </div>
            <div>
              <h2 className="text-base font-bold text-foreground">جدول المتابعة</h2>
              <p className="text-xs text-muted-foreground">{shipments.length} شحنة تحتاج متابعة</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={exportSheet} className="gap-1.5 text-xs">
              <Download className="w-3.5 h-3.5" />
              تصدير
            </Button>
            <Button variant="ghost" size="sm" onClick={loadShipments}>
              <RefreshCw className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>

        {followupStatuses.length === 0 && !loading && (
          <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3 text-xs text-amber-700">
            ⚠️ لم يتم تحديد حالات للمتابعة بعد. اذهب لتاب "الإعدادات" واختار الحالات التي تريد متابعتها.
          </div>
        )}

        {/* Action filter chips */}
        <div className="flex gap-1.5 flex-wrap">
          <button onClick={() => setActionFilter('all')} className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${actionFilter === 'all' ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground hover:text-foreground'}`}>
            الكل ({filtered.length})
          </button>
          {Object.entries(FOLLOWUP_ACTIONS).map(([key, { label }]) => {
            const count = actionCounts[key] || 0;
            if (count === 0) return null;
            return (
              <button key={key} onClick={() => setActionFilter(key)} className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${actionFilter === key ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground hover:text-foreground'}`}>
                {label} ({count})
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <Input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="بحث..." className="bg-secondary border-0 text-xs pr-9 h-8" />
          </div>
          {selectedIds.size > 0 && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="gap-1.5 text-xs">
                  <Filter className="w-3.5 h-3.5" />
                  تحديث ({selectedIds.size})
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {Object.entries(FOLLOWUP_ACTIONS).map(([key, { label }]) => (
                  <DropdownMenuItem key={key} onClick={() => bulkUpdateAction(key)}>{label}</DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        {loading ? (
          <div className="flex items-center justify-center h-full"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-4 text-muted-foreground">
            <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center"><Truck className="w-8 h-8 text-primary" /></div>
            <p className="text-sm font-medium">{followupStatuses.length === 0 ? 'لم يتم تحديد حالات للمتابعة' : 'لا توجد شحنات تحتاج متابعة'}</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="text-xs">
                <TableHead className="w-10 text-center">
                  <input type="checkbox" checked={selectedIds.size === filtered.length && filtered.length > 0} onChange={toggleSelectAll} className="rounded border-border" />
                </TableHead>
                <TableHead className="text-right">البوليصة</TableHead>
                <TableHead className="text-right">العميل</TableHead>
                <TableHead className="text-right">الهاتف</TableHead>
                <TableHead className="text-right">المنطقة</TableHead>
                <TableHead className="text-right">المبلغ</TableHead>
                <TableHead className="text-right">حالة الشحن</TableHead>
                <TableHead className="text-right">حالة المتابعة</TableHead>
                <TableHead className="text-right">ملاحظات</TableHead>
                <TableHead className="text-right w-16">تفاصيل</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map(s => {
                const actionInfo = FOLLOWUP_ACTIONS[s.status] || FOLLOWUP_ACTIONS.pending;
                const ActionIcon = actionInfo.icon;
                const displayStatus = s.final_status || '-';
                return (
                  <TableRow key={s.id} className="text-xs">
                    <TableCell className="text-center">
                      <input type="checkbox" checked={selectedIds.has(s.id)} onChange={() => toggleSelect(s.id)} className="rounded border-border" />
                    </TableCell>
                    <TableCell className="font-mono text-xs">{s.shipment_code}</TableCell>
                    <TableCell className="text-xs">{s.customer_name || '-'}</TableCell>
                    <TableCell className="font-mono text-xs" dir="ltr">{s.customer_phone}</TableCell>
                    <TableCell className="text-xs">{s.customer_area || '-'}</TableCell>
                    <TableCell className="text-xs font-medium">{s.amount ? `${s.amount} ج.م` : '-'}</TableCell>
                    <TableCell>
                      <span className={`px-2 py-0.5 rounded-md text-[10px] font-medium border ${getStatusColor(displayStatus)}`}>
                        {displayStatus}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Select value={s.status} onValueChange={v => updateAction(s.id, v)}>
                        <SelectTrigger className={`h-7 text-[10px] border ${actionInfo.color} bg-transparent w-[130px]`}>
                          <div className="flex items-center gap-1">
                            <ActionIcon className="w-3 h-3" />
                            <span>{actionInfo.label}</span>
                          </div>
                        </SelectTrigger>
                        <SelectContent>
                          {Object.entries(FOLLOWUP_ACTIONS).map(([key, { label }]) => (
                            <SelectItem key={key} value={key} className="text-xs">{label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell className="text-xs max-w-[150px] truncate">{s.proc_notes || '-'}</TableCell>
                    <TableCell>
                      <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => setDetailShipment(s)}>
                        <Eye className="w-3.5 h-3.5" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </div>

      <Dialog open={!!detailShipment} onOpenChange={() => setDetailShipment(null)}>
        <DialogContent className="max-w-lg" dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Truck className="w-5 h-5 text-primary" />تفاصيل شحنة المتابعة</DialogTitle>
          </DialogHeader>
          {detailShipment && (
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <DetailRow label="رقم البوليصة" value={detailShipment.shipment_code} />
                <DetailRow label="كود الطلب" value={detailShipment.order_code} />
                <DetailRow label="اسم العميل" value={detailShipment.customer_name} />
                <DetailRow label="رقم الهاتف" value={detailShipment.customer_phone} dir="ltr" />
                <DetailRow label="المنطقة" value={detailShipment.customer_area} />
                <DetailRow label="المبلغ" value={detailShipment.amount ? `${detailShipment.amount} ج.م` : null} />
                <DetailRow label="حالة الشحن" value={detailShipment.final_status} />
                <DetailRow label="تاريخ آخر حالة" value={detailShipment.last_status_date} />
              </div>
              <DetailRow label="العنوان" value={detailShipment.customer_address} full />
              <DetailRow label="تفاصيل الطلب" value={detailShipment.order_details} full />
              <DetailRow label="ملاحظات الشحن" value={detailShipment.proc_notes} full />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

const DetailRow = ({ label, value, dir, full }: { label: string; value: string | null | undefined; dir?: string; full?: boolean }) => (
  <div className={full ? 'col-span-2' : ''}>
    <p className="text-xs text-muted-foreground mb-0.5">{label}</p>
    <p className={`text-sm font-medium text-foreground ${!value ? 'text-muted-foreground' : ''}`} dir={dir}>{value || '-'}</p>
  </div>
);

export default FollowupShipmentsTable;
