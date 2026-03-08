import { Truck } from 'lucide-react';

const FollowUp = () => {
  return (
    <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground gap-4 h-full">
      <div className="w-20 h-20 rounded-2xl bg-blue-500/10 flex items-center justify-center">
        <Truck className="w-10 h-10 text-blue-400" />
      </div>
      <div className="text-center">
        <p className="font-semibold text-foreground text-lg">قسم المتابعة</p>
        <p className="text-sm mt-1">قريباً - متابعة الأوردرات مع شركات الشحن</p>
      </div>
    </div>
  );
};

export default FollowUp;
