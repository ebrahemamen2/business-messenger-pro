import { MessageSquare, Clock, Star, Send, TrendingUp, Users } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip } from 'recharts';
import { chartData, conversations } from '@/data/mockData';

const stats = [
  { label: 'محادثات نشطة', value: '24', icon: MessageSquare, change: '+12%', up: true },
  { label: 'متوسط الاستجابة', value: '2.5 د', icon: Clock, change: '-18%', up: true },
  { label: 'رضا العملاء', value: '94%', icon: Star, change: '+3%', up: true },
  { label: 'رسائل اليوم', value: '156', icon: Send, change: '+25%', up: true },
  { label: 'عملاء جدد', value: '18', icon: Users, change: '+8%', up: true },
  { label: 'معدل الحل', value: '87%', icon: TrendingUp, change: '+5%', up: true },
];

const Dashboard = () => {
  return (
    <div className="p-4 sm:p-6 space-y-4 sm:space-y-6 overflow-y-auto h-full">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-foreground">لوحة التحكم</h1>
        <p className="text-sm text-muted-foreground mt-1">نظرة عامة على أداء خدمة العملاء</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4">
        {stats.map((stat) => (
          <Card key={stat.label} className="p-4 sm:p-5 bg-card border-border hover:border-primary/30 transition-colors">
            <div className="flex items-center justify-between mb-2 sm:mb-3">
              <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <stat.icon className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
              </div>
              <span className="text-[10px] sm:text-xs font-semibold text-primary bg-primary/10 px-1.5 sm:px-2 py-0.5 rounded-full">
                {stat.change}
              </span>
            </div>
            <p className="text-xl sm:text-2xl font-bold text-foreground">{stat.value}</p>
            <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">{stat.label}</p>
          </Card>
        ))}
      </div>

      {/* Chart */}
      <Card className="p-4 sm:p-5 bg-card border-border">
        <h3 className="font-semibold text-foreground mb-1">حجم الرسائل</h3>
        <p className="text-xs text-muted-foreground mb-4">إحصائيات الرسائل خلال الأسبوع</p>
        <ResponsiveContainer width="100%" height={220}>
          <AreaChart data={chartData}>
            <defs>
              <linearGradient id="msgGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="hsl(142 70% 45%)" stopOpacity={0.3} />
                <stop offset="100%" stopColor="hsl(142 70% 45%)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(220 15% 18%)" />
            <XAxis dataKey="name" stroke="hsl(215 15% 55%)" fontSize={11} />
            <YAxis stroke="hsl(215 15% 55%)" fontSize={11} />
            <Tooltip
              contentStyle={{
                backgroundColor: 'hsl(220 18% 11%)',
                border: '1px solid hsl(220 15% 18%)',
                borderRadius: '8px',
                color: 'hsl(210 20% 95%)',
                fontFamily: 'Cairo',
                fontSize: '12px',
              }}
            />
            <Area
              type="monotone"
              dataKey="messages"
              stroke="hsl(142 70% 45%)"
              strokeWidth={2}
              fill="url(#msgGradient)"
              name="الرسائل"
            />
            <Area
              type="monotone"
              dataKey="responses"
              stroke="hsl(210 100% 65%)"
              strokeWidth={2}
              fill="none"
              strokeDasharray="5 5"
              name="الردود"
            />
          </AreaChart>
        </ResponsiveContainer>
      </Card>

      {/* Recent Activity */}
      <Card className="p-4 sm:p-5 bg-card border-border">
        <h3 className="font-semibold text-foreground mb-4">آخر المحادثات</h3>
        <div className="space-y-2 sm:space-y-3">
          {conversations.slice(0, 4).map((conv) => (
            <div
              key={conv.id}
              className="flex items-center gap-3 p-3 rounded-xl bg-secondary/50 hover:bg-secondary transition-colors"
            >
              <div className="w-9 h-9 rounded-full bg-primary/15 flex items-center justify-center flex-shrink-0">
                <span className="text-xs font-bold text-primary">
                  {conv.contact.name.charAt(0)}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-foreground truncate">
                    {conv.contact.name}
                  </span>
                  <span className="text-[10px] text-muted-foreground flex-shrink-0 mr-1">
                    {conv.lastMessageTime}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground truncate mt-0.5">
                  {conv.lastMessage}
                </p>
              </div>
              <span
                className={`px-2 py-0.5 rounded-full text-[10px] font-semibold flex-shrink-0 ${
                  conv.status === 'active'
                    ? 'bg-status-active/15 text-status-active'
                    : conv.status === 'pending'
                    ? 'bg-status-pending/15 text-status-pending'
                    : 'bg-status-resolved/15 text-status-resolved'
                }`}
              >
                {conv.status === 'active' ? 'نشط' : conv.status === 'pending' ? 'معلق' : 'مكتمل'}
              </span>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
};

export default Dashboard;
