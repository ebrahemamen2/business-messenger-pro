import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useTenantContext } from '@/contexts/TenantContext';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Search, Loader2, RefreshCw, CheckCircle2, Check, X, Download, Eye,
} from 'lucide-react';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import * as XLSX from 'xlsx';
import { getStatusColor } from './AllShipmentsTable';
import { type ActionStatus } from './ActionStatusesSettings';

const DONE_STATUSES: ActionStatus[] = [
  { key: 'pending', label: 'بانتظار التأكيد', color: 'yellow' },
  { key: 'verified', label: 'تم التأكد', color: 'green' },
  { key: 'issue', label: 'مشكلة - متابعة', color: 'red' },
  { key: 're_followup', label: 'إعادة متابعة', color: 'orange' },
];

const COLOR_MAP: Record<string, string> = {
  yellow: 'bg-yellow-500/15 text-yellow-600 border-yellow-500/30',
  blue: 'bg-blue-500/15 text-blue-600 border-blue-500/30',
  green: 'bg-green-500/15 text-green-600 border-green-500/30',
  red: 'bg-red-500/15 text-red-600 border-red-500/30',
  orange: 'bg-orange-500/15 text-orange-600 border-orange-500/30',
  purple: 'bg-purple-500/15 text-purple-600 border-purple-500/30',
  gray: 'bg-muted text-muted-foreground border-border',
  pink: 'bg-pink-500/15 text-pink-600 border-pink-500/30',
  teal: 'bg-teal-500/15 text-teal-600 border-teal-500/30',
};

interface HistoryRecord {
  id: string;
  shipment_id: string;
  tenant_id: string;
  action_status: string;
  notes: string | null;
  final_status_snapshot: string | null;
  done_status: string;
  done_notes: string | null;
  created_at: string;
  // joined from shipment_tracking
  shipment_code?: string;
  current_final_status?: string | null;
  customer_name?: string | null;
  customer_phone?: string;
}

const DoneShipmentsTable = () => {
  const { currentTenant } = useTenantContext();
  const { toast } = useToast();
  const [records, setRecords] = useState<HistoryRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [doneFilter, setDoneFilter] = useState<string>('all');
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [noteText, setNoteText] = useState('');
  const [detailRecord, setDetailRecord] = useState<HistoryRecord | null>(null);
  const [actionStatuses, setActionStatuses] = useState<ActionStatus[]>([]);

  const loadRecords = useCallback(async () => {
    if (!currentTenant?.id) { setLoading(false); return; }
    setLoading(true);

    // Load action statuses config to get label mapping
    const { data: config } = await supabase
      .from('followup_status_config')
      .select('action_statuses')
      .eq('tenant_id', currentTenant.id)
      .maybeSingle();
    const actions = (config?.action_statuses as unknown as ActionStatus[] | null) || [];
    setActionStatuses(actions);

    // Load history records with shipment data
    const { data, error } = await supabase
      .from('shipment_followup_history')
      .select('*, shipment_tracking!inner(shipment_code, final_status, customer_name, customer_phone)')
      .eq('tenant_id', currentTenant.id)
      .order('created_at', { ascending: false })
      .limit(2000);

    if (error) {
      console.error('Load done records error:', error);
      setRecords([]);
    } else {
      const mapped = (data || []).map((r: any) => ({
        id: r.id,
        shipment_id: r.shipment_id,
        tenant_id: r.tenant_id,
        action_status: r.action_status,
        notes: r.notes,
        final_status_snapshot: r.final_status_snapshot,
        done_status: r.done_status,
        done_notes: r.done_notes,
        created_at: r.created_at,
        shipment_code: r.shipment_tracking?.shipment_code,
        current_final_status: r.shipment_tracking?.final_status,
        customer_name: r.shipment_tracking?.customer_name,
        customer_phone: r.shipment_tracking?.customer_phone,
      }));
      setRecords(mapped);
    }
    setLoading(false);
  }, [currentTenant?.id]);

  useEffect(() => { loadRecords(); }, [loadRecords]);

  const getActionLabel = (key: string) => {
    return actionStatuses.find(a => a.key === key)?.label || key;
  };

  const getDoneInfo = (key: string) => {
    const s = DONE_STATUSES.find(d => d.key === key);
    if (!s) return { label: key, color: COLOR_MAP.gray };
    return { label: s.label, color: COLOR_MAP[s.color] || COLOR_MAP.gray };
  };

  // Check if current status differs from snapshot (potential issue)
  const hasStatusMismatch = (record: HistoryRecord) => {
    if (!record.final_status_snapshot || !record.current_final_status) return false;
    return record.final_status_snapshot !== record.current_final_status;
  };

  const filtered = useMemo(() => {
    return records.filter(r => {
      if (doneFilter !== 'all' && r.done_status !== doneFilter) return false;
      if (!searchQuery) return true;
      const q = searchQuery.toLowerCase();
      return (
        (r.shipment_code || '').toLowerCase().includes(q) ||
        (r.notes || '').toLowerCase().includes(q) ||
        (r.customer_name || '').toLowerCase().includes(q) ||
        (r.customer_phone || '').includes(q)
      );
    });
  }, [records, doneFilter, searchQuery]);

  const updateDoneStatus = async (id: string, newStatus: string) => {
    const { error } = await supabase
      .from('shipment_followup_history')
      .update({ done_status: newStatus } as any)
      .eq('id', id);
    if (!error) {
      setRecords(prev => prev.map(r => r.id === id ? { ...r, done_status: newStatus } : r));
    }
  };

  const saveDoneNote = async (id: string) => {
    const { error } = await supabase
      .from('shipment_followup_history')
      .update({ done_notes: noteText } as any)
      .eq('id', id);
    if (!error) {
      setRecords(prev => prev.map(r => r.id === id ? { ...r, done_notes: noteText } : r));
      setEditingNoteId(null);
      setNoteText('');
    }
  };

  const exportSheet = () => {
    const exportData = filtered.map(r => ({
      'التاريخ': new Date(r.created_at).toLocaleDateString('ar-EG'),
      'رقم البوليصة': r.shipment_code || '',
      'العميل': r.customer_name || '',
      'الهاتف': r.customer_phone || '',
      'حالة المتابعة': getActionLabel(r.action_status),
      'الملاحظة': r.notes || '',
      'حالة الشحن وقت المتابعة': r.final_status_snapshot || '',
      'حالة الشحن الحالية': r.current_final_status || '',
      'حالة Done': getDoneInfo(r.done_status).label,
      'ملاحظة Done': r.done_notes || '',
    }));
    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Done');
    XLSX.writeFile(wb, `done-${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  const doneCounts = useMemo(() => {
    return records.reduce((acc, r) => {
      acc[r.done_status] = (acc[r.done_status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
  }, [records]);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="p-3 sm:p-4 border-b border-border bg-card space-y-2 flex-shrink-0">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-green-500/10 flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4 text-green-600" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-foreground">سجل المتابعات المكتملة</h2>
              <p className="text-[10px] text-muted-foreground">{records.length} سجل — عرض {filtered.length}</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <Button variant="outline" size="sm" onClick={exportSheet} className="gap-1 text-xs h-8">
              <Download className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">تصدير</span>
            </Button>
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={loadRecords}>
              <RefreshCw className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <div className="relative flex-1">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <Input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="بحث بالبوليصة أو الاسم أو الرقم..." className="bg-secondary border-0 text-xs pr-9 h-7" />
          </div>
          <div className="flex gap-1 flex-wrap">
            <button onClick={() => setDoneFilter('all')} className={`px-2 py-0.5 rounded-md text-[10px] font-medium transition-colors ${doneFilter === 'all' ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground hover:text-foreground'}`}>
              الكل ({records.length})
            </button>
            {DONE_STATUSES.map(s => {
              const count = doneCounts[s.key] || 0;
              return (
                <button key={s.key} onClick={() => setDoneFilter(s.key)} className={`px-2 py-0.5 rounded-md text-[10px] font-medium transition-colors ${doneFilter === s.key ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground hover:text-foreground'}`}>
                  {s.label} ({count})
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        {loading ? (
          <div className="flex items-center justify-center h-full"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-4 text-muted-foreground">
            <div className="w-16 h-16 rounded-2xl bg-green-500/10 flex items-center justify-center"><CheckCircle2 className="w-8 h-8 text-green-600" /></div>
            <p className="text-sm font-medium">لا توجد سجلات متابعة مكتملة</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="text-xs">
                <TableHead className="text-right">التاريخ</TableHead>
                <TableHead className="text-right">البوليصة</TableHead>
                <TableHead className="text-right">العميل</TableHead>
                <TableHead className="text-right">ملاحظة المتابعة</TableHead>
                <TableHead className="text-right">حالة الشحن الحالية</TableHead>
                <TableHead className="text-right">حالة Done</TableHead>
                <TableHead className="text-right">ملاحظة Done</TableHead>
                <TableHead className="text-right w-16">تفاصيل</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map(r => {
                const doneInfo = getDoneInfo(r.done_status);
                const mismatch = hasStatusMismatch(r);
                return (
                  <TableRow key={r.id} className={`text-xs ${mismatch ? 'bg-amber-500/5' : ''}`}>
                    <TableCell className="text-xs whitespace-nowrap">
                      {new Date(r.created_at).toLocaleDateString('ar-EG')}
                    </TableCell>
                    <TableCell className="font-mono text-xs">{r.shipment_code || '-'}</TableCell>
                    <TableCell className="text-xs">{r.customer_name || '-'}</TableCell>
                    <TableCell className="text-xs max-w-[180px] truncate" title={r.notes || ''}>
                      {r.notes || '-'}
                    </TableCell>
                    <TableCell>
                      <div className="space-y-0.5">
                        <span className={`px-2 py-0.5 rounded-md text-[10px] font-medium border ${getStatusColor(r.current_final_status || '-')}`}>
                          {r.current_final_status || '-'}
                        </span>
                        {mismatch && (
                          <p className="text-[9px] text-amber-600">
                            ⚠️ كانت: {r.final_status_snapshot}
                          </p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Select value={r.done_status} onValueChange={v => updateDoneStatus(r.id, v)}>
                        <SelectTrigger className={`h-7 text-[10px] border ${doneInfo.color} bg-transparent w-[130px]`}>
                          <span>{doneInfo.label}</span>
                        </SelectTrigger>
                        <SelectContent>
                          {DONE_STATUSES.map(s => (
                            <SelectItem key={s.key} value={s.key} className="text-xs">{s.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell className="max-w-[180px]">
                      {editingNoteId === r.id ? (
                        <div className="flex items-center gap-1">
                          <Input
                            value={noteText}
                            onChange={e => setNoteText(e.target.value)}
                            onKeyDown={e => { if (e.key === 'Enter') saveDoneNote(r.id); if (e.key === 'Escape') setEditingNoteId(null); }}
                            className="h-7 text-xs flex-1"
                            dir="auto"
                            autoFocus
                          />
                          <button onClick={() => saveDoneNote(r.id)} className="p-1 rounded hover:bg-green-500/10 text-green-600"><Check className="w-3.5 h-3.5" /></button>
                          <button onClick={() => setEditingNoteId(null)} className="p-1 rounded hover:bg-destructive/10 text-muted-foreground"><X className="w-3.5 h-3.5" /></button>
                        </div>
                      ) : (
                        <button
                          onClick={() => { setEditingNoteId(r.id); setNoteText(r.done_notes || ''); }}
                          className="text-xs text-right w-full truncate block hover:bg-secondary rounded px-1 py-0.5 transition-colors"
                          title={r.done_notes || 'اضغط لإضافة ملاحظة'}
                        >
                          {r.done_notes || <span className="text-muted-foreground">+ ملاحظة</span>}
                        </button>
                      )}
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => setDetailRecord(r)}>
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

      {/* Detail dialog */}
      <Dialog open={!!detailRecord} onOpenChange={() => setDetailRecord(null)}>
        <DialogContent className="max-w-lg" dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><CheckCircle2 className="w-5 h-5 text-green-600" />تفاصيل سجل المتابعة</DialogTitle>
          </DialogHeader>
          {detailRecord && (
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-xs text-muted-foreground mb-0.5">التاريخ</p>
                  <p className="text-sm font-medium">{new Date(detailRecord.created_at).toLocaleString('ar-EG')}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-0.5">رقم البوليصة</p>
                  <p className="text-sm font-medium font-mono">{detailRecord.shipment_code || '-'}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-0.5">العميل</p>
                  <p className="text-sm font-medium">{detailRecord.customer_name || '-'}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-0.5">الهاتف</p>
                  <p className="text-sm font-medium font-mono" dir="ltr">{detailRecord.customer_phone || '-'}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-0.5">حالة المتابعة وقتها</p>
                  <p className="text-sm font-medium">{getActionLabel(detailRecord.action_status)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-0.5">حالة الشحن وقت المتابعة</p>
                  <span className={`px-2 py-0.5 rounded-md text-[10px] font-medium border ${getStatusColor(detailRecord.final_status_snapshot || '-')}`}>
                    {detailRecord.final_status_snapshot || '-'}
                  </span>
                </div>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-0.5">ملاحظة المتابعة</p>
                <p className="text-sm font-medium">{detailRecord.notes || '-'}</p>
              </div>
              {hasStatusMismatch(detailRecord) && (
                <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3 text-xs text-amber-700">
                  ⚠️ حالة الشحن اتغيرت من <strong>{detailRecord.final_status_snapshot}</strong> لـ <strong>{detailRecord.current_final_status}</strong>
                </div>
              )}
              <div>
                <p className="text-xs text-muted-foreground mb-0.5">حالة الشحن الحالية</p>
                <span className={`px-2 py-0.5 rounded-md text-[10px] font-medium border ${getStatusColor(detailRecord.current_final_status || '-')}`}>
                  {detailRecord.current_final_status || '-'}
                </span>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default DoneShipmentsTable;
