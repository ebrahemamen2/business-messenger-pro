import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useTenantContext } from '@/contexts/TenantContext';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Upload, Download, Search, Loader2, Truck, Package, Eye, RefreshCw
} from 'lucide-react';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import * as XLSX from 'xlsx';

// All possible shipping company statuses with Arabic descriptions
export const SHIPPING_STATUSES: Record<string, { en: string; ar: string }> = {
  'Cash Delivered': { en: 'Money Transferred to Customer', ar: 'الاوردر اتسلم وتم تسليم مبلغ التحصيل للراسل' },
  'Collected': { en: 'Money Collected', ar: 'الاوردر اتسلم وتم تحصيل مبلغ التسليم' },
  'OD': { en: 'Out For Delivery', ar: 'تحت التسليم' },
  'OK': { en: 'Shipment Delivered', ar: 'تم التسليم' },
  'OH': { en: 'OH', ar: 'مع المندوب وهيتم محاوله مره اخري' },
  'Follow': { en: 'متابعة من قبل الراسل', ar: 'مطلوب متابعه من قبل الراسل' },
  'CR': { en: 'Customer Refused', ar: 'العميل رفض استلام الشحنه' },
  'تأجيل الى تاريخ': { en: 'تأجيل الى تاريخ', ar: 'الاوردر مؤجل لتاريخ معين' },
  'RO': { en: 'Returned', ar: 'الشحنه فشل تسليمها ورجعت للراسل' },
  'ROWF': { en: 'Returned With fees', ar: 'الشحنه فشل تسليمها ورجعت للراسل برسوم' },
  'Returned to the Shipper': { en: 'Shipments Returned to the Shipper', ar: 'الشحنه فشل تسليمها ورجعت للراسل' },
  'Branch Delivered': { en: 'BranchDelivered', ar: 'فرع شركة الشحن استلم الشحنه' },
  'in transit': { en: 'in transit', ar: 'الشحنه تحت النقل بين فروع شركة الشحن' },
  'Received': { en: 'Received', ar: 'شركة الشحن استلمت الشحنه من الراسل' },
  'تحديد معاد': { en: 'تحديد معاد', ar: 'في انتظار تحديد ميعاد من العميل' },
  'Undelivered': { en: 'محافظات', ar: 'مشكله في التسليم في المحافظات' },
  'Another try': { en: 'اعادة توزيع', ar: 'محاوله مره اخري للتسليم' },
  'Cash in Transit': { en: 'Cash in Transit', ar: 'تم تسليم الشحنه وجاري تحصيل مبلغ التسليم' },
  'Next Day': { en: 'Next Day', ar: 'محاوله مره اخري غدا' },
  'Cancel Shipment': { en: 'شحنة ملغاه من قبل الراسل او من المرسل اليه', ar: 'شحنه بلغ بيها الغاء الراسل او العميل' },
  'تحت التسليم': { en: 'تحت التسليم', ar: 'تحت التسليم' },
};

export const getStatusColor = (status: string): string => {
  const s = status?.toLowerCase() || '';
  if (s.includes('deliver') || s === 'ok' || s.includes('collected') || s.includes('cash delivered')) return 'bg-green-500/15 text-green-700 border-green-500/30';
  if (s.includes('return') || s === 'ro' || s === 'rowf') return 'bg-red-500/15 text-red-700 border-red-500/30';
  if (s.includes('cancel') || s.includes('ملغ') || s.includes('الغ')) return 'bg-destructive/15 text-destructive border-destructive/30';
  if (s.includes('transit') || s.includes('received') || s.includes('branch')) return 'bg-blue-500/15 text-blue-700 border-blue-500/30';
  if (s === 'od' || s.includes('تحت التسليم') || s.includes('out')) return 'bg-sky-500/15 text-sky-700 border-sky-500/30';
  if (s === 'oh' || s.includes('another') || s.includes('next')) return 'bg-orange-500/15 text-orange-700 border-orange-500/30';
  if (s.includes('follow') || s.includes('متابع')) return 'bg-purple-500/15 text-purple-700 border-purple-500/30';
  if (s === 'cr' || s.includes('refused')) return 'bg-rose-500/15 text-rose-700 border-rose-500/30';
  if (s.includes('تأجيل') || s.includes('تحديد معاد')) return 'bg-amber-500/15 text-amber-700 border-amber-500/30';
  if (s.includes('undelivered') || s.includes('محافظ')) return 'bg-yellow-500/15 text-yellow-700 border-yellow-500/30';
  return 'bg-muted text-muted-foreground border-border';
};

export interface Shipment {
  id: string;
  shipment_code: string;
  order_code: string | null;
  customer_phone: string;
  customer_name: string | null;
  customer_address: string | null;
  customer_area: string | null;
  order_details: string | null;
  amount: number | null;
  status: string;
  status_description: string | null;
  pickup_date: string | null;
  status_date: string | null;
  final_status: string | null;
  last_status_date: string | null;
  proc_notes: string | null;
  shipping_company: string | null;
  notes: string | null;
  wa_template_sent: boolean;
  conversation_id: string | null;
  uploaded_at: string;
  updated_at: string;
}

const PAGE_SIZE = 500;

const AllShipmentsTable = () => {
  const { currentTenant } = useTenantContext();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [detailShipment, setDetailShipment] = useState<Shipment | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [statusCounts, setStatusCounts] = useState<Record<string, number>>({});
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout>>();

  // Load status counts once (lightweight query)
  const loadStatusCounts = useCallback(async () => {
    if (!currentTenant?.id) return;
    const { data, error } = await supabase
      .from('shipment_tracking')
      .select('final_status, status')
      .eq('tenant_id', currentTenant.id);
    if (error || !data) return;
    const counts: Record<string, number> = {};
    data.forEach((s: any) => {
      const st = s.final_status || s.status || 'unknown';
      counts[st] = (counts[st] || 0) + 1;
    });
    setStatusCounts(counts);
  }, [currentTenant?.id]);

  const loadShipments = useCallback(async () => {
    if (!currentTenant?.id) { setLoading(false); return; }
    setLoading(true);
    const from = (currentPage - 1) * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;

    let query = supabase
      .from('shipment_tracking')
      .select('*', { count: 'exact' })
      .eq('tenant_id', currentTenant.id)
      .order('uploaded_at', { ascending: false })
      .range(from, to);

    if (statusFilter !== 'all') {
      query = query.eq('final_status', statusFilter);
    }
    if (searchQuery) {
      query = query.or(`shipment_code.ilike.%${searchQuery}%,order_code.ilike.%${searchQuery}%,customer_phone.ilike.%${searchQuery}%,customer_name.ilike.%${searchQuery}%,customer_area.ilike.%${searchQuery}%`);
    }

    const { data, error, count } = await query;
    if (error) console.error('Load shipments error:', error);
    setShipments((data as Shipment[]) || []);
    setTotalCount(count ?? 0);
    setLoading(false);
  }, [currentTenant?.id, statusFilter, searchQuery, currentPage]);

  useEffect(() => { loadShipments(); }, [loadShipments]);
  useEffect(() => { loadStatusCounts(); }, [loadStatusCounts]);

  // Reset to page 1 when filters change
  useEffect(() => { setCurrentPage(1); }, [statusFilter, searchQuery]);

  // Debounced search
  const handleSearchInput = (value: string) => {
    setSearchInput(value);
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    searchTimeoutRef.current = setTimeout(() => setSearchQuery(value), 400);
  };

  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  const normalizeHeader = (value: string) =>
    value.toLowerCase().replace(/_x[0-9a-f]{4}_/gi, ' ').replace(/[\s_\-]+/g, '').trim();

  const readAsBinaryString = (file: File) =>
    new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve((reader.result as string) || '');
      reader.onerror = () => reject(reader.error || new Error('Failed'));
      reader.readAsBinaryString(file);
    });

  const readWorkbookWithFallback = async (file: File) => {
    const arrayBuffer = await file.arrayBuffer();
    const isLegacyXls = file.name.toLowerCase().endsWith('.xls');
    const attempts: Array<() => Promise<XLSX.WorkBook>> = [
      async () => XLSX.read(arrayBuffer, { type: 'array', dense: true, cellDates: true, raw: false }),
      async () => XLSX.read(new Uint8Array(arrayBuffer), { type: 'array', dense: true, cellDates: true, raw: false }),
    ];
    if (isLegacyXls) {
      attempts.push(
        async () => { const b = await readAsBinaryString(file); return XLSX.read(b, { type: 'binary', dense: true, cellDates: true, raw: false, codepage: 65001 }); },
        async () => { const t = await file.text(); return XLSX.read(t, { type: 'string', dense: true, cellDates: true, raw: false }); },
      );
    }
    let lastError: unknown = null;
    for (let i = 0; i < attempts.length; i++) {
      try {
        const wb = await attempts[i]();
        if (wb?.SheetNames?.length) return wb;
      } catch (e) { lastError = e; }
    }
    throw lastError || new Error('تعذر قراءة الملف');
  };

  const parseLocaleNumber = (value: unknown): number | null => {
    if (value === null || value === undefined || value === '') return null;
    const text = String(value).trim().replace(/[^\d,.-]/g, '');
    if (!text) return null;
    const lastComma = text.lastIndexOf(',');
    const lastDot = text.lastIndexOf('.');
    let normalized = text;
    if (lastComma > -1 && lastDot > -1) {
      normalized = lastComma > lastDot ? text.replace(/\./g, '').replace(',', '.') : text.replace(/,/g, '');
    } else if (lastComma > -1) {
      normalized = text.length - lastComma - 1 <= 2 ? text.replace(/\./g, '').replace(',', '.') : text.replace(/,/g, '');
    } else {
      normalized = text.replace(/,/g, '');
    }
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : null;
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !currentTenant?.id) {
      if (!currentTenant?.id) toast({ title: '❌ خطأ', description: 'لم يتم اختيار البراند', variant: 'destructive' });
      return;
    }
    setUploading(true);
    try {
      toast({ title: '📂 جاري قراءة الملف...', description: file.name });
      const workbook = await readWorkbookWithFallback(file);
      const firstSheetName = workbook.SheetNames.find(name => workbook.Sheets[name]?.['!ref']) || workbook.SheetNames[0];
      const sheet = workbook.Sheets[firstSheetName];
      if (!sheet) throw new Error('لا يوجد Sheet صالح');

      const aoa = XLSX.utils.sheet_to_json<any[]>(sheet, { header: 1, defval: '' });
      const nonEmptyStart = aoa.findIndex(row => row.some((cell: any) => String(cell ?? '').trim() !== ''));
      if (nonEmptyStart === -1) { toast({ title: '⚠️ الملف فارغ', variant: 'destructive' }); return; }

      const headerSignals = ['ref', 'shipment', 'tracking', 'awb', 'tel', 'phone', 'status', 'بوليص', 'هاتف', 'حاله', 'حالة'];
      const headerRelIdx = aoa.slice(nonEmptyStart).findIndex(row => {
        const nr = row.map((c: any) => normalizeHeader(String(c ?? '')));
        return nr.some((c: string) => headerSignals.some(sig => c.includes(normalizeHeader(sig))));
      });
      const headerIndex = headerRelIdx >= 0 ? nonEmptyStart + headerRelIdx : nonEmptyStart;
      const headerRow = aoa[headerIndex] || [];
      const keys = headerRow.map((cell: any, i: number) => String(cell ?? '').trim() || `column_${i + 1}`);
      const dataRows = aoa.slice(headerIndex + 1).filter((row: any[]) => row.some((c: any) => String(c ?? '').trim() !== ''));
      const rows: Record<string, unknown>[] = dataRows.map((row: any[]) => {
        const obj: Record<string, unknown> = {};
        keys.forEach((key: string, i: number) => { obj[key] = row[i] ?? ''; });
        return obj;
      });

      if (rows.length === 0) { toast({ title: '⚠️ الملف فارغ', variant: 'destructive' }); return; }

      const normalizedKeys = keys.map((key: string) => ({ key, normalized: normalizeHeader(key) }));
      const findCol = (patterns: string[]) => {
        const np = patterns.map(normalizeHeader);
        return normalizedKeys.find(({ normalized }: { normalized: string }) => np.some(p => normalized.includes(p)))?.key;
      };

      const refCol = findCol(['Ref', 'بوليصة', 'بوليصه', 'shipment', 'tracking', 'awb', 'كود الشحن']);
      const pickupCol = findCol(['Pickup', 'تسليم الشحن', 'تاريخ التسليم']);
      const nameCol = findCol(['Name', 'اسم', 'عميل', 'customer']);
      const addressCol = findCol(['Address', 'عنوان']);
      const areaCol = findCol(['Area', 'منطقة', 'منطقه', 'محافظة']);
      const remarksCol = findCol(['ConsData_Remarkes', 'ConsData', 'Remarkes', 'ملاحظ', 'تفاصيل', 'منتج']);
      const amountCol = findCol(['Amount', 'مبلغ', 'سعر', 'قيمة', 'المبلغ']);
      const uDateCol = findCol(['UDate']);
      const uStatusCol = findCol(['UStatus', 'حالة', 'حاله', 'status']);
      const statusDescCol = findCol(['StatusDescription', 'تفصيل الحال']);
      const telCol = findCol(['Tel', 'هاتف', 'تليفون', 'تلفون', 'موبايل', 'phone', 'mobile']);
      const clientRefCol = findCol(['ClientRef', 'كود الطلب', 'طلب', 'order', 'اوردر']);
      const finalStatusCol = findCol(['FinalStatusName', 'اخر حال']);
      const lastStatusDateCol = findCol(['laststatusDate', 'تاريخ اخر']);
      const procNotesCol = findCol(['ProcNotes', 'proc']);
      const accountNameCol = findCol(['AccountName', 'اسم الحساب', 'حساب']);

      if (!refCol && !telCol) {
        toast({ title: '❌ تنسيق غير معروف', description: 'الملف لازم يحتوي على عمود Ref أو Tel', variant: 'destructive' });
        return;
      }

      const shipmentRows = rows.map((row, index) => {
        let phone = telCol ? String(row[telCol] ?? '').replace(/\D/g, '').trim() : '';
        if (phone.startsWith('0020')) phone = phone.slice(2);
        if (phone.startsWith('01') && phone.length === 11) phone = `2${phone}`;

        // Store the raw status from shipping company as-is
        const rawFinalStatus = finalStatusCol ? String(row[finalStatusCol] ?? '').trim() || null : null;
        const rawUStatus = uStatusCol ? String(row[uStatusCol] ?? '').trim() || null : null;

        return {
          tenant_id: currentTenant.id,
          shipment_code: String(refCol ? row[refCol] ?? '' : '').trim() || `AUTO-${Date.now()}-${index}`,
          order_code: clientRefCol ? String(row[clientRefCol] ?? '').trim() || null : null,
          customer_phone: phone,
          customer_name: nameCol ? String(row[nameCol] ?? '').trim() || null : null,
          customer_address: addressCol ? String(row[addressCol] ?? '').trim() || null : null,
          customer_area: areaCol ? String(row[areaCol] ?? '').trim() || null : null,
          order_details: remarksCol ? String(row[remarksCol] ?? '').trim() || null : null,
          amount: amountCol ? parseLocaleNumber(row[amountCol]) : null,
          status: rawUStatus || rawFinalStatus || 'pending',
          status_description: statusDescCol ? String(row[statusDescCol] ?? '').trim() || null : null,
          pickup_date: pickupCol ? String(row[pickupCol] ?? '').trim() || null : null,
          status_date: uDateCol ? String(row[uDateCol] ?? '').trim() || null : null,
          final_status: rawFinalStatus,
          last_status_date: lastStatusDateCol ? String(row[lastStatusDateCol] ?? '').trim() || null : null,
          proc_notes: procNotesCol ? String(row[procNotesCol] ?? '').trim() || null : null,
          notes: null,
          shipping_company: accountNameCol ? String(row[accountNameCol] ?? '').trim() || null : null,
          wa_template_sent: false,
        };
      }).filter(r => r.customer_phone || r.shipment_code);

      if (shipmentRows.length === 0) {
        toast({ title: '❌ لا توجد بيانات صالحة', variant: 'destructive' });
        return;
      }

      // Upsert by shipment_code + tenant_id
      const { error: upsertErr } = await supabase
        .from('shipment_tracking')
        .upsert(shipmentRows as any, { onConflict: 'shipment_code,tenant_id' });

      if (upsertErr) {
        toast({ title: '❌ خطأ في الرفع', description: upsertErr.message, variant: 'destructive' });
      } else {
        toast({ title: '✅ تم الرفع', description: `تم رفع/تحديث ${shipmentRows.length} شحنة بنجاح` });
        loadShipments();
      }
    } catch (err) {
      console.error('File parse error:', err);
      toast({ title: '❌ خطأ', description: `فشل في قراءة الملف: ${err instanceof Error ? err.message : 'خطأ'}`, variant: 'destructive' });
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const exportSheet = () => {
    const exportData = shipments.map(s => ({
      'رقم البوليصة': s.shipment_code,
      'كود الطلب': s.order_code || '',
      'اسم العميل': s.customer_name || '',
      'رقم الهاتف': s.customer_phone,
      'المنطقة': s.customer_area || '',
      'العنوان': s.customer_address || '',
      'تفاصيل الطلب': s.order_details || '',
      'المبلغ': s.amount || '',
      'الحالة': s.final_status || s.status || '',
      'تفصيل الحالة': s.status_description || '',
      'تاريخ الاستلام': s.pickup_date || '',
      'آخر حالة': s.final_status || '',
      'تاريخ آخر حالة': s.last_status_date || '',
      'ملاحظات الشحن': s.proc_notes || '',
    }));
    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'شحنات');
    XLSX.writeFile(wb, `all-shipments-${new Date().toISOString().slice(0, 10)}.xlsx`);
    toast({ title: '✅ تم التصدير', description: `تم تصدير ${exportData.length} شحنة` });
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="p-3 sm:p-4 border-b border-border bg-card space-y-3 flex-shrink-0">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
              <Package className="w-4.5 h-4.5 text-primary" />
            </div>
            <div>
              <h2 className="text-base font-bold text-foreground">كل الشحنات</h2>
              <p className="text-xs text-muted-foreground">{totalCount.toLocaleString()} شحنة</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <input ref={fileInputRef} type="file" accept=".csv,.xlsx,.xls" onChange={handleFileUpload} className="hidden" />
            <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} disabled={uploading || !currentTenant?.id} className="gap-1.5 text-xs" title={!currentTenant?.id ? 'انتظر تحميل البراند...' : 'رفع شيت شركة الشحن'}>
              {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
              رفع شيت
            </Button>
            <Button variant="outline" size="sm" onClick={exportSheet} className="gap-1.5 text-xs">
              <Download className="w-3.5 h-3.5" />
              تصدير
            </Button>
        {/* Reload status counts after upload */}
        <Button variant="ghost" size="sm" onClick={() => { loadShipments(); loadStatusCounts(); }} className="gap-1.5 text-xs">
              <RefreshCw className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>

        {/* Status filter chips */}
        <div className="flex gap-1.5 flex-wrap max-h-16 overflow-y-auto">
          <button onClick={() => setStatusFilter('all')} className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${statusFilter === 'all' ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground hover:text-foreground'}`}>
            الكل ({Object.values(statusCounts).reduce((a, b) => a + b, 0).toLocaleString()})
          </button>
          {Object.entries(statusCounts).sort((a, b) => b[1] - a[1]).map(([status, count]) => (
            <button key={status} onClick={() => setStatusFilter(status)} className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${statusFilter === status ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground hover:text-foreground'}`}>
              {status} ({count})
            </button>
          ))}
        </div>

        <div className="relative">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input value={searchInput} onChange={e => handleSearchInput(e.target.value)} placeholder="بحث بالبوليصة أو الاسم أو الرقم أو المنطقة..." className="bg-secondary border-0 text-xs pr-9 h-8" />
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        {loading ? (
          <div className="flex items-center justify-center h-full"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-4 text-muted-foreground">
            <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center"><Package className="w-8 h-8 text-primary" /></div>
            <p className="text-sm font-medium">لا توجد شحنات</p>
            <p className="text-xs">ارفع شيت شركة الشحن للبدء</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="text-xs">
                <TableHead className="text-right">البوليصة</TableHead>
                <TableHead className="text-right">كود الطلب</TableHead>
                <TableHead className="text-right">العميل</TableHead>
                <TableHead className="text-right">الهاتف</TableHead>
                <TableHead className="text-right">المنطقة</TableHead>
                <TableHead className="text-right">المبلغ</TableHead>
                <TableHead className="text-right">الحالة</TableHead>
                <TableHead className="text-right">ملاحظات</TableHead>
                <TableHead className="text-right w-16">تفاصيل</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map(s => {
                const displayStatus = s.final_status || s.status || '-';
                return (
                  <TableRow key={s.id} className="text-xs">
                    <TableCell className="font-mono text-xs">{s.shipment_code}</TableCell>
                    <TableCell className="text-xs">{s.order_code || '-'}</TableCell>
                    <TableCell className="text-xs">{s.customer_name || '-'}</TableCell>
                    <TableCell className="font-mono text-xs" dir="ltr">{s.customer_phone}</TableCell>
                    <TableCell className="text-xs">{s.customer_area || '-'}</TableCell>
                    <TableCell className="text-xs font-medium">{s.amount ? `${s.amount} ج.م` : '-'}</TableCell>
                    <TableCell>
                      <span className={`px-2 py-0.5 rounded-md text-[10px] font-medium border ${getStatusColor(displayStatus)}`}>
                        {displayStatus}
                      </span>
                    </TableCell>
                    <TableCell className="text-xs max-w-[150px] truncate">{s.proc_notes || s.notes || '-'}</TableCell>
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
            <DialogTitle className="flex items-center gap-2"><Package className="w-5 h-5 text-primary" />تفاصيل الشحنة</DialogTitle>
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
                <DetailRow label="تاريخ الاستلام" value={detailShipment.pickup_date} />
                <DetailRow label="تاريخ تحديث الحالة" value={detailShipment.status_date} />
                <DetailRow label="الحالة" value={detailShipment.final_status || detailShipment.status} />
                <DetailRow label="تاريخ آخر حالة" value={detailShipment.last_status_date} />
                <DetailRow label="شركة الشحن" value={detailShipment.shipping_company} />
              </div>
              <DetailRow label="العنوان" value={detailShipment.customer_address} full />
              <DetailRow label="تفاصيل الطلب (المنتجات)" value={detailShipment.order_details} full />
              <DetailRow label="تفصيل حالة الشحن" value={detailShipment.status_description} full />
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

export default AllShipmentsTable;
