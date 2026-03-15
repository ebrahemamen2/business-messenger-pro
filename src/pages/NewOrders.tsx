
import { useState, useEffect } from 'react';
import { ShoppingBag, Search, Filter, RefreshCw, Eye, CheckCircle, Clock, AlertTriangle, Package, CreditCard, Truck } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useTenantContext } from '@/contexts/TenantContext';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { toast } from '@/hooks/use-toast';

interface Order {
  id: string;
  order_number: string;
  customer_name: string | null;
  customer_phone: string;
  customer_phone_alt: string | null;
  customer_email: string | null;
  customer_city: string | null;
  customer_sub_zone: string | null;
  customer_address: string | null;
  payment_method: string | null;
  payment_status: string | null;
  subtotal: number | null;
  shipping_cost: number | null;
  discount_amount: number | null;
  coupon_code: string | null;
  total_amount: number | null;
  currency: string;
  items: any[];
  status: string;
  order_source: string;
  notes: string | null;
  confirmation_message_sent: boolean;
  confirmed_at: string | null;
  abandoned_checkout_id: string | null;
  created_at: string;
  updated_at: string;
}

const STATUS_MAP: Record<string, { label: string; color: string; icon: any }> = {
  pending: { label: 'في الانتظار', color: 'bg-amber-500/15 text-amber-600 border-amber-500/20', icon: Clock },
  confirmed: { label: 'مؤكد', color: 'bg-emerald-500/15 text-emerald-600 border-emerald-500/20', icon: CheckCircle },
  lost: { label: 'مفقود', color: 'bg-destructive/15 text-destructive border-destructive/20', icon: AlertTriangle },
  shipped: { label: 'تم الشحن', color: 'bg-blue-500/15 text-blue-600 border-blue-500/20', icon: Package },
  cancelled: { label: 'ملغي', color: 'bg-muted text-muted-foreground border-border', icon: AlertTriangle },
};

const PAYMENT_MAP: Record<string, string> = {
  cod: 'دفع عند الاستلام',
  card: 'بطاقة',
  wallet: 'محفظة',
  bank_transfer: 'تحويل بنكي',
};

const NewOrders = () => {
  const { currentTenant } = useTenantContext();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);

  const fetchOrders = async () => {
    if (!currentTenant?.id) return;
    setLoading(true);

    let query = supabase
      .from('orders')
      .select('*')
      .eq('tenant_id', currentTenant.id)
      .order('created_at', { ascending: false });

    if (statusFilter !== 'all') {
      query = query.eq('status', statusFilter);
    }

    const { data, error } = await query;
    if (error) {
      console.error('Error fetching orders:', error);
      toast({ title: 'خطأ في تحميل الطلبات', variant: 'destructive' });
    } else {
      setOrders((data as Order[]) || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchOrders();
  }, [currentTenant?.id, statusFilter]);

  useEffect(() => {
    if (!currentTenant?.id) return;

    const channel = supabase
      .channel('orders-realtime')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'orders',
        filter: `tenant_id=eq.${currentTenant.id}`,
      }, () => {
        fetchOrders();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [currentTenant?.id]);

  const filtered = orders.filter((o) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      o.order_number.toLowerCase().includes(q) ||
      (o.customer_name || '').toLowerCase().includes(q) ||
      o.customer_phone.includes(q) ||
      (o.customer_city || '').toLowerCase().includes(q)
    );
  });

  const formatDate = (d: string) => {
    const date = new Date(d);
    return date.toLocaleDateString('ar-EG', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  const formatAmount = (amount: number | null, currency: string) => {
    if (amount == null) return '—';
    return `${amount.toFixed(2)} ${currency}`;
  };

  const stats = {
    total: orders.length,
    pending: orders.filter(o => o.status === 'pending').length,
    confirmed: orders.filter(o => o.status === 'confirmed').length,
    lost: orders.filter(o => o.status === 'lost').length,
  };

  return (
    <div className="flex flex-col h-full p-4 gap-4 overflow-auto">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <ShoppingBag className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-foreground">الطلبات الجديدة</h1>
            <p className="text-xs text-muted-foreground">الطلبات الواردة من المتجر</p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={fetchOrders} className="gap-2">
          <RefreshCw className="w-4 h-4" />
          تحديث
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'الكل', value: stats.total, color: 'bg-primary/10 text-primary' },
          { label: 'في الانتظار', value: stats.pending, color: 'bg-amber-500/10 text-amber-600' },
          { label: 'مؤكد', value: stats.confirmed, color: 'bg-emerald-500/10 text-emerald-600' },
          { label: 'مفقود', value: stats.lost, color: 'bg-destructive/10 text-destructive' },
        ].map((s) => (
          <div key={s.label} className="rounded-xl border border-border bg-card p-3 text-center">
            <p className={`text-2xl font-bold ${s.color.split(' ')[1]}`}>{s.value}</p>
            <p className="text-xs text-muted-foreground mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="بحث برقم الطلب، الاسم، الهاتف..."
            className="pr-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[150px]">
            <Filter className="w-4 h-4 ml-2" />
            <SelectValue placeholder="الحالة" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">الكل</SelectItem>
            <SelectItem value="pending">في الانتظار</SelectItem>
            <SelectItem value="confirmed">مؤكد</SelectItem>
            <SelectItem value="lost">مفقود</SelectItem>
            <SelectItem value="shipped">تم الشحن</SelectItem>
            <SelectItem value="cancelled">ملغي</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <RefreshCw className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-3">
          <ShoppingBag className="w-12 h-12 opacity-30" />
          <p className="text-sm">لا توجد طلبات {statusFilter !== 'all' ? `بحالة "${STATUS_MAP[statusFilter]?.label}"` : ''}</p>
          <p className="text-xs text-muted-foreground/60">الطلبات ستظهر هنا تلقائياً عند ربط المتجر</p>
        </div>
      ) : (
        <div className="rounded-xl border border-border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="text-right">رقم الطلب</TableHead>
                <TableHead className="text-right">العميل</TableHead>
                <TableHead className="text-right">الهاتف</TableHead>
                <TableHead className="text-right">المدينة</TableHead>
                <TableHead className="text-right">المبلغ</TableHead>
                <TableHead className="text-right">الدفع</TableHead>
                <TableHead className="text-right">الحالة</TableHead>
                <TableHead className="text-right">التاريخ</TableHead>
                <TableHead className="text-right w-10"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((order) => {
                const st = STATUS_MAP[order.status] || STATUS_MAP.pending;
                const Icon = st.icon;
                return (
                  <TableRow key={order.id} className="hover:bg-muted/30 cursor-pointer" onClick={() => setSelectedOrder(order)}>
                    <TableCell className="font-mono font-semibold text-foreground">#{order.order_number}</TableCell>
                    <TableCell>{order.customer_name || '—'}</TableCell>
                    <TableCell dir="ltr" className="text-muted-foreground">{order.customer_phone}</TableCell>
                    <TableCell>{order.customer_city || '—'}</TableCell>
                    <TableCell className="font-semibold">{formatAmount(order.total_amount, order.currency)}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{PAYMENT_MAP[order.payment_method || ''] || order.payment_method || '—'}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={`gap-1 ${st.color}`}>
                        <Icon className="w-3 h-3" />
                        {st.label}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-xs">{formatDate(order.created_at)}</TableCell>
                    <TableCell>
                      <Eye className="w-4 h-4 text-muted-foreground" />
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Order detail dialog */}
      <Dialog open={!!selectedOrder} onOpenChange={() => setSelectedOrder(null)}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShoppingBag className="w-5 h-5 text-primary" />
              طلب #{selectedOrder?.order_number}
            </DialogTitle>
          </DialogHeader>
          {selectedOrder && (
            <div className="space-y-4 text-sm">
              {/* Customer info */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-muted-foreground text-xs">العميل</p>
                  <p className="font-medium">{selectedOrder.customer_name || '—'}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">الهاتف</p>
                  <p className="font-medium" dir="ltr">{selectedOrder.customer_phone}</p>
                </div>
                {selectedOrder.customer_phone_alt && (
                  <div>
                    <p className="text-muted-foreground text-xs">هاتف بديل</p>
                    <p className="font-medium" dir="ltr">{selectedOrder.customer_phone_alt}</p>
                  </div>
                )}
                {selectedOrder.customer_email && (
                  <div>
                    <p className="text-muted-foreground text-xs">البريد</p>
                    <p className="font-medium" dir="ltr">{selectedOrder.customer_email}</p>
                  </div>
                )}
                <div>
                  <p className="text-muted-foreground text-xs">المدينة</p>
                  <p className="font-medium">{selectedOrder.customer_city || '—'}</p>
                </div>
                {selectedOrder.customer_sub_zone && (
                  <div>
                    <p className="text-muted-foreground text-xs">المنطقة</p>
                    <p className="font-medium">{selectedOrder.customer_sub_zone}</p>
                  </div>
                )}
              </div>

              {selectedOrder.customer_address && (
                <div>
                  <p className="text-muted-foreground text-xs">العنوان</p>
                  <p className="font-medium">{selectedOrder.customer_address}</p>
                </div>
              )}

              {/* Items */}
              {selectedOrder.items && selectedOrder.items.length > 0 && (
                <div>
                  <p className="text-muted-foreground text-xs mb-2">المنتجات</p>
                  <div className="space-y-1.5">
                    {selectedOrder.items.map((item: any, i: number) => (
                      <div key={i} className="flex items-center justify-between bg-muted/50 rounded-lg px-3 py-2">
                        <div>
                          <span>{item.name || `منتج ${i + 1}`}</span>
                          {item.variant_info && (
                            <span className="text-muted-foreground text-xs mr-2">({item.variant_info})</span>
                          )}
                        </div>
                        <span className="text-muted-foreground text-xs">
                          ×{item.quantity || 1}
                          {(item.unit_price || item.price) && ` — ${item.total_price || item.price} ${selectedOrder.currency}`}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Pricing breakdown */}
              <div className="rounded-lg bg-muted/30 p-3 space-y-1.5">
                {selectedOrder.subtotal != null && (
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">المجموع الفرعي</span>
                    <span>{formatAmount(selectedOrder.subtotal, selectedOrder.currency)}</span>
                  </div>
                )}
                {(selectedOrder.shipping_cost ?? 0) > 0 && (
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground flex items-center gap-1"><Truck className="w-3 h-3" /> الشحن</span>
                    <span>{formatAmount(selectedOrder.shipping_cost, selectedOrder.currency)}</span>
                  </div>
                )}
                {(selectedOrder.discount_amount ?? 0) > 0 && (
                  <div className="flex justify-between text-xs text-emerald-600">
                    <span>خصم {selectedOrder.coupon_code ? `(${selectedOrder.coupon_code})` : ''}</span>
                    <span>-{formatAmount(selectedOrder.discount_amount, selectedOrder.currency)}</span>
                  </div>
                )}
                <div className="flex justify-between font-semibold border-t border-border pt-1.5 mt-1.5">
                  <span>الإجمالي</span>
                  <span>{formatAmount(selectedOrder.total_amount, selectedOrder.currency)}</span>
                </div>
              </div>

              {/* Payment info */}
              {selectedOrder.payment_method && (
                <div className="flex items-center gap-2">
                  <CreditCard className="w-4 h-4 text-muted-foreground" />
                  <span className="text-xs">{PAYMENT_MAP[selectedOrder.payment_method] || selectedOrder.payment_method}</span>
                  {selectedOrder.payment_status && (
                    <Badge variant="outline" className="text-[10px]">{selectedOrder.payment_status}</Badge>
                  )}
                </div>
              )}

              {selectedOrder.notes && (
                <div>
                  <p className="text-muted-foreground text-xs">ملاحظات</p>
                  <p>{selectedOrder.notes}</p>
                </div>
              )}

              <div className="flex items-center gap-2 pt-2 flex-wrap">
                {(() => {
                  const st = STATUS_MAP[selectedOrder.status] || STATUS_MAP.pending;
                  const Icon = st.icon;
                  return (
                    <Badge variant="outline" className={`gap-1 ${st.color}`}>
                      <Icon className="w-3 h-3" />
                      {st.label}
                    </Badge>
                  );
                })()}
                <span className="text-xs text-muted-foreground">{formatDate(selectedOrder.created_at)}</span>
                {selectedOrder.confirmation_message_sent && (
                  <Badge variant="outline" className="gap-1 bg-emerald-500/10 text-emerald-600 border-emerald-500/20">
                    <CheckCircle className="w-3 h-3" />
                    تم إرسال التأكيد
                  </Badge>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default NewOrders;
