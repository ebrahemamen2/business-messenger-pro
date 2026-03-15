import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useTenantContext } from '@/contexts/TenantContext';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Upload, Download, Search, Loader2, Truck, Package, RefreshCw,
  CheckCircle, XCircle, Clock, AlertTriangle, Filter, Send, Eye, ChevronDown, ChevronUp
} from 'lucide-react';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import * as XLSX from 'xlsx';

interface Shipment {
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

const STATUS_MAP: Record<string, { label: string; color: string; icon: any }> = {
  pending: { label: 'معلق', color: 'bg-yellow-500/15 text-yellow-600 border-yellow-500/30', icon: Clock },
  out_for_delivery: { label: 'خرج للتسليم', color: 'bg-blue-500/15 text-blue-600 border-blue-500/30', icon: Truck },
  delivered: { label: 'تم التسليم', color: 'bg-green-500/15 text-green-600 border-green-500/30', icon: CheckCircle },
  returned: { label: 'مرتجع', color: 'bg-red-500/15 text-red-600 border-red-500/30', icon: XCircle },
  rescheduled: { label: 'تم التأجيل', color: 'bg-orange-500/15 text-orange-600 border-orange-500/30', icon: RefreshCw },
  no_answer: { label: 'لا يرد', color: 'bg-gray-500/15 text-gray-600 border-gray-500/30', icon: AlertTriangle },
  follow: { label: 'متابعة', color: 'bg-purple-500/15 text-purple-600 border-purple-500/30', icon: RefreshCw },
  ready: { label: 'جاهز للاستلام', color: 'bg-emerald-500/15 text-emerald-600 border-emerald-500/30', icon: Package },
  cancelled: { label: 'ملغي', color: 'bg-destructive/15 text-destructive border-destructive/30', icon: XCircle },
};

const ShipmentTrackingTable = () => {
  const { currentTenant } = useTenantContext();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [detailShipment, setDetailShipment] = useState<Shipment | null>(null);

  const loadShipments = useCallback(async () => {
    if (!currentTenant?.id) {
      setLoading(false);
      return;
    }
    setLoading(true);

    let query = supabase
      .from('shipment_tracking')
      .select('*')
      .eq('tenant_id', currentTenant.id)
      .order('uploaded_at', { ascending: false });

    if (statusFilter !== 'all') {
      query = query.eq('status', statusFilter);
    }

    const { data, error } = await query.limit(500);
    if (error) console.error('Load shipments error:', error);
    setShipments((data as Shipment[]) || []);
    setLoading(false);
  }, [currentTenant?.id, statusFilter]);

  useEffect(() => {
    loadShipments();
  }, [loadShipments]);

  const filtered = shipments.filter(s => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      s.shipment_code.toLowerCase().includes(q) ||
      (s.order_code || '').toLowerCase().includes(q) ||
      s.customer_phone.includes(q) ||
      (s.customer_name || '').toLowerCase().includes(q) ||
      (s.customer_area || '').toLowerCase().includes(q)
    );
  });

  const mapStatus = (raw: string): string => {
    const lower = raw.toLowerCase().trim();
    if (lower.includes('deliver') || lower.includes('تسليم') || lower.includes('مستلم')) return 'delivered';
    if (lower.includes('return') || lower.includes('مرتجع') || lower.includes('راجع')) return 'returned';
    if (lower.includes('reschedul') || lower.includes('تأجيل') || lower.includes('مؤجل')) return 'rescheduled';
    if (lower.includes('cancel') || lower.includes('ملغ') || lower.includes('الغ')) return 'cancelled';
    if (lower.includes('out') || lower.includes('خرج') || lower.includes('طريق')) return 'out_for_delivery';
    if (lower.includes('no answer') || lower.includes('لا يرد') || lower.includes('مايردش') || lower.includes('مابيردش')) return 'no_answer';
    if (lower.includes('follow') || lower.includes('متابع')) return 'follow';
    if (lower.includes('ready') || lower.includes('جاهز')) return 'ready';
    return 'pending';
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    console.log('📋 File input changed, files:', e.target.files?.length);
    const file = e.target.files?.[0];
    if (!file) { console.log('📋 No file selected'); return; }
    if (!currentTenant?.id) { console.log('📋 No tenant selected'); toast({ title: '❌ خطأ', description: 'لم يتم اختيار البراند', variant: 'destructive' }); return; }
    setUploading(true);
    console.log('📋 Starting upload for:', file.name, 'size:', file.size, 'type:', file.type);

    try {
      toast({ title: '📂 جاري قراءة الملف...', description: file.name });
      
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data, { type: 'array' });
      console.log('📋 Workbook sheets:', workbook.SheetNames);
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows: any[] = XLSX.utils.sheet_to_json(sheet, { defval: '' });

      console.log('📋 Parsed rows count:', rows.length);

      if (rows.length === 0) {
        toast({ title: '⚠️ الملف فارغ', description: 'لا توجد بيانات في الملف', variant: 'destructive' });
        setUploading(false);
        return;
      }

      const firstRow = rows[0];
      const keys = Object.keys(firstRow);
      
      console.log('📋 Sheet columns detected:', keys);
      console.log('📋 First row sample:', firstRow);
      console.log('📋 Total rows:', rows.length);
      
      const findCol = (patterns: string[]) => 
        keys.find(k => patterns.some(p => k.toLowerCase().includes(p.toLowerCase())));

      // Map columns from shipping company sheet
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

      console.log('📋 Column mapping:', { refCol, pickupCol, nameCol, addressCol, areaCol, remarksCol, amountCol, telCol, clientRefCol, uStatusCol, finalStatusCol, procNotesCol });

      if (!refCol && !telCol) {
        toast({
          title: '❌ تنسيق غير معروف',
          description: 'الملف لازم يحتوي على عمود Ref أو Tel على الأقل. الأعمدة: ' + keys.join(', '),
          variant: 'destructive',
        });
        setUploading(false);
        return;
      }

      const shipmentRows = rows.map(row => {
        let phone = telCol ? String(row[telCol]).replace(/[\s\-\+]/g, '').trim() : '';
        // Normalize Egyptian phone
        if (phone.startsWith('01') && phone.length === 11) phone = '2' + phone;

        return {
          tenant_id: currentTenant.id,
          shipment_code: String(refCol ? row[refCol] : '').trim() || `AUTO-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          order_code: clientRefCol ? String(row[clientRefCol]).trim() || null : null,
          customer_phone: phone,
          customer_name: nameCol ? String(row[nameCol]).trim() || null : null,
          customer_address: addressCol ? String(row[addressCol]).trim() || null : null,
          customer_area: areaCol ? String(row[areaCol]).trim() || null : null,
          order_details: remarksCol ? String(row[remarksCol]).trim() || null : null,
          amount: amountCol ? parseFloat(String(row[amountCol])) || null : null,
          status: uStatusCol ? mapStatus(String(row[uStatusCol]).trim()) : 'pending',
          status_description: statusDescCol ? String(row[statusDescCol]).trim() || null : null,
          pickup_date: pickupCol ? String(row[pickupCol]).trim() || null : null,
          status_date: uDateCol ? String(row[uDateCol]).trim() || null : null,
          final_status: finalStatusCol ? String(row[finalStatusCol]).trim() || null : null,
          last_status_date: lastStatusDateCol ? String(row[lastStatusDateCol]).trim() || null : null,
          proc_notes: procNotesCol ? String(row[procNotesCol]).trim() || null : null,
          notes: null,
          shipping_company: null,
          wa_template_sent: false,
        };
      }).filter(r => r.customer_phone || r.shipment_code);

      const { error: insertErr } = await supabase
        .from('shipment_tracking')
        .insert(shipmentRows as any);

      if (insertErr) {
        toast({ title: '❌ خطأ في الرفع', description: insertErr.message, variant: 'destructive' });
      } else {
        toast({ title: '✅ تم الرفع', description: `تم رفع ${shipmentRows.length} شحنة بنجاح` });
        loadShipments();
      }
    } catch (err) {
      console.error('File parse error:', err);
      toast({ title: '❌ خطأ', description: 'فشل في قراءة الملف', variant: 'destructive' });
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const updateStatus = async (id: string, newStatus: string) => {
    const { error } = await supabase
      .from('shipment_tracking')
      .update({ status: newStatus } as any)
      .eq('id', id);
    if (!error) {
      setShipments(prev => prev.map(s => s.id === id ? { ...s, status: newStatus } : s));
    }
  };

  const bulkUpdateStatus = async (newStatus: string) => {
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

  const exportSheet = () => {
    const exportData = filtered.map(s => ({
      'رقم البوليصة': s.shipment_code,
      'كود الطلب': s.order_code || '',
      'اسم العميل': s.customer_name || '',
      'رقم الهاتف': s.customer_phone,
      'المنطقة': s.customer_area || '',
      'العنوان': s.customer_address || '',
      'تفاصيل الطلب': s.order_details || '',
      'المبلغ': s.amount || '',
      'الحالة': STATUS_MAP[s.status]?.label || s.status,
      'تفصيل الحالة': s.status_description || '',
      'تاريخ الاستلام': s.pickup_date || '',
      'آخر حالة': s.final_status || '',
      'تاريخ آخر حالة': s.last_status_date || '',
      'ملاحظات الشحن': s.proc_notes || '',
      'ملاحظات': s.notes || '',
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'شحنات');
    XLSX.writeFile(wb, `shipments-${new Date().toISOString().slice(0, 10)}.xlsx`);
    toast({ title: '✅ تم التصدير', description: `تم تصدير ${exportData.length} شحنة` });
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filtered.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filtered.map(s => s.id)));
    }
  };

  const statusCounts = shipments.reduce((acc, s) => {
    acc[s.status] = (acc[s.status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="p-3 sm:p-4 border-b border-border bg-card space-y-3 flex-shrink-0">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
              <Truck className="w-4.5 h-4.5 text-primary" />
            </div>
            <div>
              <h2 className="text-base font-bold text-foreground">جدول المتابعة</h2>
              <p className="text-xs text-muted-foreground">{shipments.length} شحنة</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.xlsx,.xls"
              onChange={handleFileUpload}
              className="hidden"
            />
            <Button
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="gap-1.5 text-xs"
            >
              {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
              رفع شيت
            </Button>
            <Button variant="outline" size="sm" onClick={exportSheet} className="gap-1.5 text-xs">
              <Download className="w-3.5 h-3.5" />
              تصدير
            </Button>
          </div>
        </div>

        {/* Status summary chips */}
        <div className="flex gap-1.5 flex-wrap">
          <button
            onClick={() => setStatusFilter('all')}
            className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${statusFilter === 'all' ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground hover:text-foreground'}`}
          >
            الكل ({shipments.length})
          </button>
          {Object.entries(STATUS_MAP).map(([key, { label }]) => {
            const count = statusCounts[key] || 0;
            if (count === 0) return null;
            return (
              <button
                key={key}
                onClick={() => setStatusFilter(key)}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${statusFilter === key ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground hover:text-foreground'}`}
              >
                {label} ({count})
              </button>
            );
          })}
        </div>

        {/* Search + Bulk actions */}
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="بحث بالبوليصة أو الاسم أو الرقم أو المنطقة..."
              className="bg-secondary border-0 text-xs pr-9 h-8"
            />
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
                {Object.entries(STATUS_MAP).map(([key, { label }]) => (
                  <DropdownMenuItem key={key} onClick={() => bulkUpdateStatus(key)}>
                    {label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-4 text-muted-foreground">
            <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center">
              <Truck className="w-8 h-8 text-primary" />
            </div>
            <p className="text-sm font-medium">لا توجد شحنات</p>
            <p className="text-xs">ارفع شيت شركة الشحن للبدء</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="text-xs">
                <TableHead className="w-10 text-center">
                  <input
                    type="checkbox"
                    checked={selectedIds.size === filtered.length && filtered.length > 0}
                    onChange={toggleSelectAll}
                    className="rounded border-border"
                  />
                </TableHead>
                <TableHead className="text-right">البوليصة</TableHead>
                <TableHead className="text-right">كود الطلب</TableHead>
                <TableHead className="text-right">العميل</TableHead>
                <TableHead className="text-right">الهاتف</TableHead>
                <TableHead className="text-right">المنطقة</TableHead>
                <TableHead className="text-right">المبلغ</TableHead>
                <TableHead className="text-right">الحالة</TableHead>
                <TableHead className="text-right">ملاحظات الشحن</TableHead>
                <TableHead className="text-right w-20">تفاصيل</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((s) => {
                const statusInfo = STATUS_MAP[s.status] || STATUS_MAP.pending;
                const StatusIcon = statusInfo.icon;
                return (
                  <TableRow key={s.id} className="text-xs">
                    <TableCell className="text-center">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(s.id)}
                        onChange={() => toggleSelect(s.id)}
                        className="rounded border-border"
                      />
                    </TableCell>
                    <TableCell className="font-mono text-xs">{s.shipment_code}</TableCell>
                    <TableCell className="text-xs">{s.order_code || '-'}</TableCell>
                    <TableCell className="text-xs">{s.customer_name || '-'}</TableCell>
                    <TableCell className="font-mono text-xs" dir="ltr">{s.customer_phone}</TableCell>
                    <TableCell className="text-xs">{s.customer_area || '-'}</TableCell>
                    <TableCell className="text-xs font-medium">{s.amount ? `${s.amount} ج.م` : '-'}</TableCell>
                    <TableCell>
                      <Select value={s.status} onValueChange={(v) => updateStatus(s.id, v)}>
                        <SelectTrigger className={`h-7 text-[10px] border ${statusInfo.color} bg-transparent w-[120px]`}>
                          <div className="flex items-center gap-1">
                            <StatusIcon className="w-3 h-3" />
                            <span>{statusInfo.label}</span>
                          </div>
                        </SelectTrigger>
                        <SelectContent>
                          {Object.entries(STATUS_MAP).map(([key, { label }]) => (
                            <SelectItem key={key} value={key} className="text-xs">{label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell className="text-xs max-w-[150px] truncate">{s.proc_notes || s.notes || '-'}</TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0"
                        title="عرض التفاصيل"
                        onClick={() => setDetailShipment(s)}
                      >
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

      {/* Detail Dialog */}
      <Dialog open={!!detailShipment} onOpenChange={() => setDetailShipment(null)}>
        <DialogContent className="max-w-lg" dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Package className="w-5 h-5 text-primary" />
              تفاصيل الشحنة
            </DialogTitle>
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
                <DetailRow label="آخر حالة" value={detailShipment.final_status} />
                <DetailRow label="تاريخ آخر حالة" value={detailShipment.last_status_date} />
              </div>
              <DetailRow label="العنوان" value={detailShipment.customer_address} full />
              <DetailRow label="تفاصيل الطلب (المنتجات)" value={detailShipment.order_details} full />
              <DetailRow label="تفصيل حالة الشحن" value={detailShipment.status_description} full />
              <DetailRow label="ملاحظات الشحن" value={detailShipment.proc_notes} full />
              {detailShipment.notes && <DetailRow label="ملاحظات إضافية" value={detailShipment.notes} full />}
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
    <p className={`text-sm font-medium text-foreground ${!value ? 'text-muted-foreground' : ''}`} dir={dir}>
      {value || '-'}
    </p>
  </div>
);

export default ShipmentTrackingTable;
