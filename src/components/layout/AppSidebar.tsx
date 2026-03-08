import { 
  MessageSquare, LayoutDashboard, Settings, Users, Bot, LogOut, 
  CheckCircle, Truck, Shield, ChevronDown 
} from 'lucide-react';
import { useLocation, Link } from 'react-router-dom';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useAuth } from '@/contexts/AuthContext';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

const mainNav = [
  { icon: LayoutDashboard, label: 'لوحة التحكم', path: '/dashboard' },
  { icon: CheckCircle, label: 'التأكيد', path: '/confirm' },
  { icon: Truck, label: 'المتابعة', path: '/follow-up' },
  { icon: Users, label: 'جهات الاتصال', path: '/contacts' },
  { icon: Bot, label: 'الرد التلقائي', path: '/auto-reply' },
];

const AppSidebar = () => {
  const location = useLocation();
  const { signOut, isSuperAdmin } = useAuth();

  const navItems = isSuperAdmin
    ? [...mainNav, { icon: Shield, label: 'إدارة المنصة', path: '/admin' }]
    : mainNav;

  return (
    <div className="w-[72px] h-screen bg-card border-r border-border flex flex-col items-center py-4 flex-shrink-0">
      {/* Logo */}
      <div className="w-11 h-11 rounded-xl bg-primary flex items-center justify-center mb-8">
        <MessageSquare className="w-5 h-5 text-primary-foreground" />
      </div>

      {/* Navigation */}
      <nav className="flex-1 flex flex-col gap-1">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path || 
            (item.path !== '/dashboard' && location.pathname.startsWith(item.path));
          return (
            <Tooltip key={item.path} delayDuration={0}>
              <TooltipTrigger asChild>
                <Link
                  to={item.path}
                  className={`w-11 h-11 rounded-xl flex items-center justify-center transition-all duration-200 ${
                    isActive
                      ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/25'
                      : 'text-muted-foreground hover:text-foreground hover:bg-secondary'
                  }`}
                >
                  <item.icon className="w-5 h-5" />
                </Link>
              </TooltipTrigger>
              <TooltipContent side="right" className="font-cairo">
                {item.label}
              </TooltipContent>
            </Tooltip>
          );
        })}
      </nav>

      {/* Bottom */}
      <div className="flex flex-col gap-1">
        <Tooltip delayDuration={0}>
          <TooltipTrigger asChild>
            <Link
              to="/settings"
              className={`w-11 h-11 rounded-xl flex items-center justify-center transition-all duration-200 ${
                location.pathname === '/settings'
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:text-foreground hover:bg-secondary'
              }`}
            >
              <Settings className="w-5 h-5" />
            </Link>
          </TooltipTrigger>
          <TooltipContent side="right" className="font-cairo">الإعدادات</TooltipContent>
        </Tooltip>

        <Tooltip delayDuration={0}>
          <TooltipTrigger asChild>
            <button
              onClick={signOut}
              className="w-11 h-11 rounded-xl flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-secondary transition-all duration-200"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="right" className="font-cairo">تسجيل الخروج</TooltipContent>
        </Tooltip>
      </div>
    </div>
  );
};

export default AppSidebar;
