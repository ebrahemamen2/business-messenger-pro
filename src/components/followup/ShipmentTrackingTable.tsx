import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useTenantContext } from '@/contexts/TenantContext';
import { useToast } from '@/hooks/use-toast';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Upload, Download, Search, Loader2, Truck, Package, RefreshCw,
  CheckCircle, XCircle, Clock, AlertTriangle, Filter, Send
} from 'lucide-react';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import * as XLSX from 'xlsx';

interface Shipment {
  id: string;
  shipment_code: string;
  order_code: string | null;
  customer_phone: string;
  customer_name: string | null;
  status: string;
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

  const loadShipments = useCallback(async () => {
    if (!currentTenant?.id) return;
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
    if (error) {
      console.error('Load shipments error:', error);
    }
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
      (s.customer_name || '').toLowerCase().includes(q)
    );
  });

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !currentTenant?.id) return;
    setUploading(true);

    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data);
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows: any[] = XLSX.utils.sheet_to_json(sheet, { defval: '' });

      if (rows.length === 0) {
        toast({ title: '⚠️ الملف فارغ', description: 'لا توجد بيانات في الملف', variant: 'destructive' });
        setUploading(false);
        return;
      }

      // Auto-detect columns (flexible mapping)
      const firstRow = rows[0];
      const keys = Object.keys(firstRow);
      
      const findCol = (patterns: string[]) => 
        keys.find(k => patterns.some(p => k.toLowerCase().includes(p.toLowerCase())));

      const shipmentCol = findCol(['بوليصة', 'بوليصه', 'shipment', 'tracking', 'awb', 'كود الشحن', 'رقم البوليصة', 'رقم الشحنة']);
      const orderCol = findCol(['طلب', 'order', 'اوردر', 'أوردر', 'رقم الطلب', 'كود الطلب']);
      const phoneCol = findCol(['هاتف', 'تليفون', 'تلفون', 'موبايل', 'phone', 'mobile', 'رقم العميل', 'رقم الهاتف']);
      const nameCol = findCol(['اسم', 'name', 'عميل', 'customer', 'اسم العميل']);
      const statusCol = findCol(['حالة', 'حاله', 'status', 'الحالة', 'الحاله']);
      const notesCol = findCol(['ملاحظ', 'notes', 'note', 'سبب', 'تعليق']);

      if (!shipmentCol && !phoneCol) {
        toast({
          title: '❌ تنسيق غير معروف',
          description: 'الملف لازم يحتوي على عمود بوليصة أو رقم هاتف على الأقل. الأعمدة الموجودة: ' + keys.join(', '),
          variant: 'destructive',
        });
        setUploading(false);
        return;
      }

      const shipmentRows = rows.map(row => ({
        tenant_id: currentTenant.id,
        shipment_code: String(shipmentCol ? row[shipmentCol] : '').trim() || `AUTO-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        order_code: orderCol ? String(row[orderCol]).trim() || null : null,
        customer_phone: phoneCol ? String(row[phoneCol]).replace(/[\s\-\+]/g, '').trim() : '',
        customer_name: nameCol ? String(row[nameCol]).trim() || null : null,
        status: statusCol ? mapStatus(String(row[statusCol]).trim()) : 'pending',
        notes: notesCol ? String(row[notesCol]).trim() || null : null,
        shipping_company: null,
        wa_template_sent: false,
      })).filter(r => r.customer_phone || r.shipment_code);

      // Batch insert
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

  const mapStatus = (raw: string): string => {
    const lower = raw.toLowerCase();
    if (lower.includes('deliver') || lower.includes('تسليم') || lower.includes('مستلم')) return 'delivered';
    if (lower.includes('return') || lower.includes('مرتجع') || lower.includes('راجع')) return 'returned';
    if (lower.includes('reschedul') || lower.includes('تأجيل') || lower.includes('مؤجل')) return 'rescheduled';
    if (lower.includes('cancel') || lower.includes('ملغ') || lower.includes('الغ')) return 'cancelled';
    if (lower.includes('out') || lower.includes('خرج') || lower.includes('طريق')) return 'out_for_delivery';
    if (lower.includes('no answer') || lower.includes('لا يرد') || lower.includes('مايردش')) return 'no_answer';
    if (lower.includes('ready') || lower.includes('جاهز')) return 'ready';
    return 'pending';
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
      'كود البوليصة': s.shipment_code,
      'كود الطلب': s.order_code || '',
      'اسم العميل': s.customer_name || '',
      'رقم الهاتف': s.customer_phone,
      'الحالة': STATUS_MAP[s.status]?.label || s.status,
      'ملاحظات': s.notes || '',
      'تاريخ الرفع': new Date(s.uploaded_at).toLocaleDateString('ar-EG'),
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
              placeholder="بحث بالبوليصة أو الاسم أو الرقم..."
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
                <TableHead className="text-right">الطلب</TableHead>
                <TableHead className="text-right">العميل</TableHead>
                <TableHead className="text-right">الهاتف</TableHead>
                <TableHead className="text-right">الحالة</TableHead>
                <TableHead className="text-right">ملاحظات</TableHead>
                <TableHead className="text-right w-24">إجراء</TableHead>
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
                    <TableCell className="text-xs max-w-[150px] truncate">{s.notes || '-'}</TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0"
                        title="إرسال رسالة واتساب"
                        disabled={!s.customer_phone}
                      >
                        <Send className="w-3.5 h-3.5" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
};

export default ShipmentTrackingTable;
