import { ShoppingBag } from 'lucide-react';

const NewOrders = () => {
  return (
    <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-4">
      <div className="w-20 h-20 rounded-2xl bg-primary/10 flex items-center justify-center">
        <ShoppingBag className="w-10 h-10 text-primary" />
      </div>
      <div className="text-center">
        <p className="font-semibold text-foreground text-lg">الطلبات الجديدة</p>
        <p className="text-sm mt-1">قريباً - جدول الطلبات الجديدة من المتجر</p>
        <p className="text-xs mt-2 text-muted-foreground/70">
          سيتم ربطه بالمتجر لاستقبال الطلبات ومراجعتها وتصديرها لشركة الشحن
        </p>
      </div>
    </div>
  );
};

export default NewOrders;
