import { 
  MessageSquare, LayoutDashboard, Settings, Users, Bot, LogOut, 
  CheckCircle, Truck, Shield, Building2, ChevronDown, Sun, Moon
} from 'lucide-react';
import { useLocation, Link } from 'react-router-dom';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useAuth } from '@/contexts/AuthContext';
import { useTenantContext } from '@/contexts/TenantContext';
import { useTheme } from 'next-themes';
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
];

const AppSidebar = () => {
  const location = useLocation();
  const { signOut, isSuperAdmin } = useAuth();
  const { tenants, currentTenant, selectTenant } = useTenantContext();
  const { theme, setTheme } = useTheme();

  const navItems = isSuperAdmin
    ? [...mainNav, { icon: Shield, label: 'إدارة المنصة', path: '/admin' }]
    : mainNav;

  return (
    <div className="w-[72px] h-screen bg-sidebar border-r border-sidebar-border flex flex-col items-center py-4 flex-shrink-0">
      {/* Tenant Selector */}
      {tenants.length > 0 ? (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="w-11 h-11 rounded-xl bg-sidebar-accent flex items-center justify-center mb-2 hover:bg-sidebar-accent/80 transition-colors" title={currentTenant?.name}>
              <span className="text-sm font-bold text-sidebar-foreground">
                {currentTenant?.name?.charAt(0) || 'B'}
              </span>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent side="right" align="start" className="min-w-[180px]">
            {tenants.map((t) => (
              <DropdownMenuItem
                key={t.id}
                onClick={() => selectTenant(t)}
                className={`gap-2 ${t.id === currentTenant?.id ? 'bg-secondary' : ''}`}
              >
                <Building2 className="w-4 h-4 text-primary" />
                <span className="font-medium">{t.name}</span>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      ) : (
        <div className="w-11 h-11 rounded-xl bg-primary flex items-center justify-center mb-2">
          <MessageSquare className="w-5 h-5 text-primary-foreground" />
        </div>
      )}

      {/* Tenant name */}
      {currentTenant && (
        <p className="text-[9px] text-muted-foreground text-center mb-4 max-w-[60px] truncate">
          {currentTenant.name}
        </p>
      )}

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
        {/* Theme toggle */}
        <Tooltip delayDuration={0}>
          <TooltipTrigger asChild>
            <button
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              className="w-11 h-11 rounded-xl flex items-center justify-center text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent transition-all duration-200"
            >
              {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </button>
          </TooltipTrigger>
          <TooltipContent side="right" className="font-cairo">
            {theme === 'dark' ? 'الوضع الفاتح' : 'الوضع الداكن'}
          </TooltipContent>
        </Tooltip>

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
