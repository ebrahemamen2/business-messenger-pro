import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CheckCircle, Truck, Users, MessageSquare, TrendingUp, Clock } from 'lucide-react';
import { Link } from 'react-router-dom';

const stats = [
  { label: 'محادثات التأكيد', value: '0', icon: CheckCircle, color: 'text-green-400', path: '/confirm' },
  { label: 'محادثات المتابعة', value: '0', icon: Truck, color: 'text-blue-400', path: '/follow-up' },
  { label: 'جهات الاتصال', value: '0', icon: Users, color: 'text-purple-400', path: '/contacts' },
  { label: 'الرسائل اليوم', value: '0', icon: MessageSquare, color: 'text-yellow-400', path: '#' },
];

const MainDashboard = () => {
  return (
    <div className="h-full overflow-y-auto p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">لوحة التحكم</h1>
        <p className="text-muted-foreground text-sm mt-1">نظرة عامة على نشاط البراند</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat) => (
          <Link key={stat.label} to={stat.path}>
            <Card className="border-border hover:border-primary/30 transition-colors cursor-pointer">
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">{stat.label}</p>
                    <p className="text-3xl font-bold text-foreground mt-1">{stat.value}</p>
                  </div>
                  <div className={`w-12 h-12 rounded-xl bg-secondary flex items-center justify-center ${stat.color}`}>
                    <stat.icon className="w-6 h-6" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="border-border">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-green-400" />
              قسم التأكيد
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              متابعة ردود العملاء على رسائل تأكيد الطلبات مع دعم الذكاء الاصطناعي
            </p>
            <Link
              to="/confirm"
              className="inline-flex items-center gap-2 text-sm text-primary hover:underline"
            >
              فتح محادثات التأكيد
              <TrendingUp className="w-4 h-4" />
            </Link>
          </CardContent>
        </Card>

        <Card className="border-border">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Truck className="w-5 h-5 text-blue-400" />
              قسم المتابعة
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              متابعة الأوردرات مع شركات الشحن والتواصل مع العملاء
            </p>
            <Link
              to="/follow-up"
              className="inline-flex items-center gap-2 text-sm text-primary hover:underline"
            >
              فتح محادثات المتابعة
              <Clock className="w-4 h-4" />
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default MainDashboard;
