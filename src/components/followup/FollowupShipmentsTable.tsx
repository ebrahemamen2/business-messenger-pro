import { useState, useEffect, useCallback, useMemo, useRef, Fragment } from 'react';
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
  ChevronLeft, ChevronRight, Phone, MapPin, Package, ShoppingBag, User, CreditCard, PanelTop, PanelTopClose,
  History, ChevronDown, ListFilter
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
import {
  Popover, PopoverContent, PopoverTrigger,
} from '@/components/ui/popover';
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
  const [statusDescFilter, setStatusDescFilter] = useState<string>('all');
  const [dateFilter, setDateFilter] = useState<string>('all');
  const [waSentFilter, setWaSentFilter] = useState<string>('all');
  const [notesFilter, setNotesFilter] = useState<string>('all');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [detailShipment, setDetailShipment] = useState<(Shipment & { wa_template_name?: string | null; wa_sent_at?: string | null; notes?: string | null }) | null>(null);
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [noteText, setNoteText] = useState('');

  // Navigator card state
  const [cardVisible, setCardVisible] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [cardFilter, setCardFilter] = useState<'all' | 'pending'>('all');
  const [showFilters, setShowFilters] = useState(false);
  const [cardNoteText, setCardNoteText] = useState('');
  const [editingCardNote, setEditingCardNote] = useState(false);
  const rowRefs = useRef<Map<string, HTMLTableRowElement>>(new Map());
  const [lastHistory, setLastHistory] = useState<Record<string, { action_status: string; notes: string | null; created_at: string } | null>>({});
  // WA sending state
  const [waTemplates, setWaTemplates] = useState<WATemplate[]>([]);
  const [showSendDialog, setShowSendDialog] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<string>('');
  const [sending, setSending] = useState(false);
  const [sendResults, setSendResults] = useState<{ sent: number; failed: number } | null>(null);

  // Helper to get action info
  const getActionInfo = useCallback((key: string) => {
    if (!key) return { label: '', color: '' };
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

  // Get tenant timezone
  const tenantTimezone = currentTenant?.timezone || 'Africa/Cairo';

  const createStrictDate = useCallback((year: number, month: number, day: number): Date | null => {
    if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return null;
    if (month < 1 || month > 12 || day < 1 || day > 31) return null;

    const date = new Date(year, month - 1, day);
    if (
      date.getFullYear() !== year ||
      date.getMonth() !== month - 1 ||
      date.getDate() !== day
    ) {
      return null;
    }

    return date;
  }, []);

  // Parse shipping sheet date safely (without ambiguous UTC/MM-DD parsing)
  const parseSheetDate = useCallback((rawValue: string | null | undefined): Date | null => {
    if (!rawValue) return null;
    const value = String(rawValue).trim();
    if (!value) return null;

    // ISO date only: YYYY-MM-DD
    let match = value.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
    if (match) {
      return createStrictDate(Number(match[1]), Number(match[2]), Number(match[3]));
    }

    // Day-first from shipping sheets: DD/MM/YYYY or DD-MM-YYYY or DD.MM.YYYY
    match = value.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})$/);
    if (match) {
      return createStrictDate(Number(match[3]), Number(match[2]), Number(match[1]));
    }

    // Year-first variants: YYYY/MM/DD or YYYY.MM.DD
    match = value.match(/^(\d{4})[\/\-.](\d{1,2})[\/\-.](\d{1,2})$/);
    if (match) {
      return createStrictDate(Number(match[1]), Number(match[2]), Number(match[3]));
    }

    // ISO datetime / timestamp
    if (/^\d{4}-\d{2}-\d{2}T/.test(value)) {
      const date = new Date(value);
      if (!Number.isNaN(date.getTime())) {
        return createStrictDate(date.getFullYear(), date.getMonth() + 1, date.getDate());
      }
    }

    return null;
  }, [createStrictDate]);

  // Get "today" in tenant timezone as calendar date (midnight)
  const getTenantToday = useCallback(() => {
    const dateStr = new Date().toLocaleDateString('en-CA', { timeZone: tenantTimezone });
    const [year, month, day] = dateStr.split('-').map(Number);
    return createStrictDate(year, month, day) ?? new Date(year, month - 1, day);
  }, [tenantTimezone, createStrictDate]);

  // Calculate days since last shipping-company status date
  const getDaysSinceLastStatus = useCallback((shipment: Shipment): number | null => {
    const statusDate = parseSheetDate(shipment.last_status_date) ?? parseSheetDate(shipment.status_date);
    if (!statusDate) return null;

    const today = getTenantToday();
    const statusUtc = Date.UTC(statusDate.getFullYear(), statusDate.getMonth(), statusDate.getDate());
    const todayUtc = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
    return Math.floor((todayUtc - statusUtc) / (1000 * 60 * 60 * 24));
  }, [getTenantToday, parseSheetDate]);

  // Get recency group label
  const getRecencyGroup = useCallback((days: number | null): string => {
    if (days === null) return 'unknown';
    if (days <= 0) return 'today';
    if (days === 1) return 'day1';
    if (days === 2) return 'day2';
    return 'day3plus';
  }, []);

  const RECENCY_LABELS: Record<string, string> = {
    'today': '🟢 جديدة - اليوم',
    'day1': '🟡 أول يوم',
    'day2': '🟠 تاني يوم',
    'day3plus': '🔴 3 أيام أو أكتر',
    'unknown': '⚪ بدون تاريخ',
  };

  const RECENCY_ORDER = ['day3plus', 'day2', 'day1', 'today', 'unknown'];

  // Get unique shipping statuses for filter
  const uniqueStatuses = useMemo(() => {
    const statuses = new Set<string>();
    shipments.forEach(s => { if (s.final_status) statuses.add(s.final_status); });
    return Array.from(statuses).sort();
  }, [shipments]);

  const uniqueStatusDescs = useMemo(() => {
    const descs = new Set<string>();
    shipments.forEach(s => { if (s.proc_notes) descs.add(s.proc_notes); });
    return Array.from(descs).sort();
  }, [shipments]);

  const filtered = useMemo(() => {
    return shipments.filter(s => {
      // Action filter
      if (actionFilter === '__none__' && s.status !== '' && s.status !== null) return false;
      if (actionFilter !== 'all' && actionFilter !== '__none__' && s.status !== actionFilter) return false;
      
      // Shipping company notes filter (proc_notes)
      if (statusDescFilter !== 'all' && (s.proc_notes || '') !== statusDescFilter) return false;

      // Notes filter
      if (notesFilter === 'has_notes' && !s.notes) return false;
      if (notesFilter === 'no_notes' && s.notes) return false;

      // Status filter (shipping company status)
      if (statusFilter !== 'all' && s.final_status !== statusFilter) return false;
      
      // Date filter (recency group)
      if (dateFilter !== 'all') {
        const days = getDaysSinceLastStatus(s);
        const group = getRecencyGroup(days);
        if (dateFilter !== group) return false;
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
  }, [shipments, actionFilter, statusFilter, statusDescFilter, notesFilter, dateFilter, waSentFilter, searchQuery]);

  // Group filtered shipments by recency
  const groupedFiltered = useMemo(() => {
    const groups: { group: string; label: string; shipments: typeof filtered }[] = [];
    const groupMap = new Map<string, typeof filtered>();
    
    filtered.forEach(s => {
      const days = getDaysSinceLastStatus(s);
      const group = getRecencyGroup(days);
      if (!groupMap.has(group)) groupMap.set(group, []);
      groupMap.get(group)!.push(s);
    });

    RECENCY_ORDER.forEach(g => {
      if (groupMap.has(g)) {
        groups.push({ group: g, label: RECENCY_LABELS[g], shipments: groupMap.get(g)! });
      }
    });

    return groups;
  }, [filtered, getDaysSinceLastStatus, getRecencyGroup]);

  // Recency counts for filter
  const recencyCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    filtered.forEach(s => {
      const days = getDaysSinceLastStatus(s);
      const group = getRecencyGroup(days);
      counts[group] = (counts[group] || 0) + 1;
    });
    return counts;
  }, [filtered, getDaysSinceLastStatus, getRecencyGroup]);

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

  // Flat list sorted by recency (oldest first, matching table group order)
  const filteredByRecency = useMemo(() => {
    const orderMap: Record<string, number> = {};
    RECENCY_ORDER.forEach((g, i) => { orderMap[g] = i; });
    return [...filtered].sort((a, b) => {
      const ga = getRecencyGroup(getDaysSinceLastStatus(a));
      const gb = getRecencyGroup(getDaysSinceLastStatus(b));
      return (orderMap[ga] ?? 99) - (orderMap[gb] ?? 99);
    });
  }, [filtered, getDaysSinceLastStatus, getRecencyGroup]);

  // Navigator card filtered list
  const cardFiltered = useMemo(() => {
    if (cardFilter === 'pending') return filteredByRecency.filter(s => !s.status || s.status === '' || s.status === 'pending');
    return filteredByRecency;
  }, [filteredByRecency, cardFilter]);

  const activeShipment = cardFiltered[activeIndex] || null;

  // Sync card note text when active shipment changes + load history
  useEffect(() => {
    if (activeShipment) {
      setCardNoteText(activeShipment.notes || '');
      setEditingCardNote(false);
      // Fetch last history for this shipment
      if (!lastHistory[activeShipment.id]) {
        supabase
          .from('shipment_followup_history')
          .select('action_status, notes, created_at')
          .eq('shipment_id', activeShipment.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .then(({ data }) => {
            if (data && data.length > 0) {
              setLastHistory(prev => ({ ...prev, [activeShipment.id]: data[0] as any }));
            } else {
              setLastHistory(prev => ({ ...prev, [activeShipment.id]: null }));
            }
          });
      }
    }
  }, [activeShipment?.id]);

  // Auto-scroll to active row
  useEffect(() => {
    if (cardVisible && activeShipment) {
      const row = rowRefs.current.get(activeShipment.id);
      row?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [activeIndex, cardVisible, activeShipment?.id]);

  // Clamp activeIndex when cardFiltered changes
  useEffect(() => {
    if (activeIndex >= cardFiltered.length && cardFiltered.length > 0) {
      setActiveIndex(cardFiltered.length - 1);
    } else if (cardFiltered.length === 0) {
      setActiveIndex(0);
    }
  }, [cardFiltered.length, activeIndex]);

  const navigateCard = (dir: 'prev' | 'next') => {
    setActiveIndex(prev => {
      if (dir === 'prev') return Math.max(0, prev - 1);
      return Math.min(cardFiltered.length - 1, prev + 1);
    });
  };

  const handleRowClick = (shipmentId: string) => {
    if (!cardVisible) return;
    const idx = cardFiltered.findIndex(s => s.id === shipmentId);
    if (idx !== -1) setActiveIndex(idx);
  };

  const saveCardNote = async () => {
    if (!activeShipment) return;
    const { error } = await supabase
      .from('shipment_tracking')
      .update({ notes: cardNoteText } as any)
      .eq('id', activeShipment.id);
    if (!error) {
      setShipments(prev => prev.map(s => s.id === activeShipment.id ? { ...s, notes: cardNoteText } : s));
      setEditingCardNote(false);
    }
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Compact header */}
      <div className="p-3 sm:p-4 border-b border-border bg-card space-y-2 flex-shrink-0">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center">
              <Truck className="w-4 h-4 text-primary" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-foreground">جدول المتابعة</h2>
              <p className="text-[10px] text-muted-foreground">{shipments.length} شحنة تحتاج متابعة — عرض {filtered.length}</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <Button
              variant={cardVisible ? "default" : "outline"}
              size="sm"
              onClick={() => setCardVisible(v => !v)}
              className="gap-1 text-xs h-8"
            >
              {cardVisible ? <PanelTopClose className="w-3.5 h-3.5" /> : <PanelTop className="w-3.5 h-3.5" />}
              {cardVisible ? 'إخفاء العداد' : 'عداد المتابعة'}
            </Button>
            {selectedIds.size > 0 && waTemplates.length > 0 && (
              <Button size="sm" onClick={() => { setShowSendDialog(true); setSendResults(null); }} className="gap-1 text-xs h-8 bg-green-600 hover:bg-green-700 text-white">
                <MessageSquare className="w-3.5 h-3.5" />
                واتساب ({selectedIds.size})
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={exportSheet} className="gap-1 text-xs h-8">
              <Download className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">تصدير</span>
            </Button>
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={loadShipments}>
              <RefreshCw className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>

        {followupStatuses.length === 0 && !loading && (
          <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-2 text-[10px] text-amber-700">
            ⚠️ لم يتم تحديد حالات للمتابعة بعد. اذهب لتاب "الإعدادات" واختار الحالات.
          </div>
        )}

        {/* Search + Filter button + bulk actions */}
        <div className="flex items-center gap-1.5">
          <div className="relative flex-1">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <Input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="بحث بالبوليصة أو الاسم أو الرقم..." className="bg-secondary border-0 text-xs pr-9 h-7" />
          </div>

          {/* Single filter popover */}
          <Popover open={showFilters} onOpenChange={setShowFilters}>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="gap-1 text-xs h-7 relative">
                <Filter className="w-3.5 h-3.5" />
                فلترة
                {(dateFilter !== 'all' || statusFilter !== 'all' || waSentFilter !== 'all' || actionFilter !== 'all') && (
                  <span className="absolute -top-1.5 -left-1.5 w-4 h-4 rounded-full bg-primary text-primary-foreground text-[8px] flex items-center justify-center font-bold">
                    {[dateFilter !== 'all', statusFilter !== 'all', waSentFilter !== 'all', actionFilter !== 'all'].filter(Boolean).length}
                  </span>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-72 p-3 space-y-3" align="end" dir="rtl">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-foreground">الفلاتر</span>
                <button
                  onClick={() => { setDateFilter('all'); setStatusFilter('all'); setWaSentFilter('all'); setActionFilter('all'); }}
                  className="text-[10px] text-primary hover:underline"
                >
                  إزالة الكل
                </button>
              </div>

              {/* Date filter - recency groups */}
              <div className="space-y-1">
                <label className="text-[10px] font-medium text-muted-foreground">التاريخ (مدة بدون تحديث)</label>
                <Select value={dateFilter} onValueChange={setDateFilter}>
                  <SelectTrigger className="h-7 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all" className="text-xs">كل التواريخ</SelectItem>
                    {RECENCY_ORDER.map(g => (
                      <SelectItem key={g} value={g} className="text-xs">
                        {RECENCY_LABELS[g]} {recencyCounts[g] ? `(${recencyCounts[g]})` : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Shipping status */}
              <div className="space-y-1">
                <label className="text-[10px] font-medium text-muted-foreground">حالة الشحن</label>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="h-7 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all" className="text-xs">كل الحالات</SelectItem>
                    {uniqueStatuses.map(s => (
                      <SelectItem key={s} value={s} className="text-xs">{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* WA sent */}
              <div className="space-y-1">
                <label className="text-[10px] font-medium text-muted-foreground">الواتساب</label>
                <Select value={waSentFilter} onValueChange={setWaSentFilter}>
                  <SelectTrigger className="h-7 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all" className="text-xs">الكل</SelectItem>
                    <SelectItem value="sent" className="text-xs">✅ اتبعتله</SelectItem>
                    <SelectItem value="not_sent" className="text-xs">❌ ماتبعتلهوش</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Action status */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-medium text-muted-foreground">حالة المتابعة</label>
                <div className="flex gap-1 flex-wrap">
                  <button onClick={() => setActionFilter('all')} className={`px-2 py-0.5 rounded-md text-[10px] font-medium transition-colors ${actionFilter === 'all' ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground hover:text-foreground'}`}>
                    الكل ({filtered.length})
                  </button>
                  {actionStatuses.map(({ key, label }) => {
                    const count = actionCounts[key] || 0;
                    if (count === 0) return null;
                    return (
                      <button key={key} onClick={() => setActionFilter(key)} className={`px-2 py-0.5 rounded-md text-[10px] font-medium transition-colors ${actionFilter === key ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground hover:text-foreground'}`}>
                        {label} ({count})
                      </button>
                    );
                  })}
                </div>
              </div>
            </PopoverContent>
          </Popover>

          {selectedIds.size > 0 && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="gap-1 text-xs h-7">
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

      {/* Navigator Card - prominent & spacious */}
      {cardVisible && cardFiltered.length > 0 && activeShipment && (
        <div className="border-b-2 border-primary/20 bg-card flex-shrink-0" dir="rtl">
          {/* Card header: navigation + filter */}
          <div className="flex items-center justify-between px-4 py-2 bg-primary/5 border-b border-border">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1">
                <Button variant="outline" size="sm" className="h-8 w-8 p-0" onClick={() => navigateCard('next')} disabled={activeIndex >= cardFiltered.length - 1}>
                  <ChevronRight className="w-4 h-4" />
                </Button>
                <div className="flex items-center gap-0.5 text-sm font-bold text-foreground tabular-nums">
                  <span>{cardFiltered.length}</span>
                  <span>/</span>
                  <input
                    type="number"
                    min={1}
                    max={cardFiltered.length}
                    value={activeIndex + 1}
                    onChange={e => {
                      const val = parseInt(e.target.value);
                      if (!isNaN(val) && val >= 1 && val <= cardFiltered.length) {
                        setActiveIndex(val - 1);
                      }
                    }}
                    className="w-12 h-7 text-center text-sm font-bold bg-secondary border border-border rounded-md focus:outline-none focus:ring-1 focus:ring-primary text-foreground [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    dir="ltr"
                  />
                </div>
                <Button variant="outline" size="sm" className="h-8 w-8 p-0" onClick={() => navigateCard('prev')} disabled={activeIndex <= 0}>
                  <ChevronLeft className="w-4 h-4" />
                </Button>
              </div>
            </div>
            <Select value={cardFilter} onValueChange={(v: 'all' | 'pending') => { setCardFilter(v); setActiveIndex(0); }}>
              <SelectTrigger className="h-8 text-xs w-auto min-w-[140px] border-primary/20 bg-card">
                <Filter className="w-3.5 h-3.5 ml-1" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all" className="text-xs">الكل ({filtered.length})</SelectItem>
                <SelectItem value="pending" className="text-xs">لم تُتابع ({filtered.filter(s => !s.status || s.status === '' || s.status === 'pending').length})</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Card body - spacious layout */}
          <div className="px-4 py-4 space-y-2.5">
            {/* Row 1: Name + Phone - large */}
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <User className="w-4 h-4 text-muted-foreground" />
                <span className="text-base font-bold text-foreground">{activeShipment.customer_name || 'بدون اسم'}</span>
              </div>
              <a
                href={`tel:${activeShipment.customer_phone}`}
                className="flex items-center gap-1.5 text-base font-mono font-semibold text-primary hover:underline"
                dir="ltr"
              >
                <Phone className="w-4 h-4" />
                {activeShipment.customer_phone}
              </a>
            </div>

            {/* Row 2: AWB + Order code + Amount */}
            <div className="flex items-center gap-5 flex-wrap text-sm">
              <div className="flex items-center gap-1.5">
                <Package className="w-3.5 h-3.5 text-muted-foreground" />
                {(() => {
                  const days = getDaysSinceLastStatus(activeShipment);
                  const isUrgent = days !== null && days >= 3;
                  return <span className={`font-mono font-semibold ${isUrgent ? 'text-red-600' : 'text-foreground'}`}>{activeShipment.shipment_code}</span>;
                })()}
              </div>
              {activeShipment.order_code && (
                <div className="flex items-center gap-1.5">
                  <ShoppingBag className="w-3.5 h-3.5 text-muted-foreground" />
                  <span className="text-foreground">{activeShipment.order_code}</span>
                </div>
              )}
              {activeShipment.amount && (
                <div className="flex items-center gap-1.5">
                  <CreditCard className="w-3.5 h-3.5 text-muted-foreground" />
                  <span className="font-semibold text-foreground">{activeShipment.amount} ج.م</span>
                </div>
              )}
            </div>

            {/* Row 3: Address + Area */}
            {(activeShipment.customer_address || activeShipment.customer_area) && (
              <div className="flex items-start gap-1.5 text-sm">
                <MapPin className="w-3.5 h-3.5 text-muted-foreground mt-0.5 flex-shrink-0" />
                <span className="text-foreground">
                  {[activeShipment.customer_area, activeShipment.customer_address].filter(Boolean).join(' - ')}
                </span>
              </div>
            )}

            {/* Row 4: Order details */}
            {activeShipment.order_details && (
              <div className="flex items-start gap-1.5 text-sm">
                <ShoppingBag className="w-3.5 h-3.5 text-muted-foreground mt-0.5 flex-shrink-0" />
                <span className="text-foreground">{activeShipment.order_details}</span>
              </div>
            )}

            {/* Row 5: Shipping status + days + proc_notes */}
            <div className="flex items-center gap-3 flex-wrap text-sm">
              <div className="flex items-center gap-1.5">
                <Truck className="w-3.5 h-3.5 text-muted-foreground" />
                <span className={`px-2.5 py-0.5 rounded-md text-xs font-medium border ${getStatusColor(activeShipment.final_status || '-')}`}>
                  {activeShipment.final_status || '-'}
                </span>
              </div>
              {(() => {
                const days = getDaysSinceLastStatus(activeShipment);
                return days !== null ? (
                  <span className={`text-xs ${days >= 3 ? 'text-destructive font-semibold' : days >= 2 ? 'text-amber-600' : 'text-muted-foreground'}`}>
                    ⏱️ منذ {days} يوم
                  </span>
                ) : null;
              })()}
              {activeShipment.proc_notes && (
                <span className="text-xs text-muted-foreground truncate max-w-[300px]" title={activeShipment.proc_notes}>
                  📝 {activeShipment.proc_notes}
                </span>
              )}
            </div>

            {/* Row 6: Action status + Notes - prominent */}
            <div className="flex items-center gap-4 flex-wrap pt-2 border-t border-border">
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">حالة المتابعة:</span>
                <Select
                  value={activeShipment.status || ''}
                  onValueChange={v => updateAction(activeShipment.id, v)}
                >
                  <SelectTrigger className={`h-8 text-xs border ${getActionInfo(activeShipment.status).color || 'border-border'} bg-transparent w-[140px]`}>
                    <span>{getActionInfo(activeShipment.status).label || <span className="text-muted-foreground">اختر حالة</span>}</span>
                  </SelectTrigger>
                  <SelectContent>
                    {actionStatuses.map(({ key, label }) => (
                      <SelectItem key={key} value={key} className="text-xs">{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-2 flex-1 min-w-[200px]">
                <span className="text-sm text-muted-foreground flex-shrink-0">ملاحظات:</span>
                {editingCardNote ? (
                  <div className="flex items-center gap-1 flex-1">
                    <Input
                      value={cardNoteText}
                      onChange={e => setCardNoteText(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') saveCardNote(); if (e.key === 'Escape') setEditingCardNote(false); }}
                      className="h-8 text-sm flex-1"
                      dir="auto"
                      autoFocus
                    />
                    <button onClick={saveCardNote} className="p-1.5 rounded hover:bg-primary/10 text-primary"><Check className="w-4 h-4" /></button>
                    <button onClick={() => setEditingCardNote(false)} className="p-1.5 rounded hover:bg-destructive/10 text-muted-foreground"><X className="w-4 h-4" /></button>
                  </div>
                ) : (
                  <button
                    onClick={() => { setCardNoteText(activeShipment.notes || ''); setEditingCardNote(true); }}
                    className="text-sm text-right truncate hover:bg-secondary rounded px-2 py-1 transition-colors flex-1"
                    title={activeShipment.notes || 'اضغط لإضافة ملاحظة'}
                  >
                    {activeShipment.notes || <span className="text-muted-foreground">+ إضافة ملاحظة</span>}
                  </button>
                )}
              </div>
            </div>

            {/* Last followup history */}
            {lastHistory[activeShipment.id] && (
              <div className="flex items-center gap-2 pt-2 border-t border-border text-xs">
                <History className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                <span className="text-muted-foreground">آخر متابعة:</span>
                <span className="font-medium text-foreground">
                  {getActionInfo(lastHistory[activeShipment.id]!.action_status).label}
                </span>
                {lastHistory[activeShipment.id]!.notes && (
                  <span className="text-muted-foreground truncate max-w-[200px]">
                    — {lastHistory[activeShipment.id]!.notes}
                  </span>
                )}
                <span className="text-muted-foreground text-[10px]">
                  ({(() => {
                    const days = Math.floor((Date.now() - new Date(lastHistory[activeShipment.id]!.created_at).getTime()) / (1000 * 60 * 60 * 24));
                    return days === 0 ? 'اليوم' : `منذ ${days} يوم`;
                  })()})
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {cardVisible && cardFiltered.length === 0 && (
        <div className="border-b border-border bg-card px-4 py-3 text-center text-xs text-muted-foreground">
          لا توجد شحنات {cardFilter === 'pending' ? 'بانتظار المتابعة' : 'للعرض'}
        </div>
      )}

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
                <TableHead className="text-right">
                  <div className="flex items-center gap-1">
                    <span>البوليصة</span>
                    <Popover>
                      <PopoverTrigger asChild>
                        <button className={`p-0.5 rounded hover:bg-secondary transition-colors ${searchQuery ? 'text-primary' : 'text-muted-foreground'}`}>
                          <ListFilter className="w-3 h-3" />
                        </button>
                      </PopoverTrigger>
                      <PopoverContent className="w-52 p-2" align="start">
                        <Input
                          value={searchQuery}
                          onChange={e => setSearchQuery(e.target.value)}
                          placeholder="بحث بالبوليصة أو الاسم..."
                          className="h-7 text-xs"
                          dir="auto"
                          autoFocus
                        />
                        {searchQuery && (
                          <button onClick={() => setSearchQuery('')} className="text-[10px] text-destructive mt-1 hover:underline">مسح</button>
                        )}
                      </PopoverContent>
                    </Popover>
                  </div>
                </TableHead>
                <TableHead className="text-right">
                  <div className="flex items-center gap-1">
                    <span>حالة الشحن</span>
                    <Popover>
                      <PopoverTrigger asChild>
                        <button className={`p-0.5 rounded hover:bg-secondary transition-colors ${statusFilter !== 'all' ? 'text-primary' : 'text-muted-foreground'}`}>
                          <ListFilter className="w-3 h-3" />
                        </button>
                      </PopoverTrigger>
                      <PopoverContent className="w-48 p-2 max-h-60 overflow-auto" align="start">
                        <div className="space-y-0.5">
                          <button onClick={() => setStatusFilter('all')} className={`w-full text-right text-xs px-2 py-1 rounded ${statusFilter === 'all' ? 'bg-primary/10 text-primary font-medium' : 'hover:bg-secondary'}`}>الكل</button>
                          {uniqueStatuses.map(st => (
                            <button key={st} onClick={() => setStatusFilter(st)} className={`w-full text-right text-xs px-2 py-1 rounded truncate ${statusFilter === st ? 'bg-primary/10 text-primary font-medium' : 'hover:bg-secondary'}`}>{st}</button>
                          ))}
                        </div>
                      </PopoverContent>
                    </Popover>
                  </div>
                </TableHead>
                <TableHead className="text-right">
                  <div className="flex items-center gap-1">
                    <span>ملاحظات الشحن</span>
                    <Popover>
                      <PopoverTrigger asChild>
                        <button className={`p-0.5 rounded hover:bg-secondary transition-colors ${statusDescFilter !== 'all' ? 'text-primary' : 'text-muted-foreground'}`}>
                          <ListFilter className="w-3 h-3" />
                        </button>
                      </PopoverTrigger>
                      <PopoverContent className="w-52 p-2 max-h-60 overflow-auto" align="start">
                        <div className="space-y-0.5">
                          <button onClick={() => setStatusDescFilter('all')} className={`w-full text-right text-xs px-2 py-1 rounded ${statusDescFilter === 'all' ? 'bg-primary/10 text-primary font-medium' : 'hover:bg-secondary'}`}>الكل</button>
                          {uniqueStatusDescs.map(d => (
                            <button key={d} onClick={() => setStatusDescFilter(d)} className={`w-full text-right text-xs px-2 py-1 rounded truncate ${statusDescFilter === d ? 'bg-primary/10 text-primary font-medium' : 'hover:bg-secondary'}`}>{d}</button>
                          ))}
                        </div>
                      </PopoverContent>
                    </Popover>
                  </div>
                </TableHead>
                <TableHead className="text-right">
                  <div className="flex items-center gap-1">
                    <span>حالة المتابعة</span>
                    <Popover>
                      <PopoverTrigger asChild>
                        <button className={`p-0.5 rounded hover:bg-secondary transition-colors ${actionFilter !== 'all' ? 'text-primary' : 'text-muted-foreground'}`}>
                          <ListFilter className="w-3 h-3" />
                        </button>
                      </PopoverTrigger>
                      <PopoverContent className="w-44 p-2" align="start">
                        <div className="space-y-0.5">
                          <button onClick={() => setActionFilter('all')} className={`w-full text-right text-xs px-2 py-1 rounded ${actionFilter === 'all' ? 'bg-primary/10 text-primary font-medium' : 'hover:bg-secondary'}`}>الكل</button>
                          <button onClick={() => setActionFilter('__none__')} className={`w-full text-right text-xs px-2 py-1 rounded ${actionFilter === '__none__' ? 'bg-primary/10 text-primary font-medium' : 'hover:bg-secondary'}`}>بدون حالة</button>
                          {actionStatuses.map(({ key, label }) => (
                            <button key={key} onClick={() => setActionFilter(key)} className={`w-full text-right text-xs px-2 py-1 rounded ${actionFilter === key ? 'bg-primary/10 text-primary font-medium' : 'hover:bg-secondary'}`}>{label}</button>
                          ))}
                        </div>
                      </PopoverContent>
                    </Popover>
                  </div>
                </TableHead>
                <TableHead className="text-right">
                  <div className="flex items-center gap-1">
                    <span>ملاحظات</span>
                    <Popover>
                      <PopoverTrigger asChild>
                        <button className={`p-0.5 rounded hover:bg-secondary transition-colors ${notesFilter !== 'all' ? 'text-primary' : 'text-muted-foreground'}`}>
                          <ListFilter className="w-3 h-3" />
                        </button>
                      </PopoverTrigger>
                      <PopoverContent className="w-40 p-2" align="start">
                        <div className="space-y-0.5">
                          <button onClick={() => setNotesFilter('all')} className={`w-full text-right text-xs px-2 py-1 rounded ${notesFilter === 'all' ? 'bg-primary/10 text-primary font-medium' : 'hover:bg-secondary'}`}>الكل</button>
                          <button onClick={() => setNotesFilter('has_notes')} className={`w-full text-right text-xs px-2 py-1 rounded ${notesFilter === 'has_notes' ? 'bg-primary/10 text-primary font-medium' : 'hover:bg-secondary'}`}>بها ملاحظات</button>
                          <button onClick={() => setNotesFilter('no_notes')} className={`w-full text-right text-xs px-2 py-1 rounded ${notesFilter === 'no_notes' ? 'bg-primary/10 text-primary font-medium' : 'hover:bg-secondary'}`}>بدون ملاحظات</button>
                        </div>
                      </PopoverContent>
                    </Popover>
                  </div>
                </TableHead>
                <TableHead className="text-right">
                  <div className="flex items-center gap-1">
                    <span>واتساب</span>
                    <Popover>
                      <PopoverTrigger asChild>
                        <button className={`p-0.5 rounded hover:bg-secondary transition-colors ${waSentFilter !== 'all' ? 'text-primary' : 'text-muted-foreground'}`}>
                          <ListFilter className="w-3 h-3" />
                        </button>
                      </PopoverTrigger>
                      <PopoverContent className="w-36 p-2" align="start">
                        <div className="space-y-0.5">
                          <button onClick={() => setWaSentFilter('all')} className={`w-full text-right text-xs px-2 py-1 rounded ${waSentFilter === 'all' ? 'bg-primary/10 text-primary font-medium' : 'hover:bg-secondary'}`}>الكل</button>
                          <button onClick={() => setWaSentFilter('sent')} className={`w-full text-right text-xs px-2 py-1 rounded ${waSentFilter === 'sent' ? 'bg-primary/10 text-primary font-medium' : 'hover:bg-secondary'}`}>✅ اتبعت</button>
                          <button onClick={() => setWaSentFilter('not_sent')} className={`w-full text-right text-xs px-2 py-1 rounded ${waSentFilter === 'not_sent' ? 'bg-primary/10 text-primary font-medium' : 'hover:bg-secondary'}`}>لم ترسل</button>
                        </div>
                      </PopoverContent>
                    </Popover>
                  </div>
                </TableHead>
                <TableHead className="text-right w-12"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {groupedFiltered.map(({ group, label, shipments: groupShipments }) => (
                <Fragment key={`group-${group}`}>
                  {/* Date group separator */}
                  <TableRow key={`group-${group}`} className="bg-secondary/50 hover:bg-secondary/50">
                    <TableCell colSpan={8} className="py-1.5 px-3">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-foreground">{label}</span>
                        <span className="text-[10px] text-muted-foreground">({groupShipments.length} شحنة)</span>
                        <div className="flex-1 h-px bg-border" />
                      </div>
                    </TableCell>
                  </TableRow>
                  {groupShipments.map(s => {
                    const actionInfo = getActionInfo(s.status);
                    const displayStatus = s.final_status || '-';
                    const days = getDaysSinceLastStatus(s);
                    const isUrgent = days !== null && days >= 3;
                    return (
                      <TableRow
                        key={s.id}
                        ref={(el) => { if (el) rowRefs.current.set(s.id, el); else rowRefs.current.delete(s.id); }}
                        className={`text-xs cursor-pointer transition-colors ${cardVisible && activeShipment?.id === s.id ? 'bg-primary/10 ring-1 ring-primary/20' : ''} ${isUrgent ? 'bg-red-500/5' : ''}`}
                        onClick={() => handleRowClick(s.id)}
                      >
                        <TableCell className="text-center">
                          <input type="checkbox" checked={selectedIds.has(s.id)} onChange={() => toggleSelect(s.id)} className="rounded border-border" />
                        </TableCell>
                        <TableCell className={`font-mono text-xs ${isUrgent ? 'text-red-600 font-bold' : ''}`}>{s.shipment_code}</TableCell>
                        <TableCell>
                          <span className={`px-2 py-0.5 rounded-md text-[10px] font-medium border ${getStatusColor(displayStatus)}`}>
                            {displayStatus}
                          </span>
                        </TableCell>
                        <TableCell className="text-xs max-w-[200px] truncate" title={s.proc_notes || ''}>{s.proc_notes || '-'}</TableCell>
                        <TableCell>
                          <Select value={s.status || ''} onValueChange={v => updateAction(s.id, v)}>
                            <SelectTrigger className={`h-7 text-[10px] border ${actionInfo.color || 'border-border'} bg-transparent w-[130px]`}>
                              <span>{actionInfo.label || <span className="text-muted-foreground">اختر حالة</span>}</span>
                            </SelectTrigger>
                            <SelectContent>
                              {actionStatuses.map(({ key, label: l }) => (
                                <SelectItem key={key} value={key} className="text-xs">{l}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
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
                          {s.wa_template_sent ? (
                            <span className="text-green-600 text-[10px] font-medium">✅</span>
                          ) : (
                            <span className="text-[10px] text-muted-foreground">-</span>
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
                </Fragment>
              ))}
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
