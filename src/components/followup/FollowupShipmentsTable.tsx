import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useTenantContext } from '@/contexts/TenantContext';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Download, Search, Loader2, Truck, Eye, RefreshCw, Filter, Send,
  CheckCircle, XCircle, Clock, AlertTriangle, MessageSquare, Calendar, StickyNote, Check, X,
  ChevronLeft, ChevronRight, Phone, MapPin, Package, ShoppingBag, User, CreditCard, PanelTop, PanelTopClose
} from 'lucide-react';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import * as XLSX from 'xlsx';
import { type Shipment, getStatusColor } from './AllShipmentsTable';
import { type ActionStatus } from './ActionStatusesSettings';

// Default fallback statuses (used when no config exists)
const DEFAULT_FOLLOWUP_ACTIONS: ActionStatus[] = [
  { key: 'pending', label: 'بانتظار المتابعة', color: 'yellow' },
  { key: 'contacted', label: 'تم التواصل', color: 'blue' },
  { key: 'resolved', label: 'تم الحل', color: 'green' },
  { key: 'escalated', label: 'تصعيد', color: 'red' },
  { key: 'cancelled', label: 'ملغي', color: 'gray' },
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

interface WATemplate {
  id: string;
  template_name: string;
  language: string;
  description: string | null;
}

const FollowupShipmentsTable = () => {
  const { currentTenant } = useTenantContext();
  const { toast } = useToast();
  const [shipments, setShipments] = useState<(Shipment & { wa_template_name?: string | null; wa_sent_at?: string | null; notes?: string | null })[]>([]);
  const [followupStatuses, setFollowupStatuses] = useState<string[]>([]);
  const [actionStatuses, setActionStatuses] = useState<ActionStatus[]>(DEFAULT_FOLLOWUP_ACTIONS);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [actionFilter, setActionFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [dateFilter, setDateFilter] = useState<string>('all');
  const [waSentFilter, setWaSentFilter] = useState<string>('all');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [detailShipment, setDetailShipment] = useState<(Shipment & { wa_template_name?: string | null; wa_sent_at?: string | null; notes?: string | null }) | null>(null);
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [noteText, setNoteText] = useState('');

  // WA sending state
  const [waTemplates, setWaTemplates] = useState<WATemplate[]>([]);
  const [showSendDialog, setShowSendDialog] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<string>('');
  const [sending, setSending] = useState(false);
  const [sendResults, setSendResults] = useState<{ sent: number; failed: number } | null>(null);

  // Helper to get action info
  const getActionInfo = useCallback((key: string) => {
    const action = actionStatuses.find(a => a.key === key);
    if (!action) return { label: key, color: COLOR_MAP.gray };
    return { label: action.label, color: COLOR_MAP[action.color] || COLOR_MAP.gray };
  }, [actionStatuses]);

  // Load configured followup statuses
  const loadConfig = useCallback(async () => {
    if (!currentTenant?.id) return;
    const { data } = await supabase
      .from('followup_status_config')
      .select('*')
      .eq('tenant_id', currentTenant.id)
      .maybeSingle();
    setFollowupStatuses(((data as any)?.followup_statuses as string[]) || []);
    const actions = (data as any)?.action_statuses as ActionStatus[] | null;
    if (actions && actions.length > 0) setActionStatuses(actions);
  }, [currentTenant?.id]);

  const loadTemplates = useCallback(async () => {
    if (!currentTenant?.id) return;
    const { data } = await supabase
      .from('followup_wa_templates')
      .select('id, template_name, language, description')
      .eq('tenant_id', currentTenant.id)
      .order('created_at', { ascending: false });
    setWaTemplates((data as WATemplate[]) || []);
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
      .limit(5000);

    if (error) console.error('Load followup shipments error:', error);
    setShipments((data as any[]) || []);
    setLoading(false);
  }, [currentTenant?.id, loadConfig]);

  useEffect(() => { loadShipments(); loadTemplates(); }, [loadShipments, loadTemplates]);

  // Calculate days since last status
  const getDaysSinceLastStatus = (shipment: Shipment): number | null => {
    const dateStr = shipment.last_status_date || shipment.status_date;
    if (!dateStr) return null;
    
    // Try parsing various date formats
    const parsed = new Date(dateStr);
    if (isNaN(parsed.getTime())) {
      // Try DD/MM/YYYY or DD-MM-YYYY
      const parts = dateStr.split(/[\/\-\.]/);
      if (parts.length === 3) {
        const d = new Date(Number(parts[2]), Number(parts[1]) - 1, Number(parts[0]));
        if (!isNaN(d.getTime())) {
          return Math.floor((Date.now() - d.getTime()) / (1000 * 60 * 60 * 24));
        }
      }
      return null;
    }
    return Math.floor((Date.now() - parsed.getTime()) / (1000 * 60 * 60 * 24));
  };

  // Get unique shipping statuses for filter
  const uniqueStatuses = useMemo(() => {
    const statuses = new Set<string>();
    shipments.forEach(s => { if (s.final_status) statuses.add(s.final_status); });
    return Array.from(statuses).sort();
  }, [shipments]);

  const filtered = useMemo(() => {
    return shipments.filter(s => {
      // Action filter
      if (actionFilter !== 'all' && s.status !== actionFilter) return false;
      
      // Status filter (shipping company status)
      if (statusFilter !== 'all' && s.final_status !== statusFilter) return false;
      
      // Date filter
      if (dateFilter !== 'all') {
        const days = getDaysSinceLastStatus(s);
        if (days === null) return dateFilter === 'unknown';
        if (dateFilter === '1' && days > 1) return false;
        if (dateFilter === '2' && days > 2) return false;
        if (dateFilter === '3plus' && days < 3) return false;
      }

      // WA sent filter
      if (waSentFilter === 'sent' && !s.wa_template_sent) return false;
      if (waSentFilter === 'not_sent' && s.wa_template_sent) return false;

      // Search
      if (!searchQuery) return true;
      const q = searchQuery.toLowerCase();
      return (
        s.shipment_code.toLowerCase().includes(q) ||
        (s.order_code || '').toLowerCase().includes(q) ||
        s.customer_phone.includes(q) ||
        (s.customer_name || '').toLowerCase().includes(q) ||
        (s.proc_notes || '').toLowerCase().includes(q)
      );
    });
  }, [shipments, actionFilter, statusFilter, dateFilter, waSentFilter, searchQuery]);

  const updateAction = async (id: string, newStatus: string) => {
    const { error } = await supabase
      .from('shipment_tracking')
      .update({ status: newStatus } as any)
      .eq('id', id);
    if (!error) {
      setShipments(prev => prev.map(s => s.id === id ? { ...s, status: newStatus } : s));
    }
  };

  const startEditNote = (id: string, currentNote: string) => {
    setEditingNoteId(id);
    setNoteText(currentNote || '');
  };

  const saveNote = async (id: string) => {
    const { error } = await supabase
      .from('shipment_tracking')
      .update({ notes: noteText } as any)
      .eq('id', id);
    if (!error) {
      setShipments(prev => prev.map(s => s.id === id ? { ...s, notes: noteText } : s));
      setEditingNoteId(null);
      setNoteText('');
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

  const handleSendWA = async () => {
    if (selectedIds.size === 0 || !selectedTemplate || !currentTenant?.id) return;
    const template = waTemplates.find(t => t.id === selectedTemplate);
    if (!template) return;

    setSending(true);
    setSendResults(null);

    try {
      const { data, error } = await supabase.functions.invoke('send-wa-template', {
        body: {
          shipmentIds: Array.from(selectedIds),
          templateName: template.template_name,
          language: template.language,
          tenantId: currentTenant.id,
        },
      });

      if (error) {
        toast({ title: '❌ خطأ', description: error.message, variant: 'destructive' });
      } else {
        setSendResults({ sent: data.sent, failed: data.failed });
        toast({
          title: data.sent > 0 ? '✅ تم الإرسال' : '⚠️ فشل الإرسال',
          description: `تم إرسال ${data.sent} رسالة${data.failed > 0 ? ` - فشل ${data.failed}` : ''}`,
          variant: data.sent > 0 ? 'default' : 'destructive',
        });

        // Update local state for sent shipments
        if (data.results) {
          const sentIds = new Set(data.results.filter((r: any) => r.success).map((r: any) => r.id));
          const nowIso = new Date().toISOString();
          setShipments(prev => prev.map(s =>
            sentIds.has(s.id)
              ? { ...s, wa_template_sent: true, wa_template_name: template.template_name, wa_sent_at: nowIso }
              : s
          ));
        }
        setSelectedIds(new Set());
      }
    } catch (err) {
      toast({ title: '❌ خطأ', description: 'فشل في الاتصال بالخادم', variant: 'destructive' });
    } finally {
      setSending(false);
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
      'حالة المتابعة': getActionInfo(s.status).label,
      'المبلغ': s.amount || '',
      'ملاحظات الشحن': s.proc_notes || '',
      'ملاحظات المتابعة': s.notes || '',
      'تم إرسال واتساب': s.wa_template_sent ? 'نعم' : 'لا',
      'قالب الواتساب': s.wa_template_name || '',
      'تاريخ الإرسال': s.wa_sent_at ? new Date(s.wa_sent_at).toLocaleString('ar-EG') : '',
    }));
    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'متابعة');
    XLSX.writeFile(wb, `followup-${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  const actionCounts = useMemo(() => {
    return filtered.reduce((acc, s) => {
      acc[s.status] = (acc[s.status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
  }, [filtered]);

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
              <p className="text-xs text-muted-foreground">{shipments.length} شحنة تحتاج متابعة — عرض {filtered.length}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {selectedIds.size > 0 && waTemplates.length > 0 && (
              <Button size="sm" onClick={() => { setShowSendDialog(true); setSendResults(null); }} className="gap-1.5 text-xs bg-green-600 hover:bg-green-700 text-white">
                <MessageSquare className="w-3.5 h-3.5" />
                إرسال واتساب ({selectedIds.size})
              </Button>
            )}
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

        {/* Filters row */}
        <div className="flex gap-2 flex-wrap items-center">
          {/* Date filter */}
          <Select value={dateFilter} onValueChange={setDateFilter}>
            <SelectTrigger className="h-7 text-[10px] w-auto min-w-[120px] bg-secondary border-0">
              <Calendar className="w-3 h-3 ml-1" />
              <SelectValue placeholder="التاريخ" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all" className="text-xs">كل التواريخ</SelectItem>
              <SelectItem value="1" className="text-xs">خلال يوم</SelectItem>
              <SelectItem value="2" className="text-xs">خلال يومين</SelectItem>
              <SelectItem value="3plus" className="text-xs">3 أيام أو أكتر</SelectItem>
              <SelectItem value="unknown" className="text-xs">بدون تاريخ</SelectItem>
            </SelectContent>
          </Select>

          {/* Shipping status filter */}
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="h-7 text-[10px] w-auto min-w-[130px] bg-secondary border-0">
              <Filter className="w-3 h-3 ml-1" />
              <SelectValue placeholder="حالة الشحن" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all" className="text-xs">كل الحالات</SelectItem>
              {uniqueStatuses.map(s => (
                <SelectItem key={s} value={s} className="text-xs">{s}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* WA sent filter */}
          <Select value={waSentFilter} onValueChange={setWaSentFilter}>
            <SelectTrigger className="h-7 text-[10px] w-auto min-w-[120px] bg-secondary border-0">
              <MessageSquare className="w-3 h-3 ml-1" />
              <SelectValue placeholder="الواتساب" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all" className="text-xs">الكل</SelectItem>
              <SelectItem value="sent" className="text-xs">✅ اتبعتله</SelectItem>
              <SelectItem value="not_sent" className="text-xs">❌ ماتبعتلهوش</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Action filter chips */}
        <div className="flex gap-1.5 flex-wrap">
          <button onClick={() => setActionFilter('all')} className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${actionFilter === 'all' ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground hover:text-foreground'}`}>
            الكل ({filtered.length})
          </button>
          {actionStatuses.map(({ key, label }) => {
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
            <Input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="بحث بالبوليصة أو الاسم أو الرقم أو الملاحظات..." className="bg-secondary border-0 text-xs pr-9 h-8" />
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
                {actionStatuses.map(({ key, label }) => (
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
                <TableHead className="text-right">واتساب</TableHead>
                <TableHead className="text-right">ملاحظات</TableHead>
                <TableHead className="text-right w-16">تفاصيل</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map(s => {
                const actionInfo = getActionInfo(s.status);
                const displayStatus = s.final_status || '-';
                const days = getDaysSinceLastStatus(s);
                return (
                  <TableRow key={s.id} className="text-xs">
                    <TableCell className="text-center">
                      <input type="checkbox" checked={selectedIds.has(s.id)} onChange={() => toggleSelect(s.id)} className="rounded border-border" />
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      <div>{s.shipment_code}</div>
                      {days !== null && (
                        <span className={`text-[9px] ${days >= 3 ? 'text-destructive font-semibold' : days >= 2 ? 'text-amber-600' : 'text-muted-foreground'}`}>
                          منذ {days} يوم
                        </span>
                      )}
                    </TableCell>
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
                          <span>{actionInfo.label}</span>
                        </SelectTrigger>
                        <SelectContent>
                          {actionStatuses.map(({ key, label }) => (
                            <SelectItem key={key} value={key} className="text-xs">{label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      {s.wa_template_sent ? (
                        <div className="text-[10px]">
                          <span className="text-green-600 font-medium">✅ اتبعت</span>
                          {s.wa_template_name && <p className="text-muted-foreground truncate max-w-[80px]">{s.wa_template_name}</p>}
                          {s.wa_sent_at && <p className="text-muted-foreground">{new Date(s.wa_sent_at).toLocaleDateString('ar-EG')}</p>}
                        </div>
                      ) : (
                        <span className="text-[10px] text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell className="max-w-[180px]">
                      {editingNoteId === s.id ? (
                        <div className="flex items-center gap-1">
                          <Input
                            value={noteText}
                            onChange={e => setNoteText(e.target.value)}
                            onKeyDown={e => { if (e.key === 'Enter') saveNote(s.id); if (e.key === 'Escape') setEditingNoteId(null); }}
                            className="h-7 text-xs flex-1"
                            dir="auto"
                            autoFocus
                          />
                          <button onClick={() => saveNote(s.id)} className="p-1 rounded hover:bg-green-500/10 text-green-600"><Check className="w-3.5 h-3.5" /></button>
                          <button onClick={() => setEditingNoteId(null)} className="p-1 rounded hover:bg-destructive/10 text-muted-foreground"><X className="w-3.5 h-3.5" /></button>
                        </div>
                      ) : (
                        <button
                          onClick={() => startEditNote(s.id, s.notes || '')}
                          className="text-xs text-right w-full truncate block hover:bg-secondary rounded px-1 py-0.5 transition-colors"
                          title={s.notes || 'اضغط لإضافة ملاحظة'}
                        >
                          {s.notes || <span className="text-muted-foreground">+ ملاحظة</span>}
                        </button>
                      )}
                    </TableCell>
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

      {/* Detail dialog */}
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
              {detailShipment.wa_template_sent && (
                <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-3 space-y-1">
                  <p className="text-xs font-semibold text-green-700">✅ تم إرسال واتساب</p>
                  {detailShipment.wa_template_name && <p className="text-xs text-green-600">القالب: {detailShipment.wa_template_name}</p>}
                  {detailShipment.wa_sent_at && <p className="text-xs text-green-600">التاريخ: {new Date(detailShipment.wa_sent_at).toLocaleString('ar-EG')}</p>}
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Send WA dialog */}
      <Dialog open={showSendDialog} onOpenChange={setShowSendDialog}>
        <DialogContent dir="rtl" className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><MessageSquare className="w-5 h-5 text-green-600" />إرسال واتساب جماعي</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">سيتم إرسال قالب واتساب لـ <span className="font-bold text-foreground">{selectedIds.size}</span> شحنة محددة</p>
            
            {waTemplates.length === 0 ? (
              <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3 text-xs text-amber-700">
                ⚠️ لا توجد قوالب واتساب. اذهب للإعدادات → قوالب واتساب لإضافة قوالب أولاً.
              </div>
            ) : (
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">اختار القالب</label>
                <Select value={selectedTemplate} onValueChange={setSelectedTemplate}>
                  <SelectTrigger><SelectValue placeholder="اختار قالب..." /></SelectTrigger>
                  <SelectContent>
                    {waTemplates.map(t => (
                      <SelectItem key={t.id} value={t.id} className="text-xs">
                        <span className="font-mono">{t.template_name}</span>
                        <span className="text-muted-foreground mr-2">({t.language})</span>
                        {t.description && <span className="text-muted-foreground"> - {t.description}</span>}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {sendResults && (
              <div className={`rounded-lg p-3 text-xs border ${sendResults.sent > 0 ? 'bg-green-500/10 border-green-500/30 text-green-700' : 'bg-destructive/10 border-destructive/30 text-destructive'}`}>
                ✅ تم إرسال {sendResults.sent} رسالة{sendResults.failed > 0 && ` — ❌ فشل ${sendResults.failed}`}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSendDialog(false)}>إلغاء</Button>
            <Button
              onClick={handleSendWA}
              disabled={sending || !selectedTemplate || waTemplates.length === 0}
              className="gap-1.5 bg-green-600 hover:bg-green-700 text-white"
            >
              {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              إرسال
            </Button>
          </DialogFooter>
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
