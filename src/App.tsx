import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useLocation, Link } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import { useTheme } from "next-themes";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { TenantProvider, useTenantContext } from "@/contexts/TenantContext";
import AppSidebar from "./components/layout/AppSidebar";
import Auth from "./pages/Auth";
import MainDashboard from "./pages/MainDashboard";
import Confirm from "./pages/Confirm";
import FollowUp from "./pages/FollowUp";
import Settings from "./pages/Settings";
import Contacts from "./pages/Contacts";
import Admin from "./pages/Admin";
import NotFound from "./pages/NotFound";
import { Loader2, LayoutDashboard, CheckCircle, Truck, Users, Settings as SettingsIcon, Building2, ChevronDown, Sun, Moon, LogOut } from "lucide-react";
import { useIsMobile } from "./hooks/use-mobile";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const queryClient = new QueryClient();

const mobileNav = [
  { icon: LayoutDashboard, label: 'الرئيسية', path: '/dashboard' },
  { icon: CheckCircle, label: 'التأكيد', path: '/confirm' },
  { icon: Truck, label: 'المتابعة', path: '/follow-up' },
  { icon: Users, label: 'الاتصال', path: '/contacts' },
  { icon: SettingsIcon, label: 'المزيد', path: '/settings' },
];

const MobileBottomNav = () => {
  const location = useLocation();
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-card/95 backdrop-blur-md border-t border-border flex items-center justify-around px-1 pb-[env(safe-area-inset-bottom,0px)]" style={{ height: 'calc(56px + env(safe-area-inset-bottom, 0px))' }}>
      {mobileNav.map((item) => {
        const isActive = location.pathname === item.path ||
          (item.path !== '/dashboard' && item.path !== '/settings' && location.pathname.startsWith(item.path));
        return (
          <Link
            key={item.path}
            to={item.path}
            className={`flex flex-col items-center gap-0.5 flex-1 pt-1.5 pb-1 rounded-lg transition-colors ${
              isActive ? 'text-primary' : 'text-muted-foreground'
            }`}
          >
            <item.icon className={`w-5 h-5 ${isActive ? 'text-primary' : ''}`} />
            <span className="text-[10px] font-medium leading-tight">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
};

const MobileTopBar = () => {
  const { tenants, currentTenant, selectTenant } = useTenantContext();
  const { signOut, isSuperAdmin } = useAuth();
  const { theme, setTheme } = useTheme();

  return (
    <div className="h-11 bg-card border-b border-border flex items-center justify-between px-3 flex-shrink-0">
      {/* Tenant Selector */}
      {tenants.length > 0 ? (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-secondary transition-colors min-w-0">
              <div className="w-7 h-7 rounded-lg bg-primary/15 flex items-center justify-center flex-shrink-0">
                <span className="text-xs font-bold text-primary">{currentTenant?.name?.charAt(0) || 'B'}</span>
              </div>
              <span className="text-sm font-semibold text-foreground max-w-[180px] truncate">{currentTenant?.name || 'اختر براند'}</span>
              {tenants.length > 1 && <ChevronDown className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />}
            </button>
          </DropdownMenuTrigger>
          {tenants.length > 1 && (
            <DropdownMenuContent align="start" className="min-w-[200px]">
              {tenants.map((t) => (
                <DropdownMenuItem
                  key={t.id}
                  onClick={() => selectTenant(t)}
                  className={`gap-2 ${t.id === currentTenant?.id ? 'bg-secondary' : ''}`}
                >
                  <div className="w-6 h-6 rounded-md bg-primary/15 flex items-center justify-center flex-shrink-0">
                    <span className="text-[10px] font-bold text-primary">{t.name.charAt(0)}</span>
                  </div>
                  <span className="font-medium">{t.name}</span>
                  {t.id === currentTenant?.id && <CheckCircle className="w-3.5 h-3.5 text-primary mr-auto" />}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          )}
        </DropdownMenu>
      ) : (
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-primary/15 flex items-center justify-center">
            <Building2 className="w-4 h-4 text-primary" />
          </div>
          <span className="text-sm font-semibold text-foreground">جاري التحميل...</span>
        </div>
      )}

      {/* Right actions */}
      <div className="flex items-center gap-0.5">
        <button
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
        >
          {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        </button>
        <button
          onClick={signOut}
          className="p-2 rounded-lg text-muted-foreground hover:text-destructive hover:bg-secondary transition-colors"
        >
          <LogOut className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

const ProtectedLayout = () => {
  const { user, loading } = useAuth();
  const isMobile = useIsMobile();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) return <Navigate to="/auth" replace />;

  return (
    <TenantProvider>
      <div className="flex h-screen overflow-hidden">
        {/* Sidebar: hidden on mobile */}
        {!isMobile && <AppSidebar />}

        <div className={`flex-1 flex flex-col overflow-hidden ${isMobile ? 'pb-[calc(56px+env(safe-area-inset-bottom,0px))]' : ''}`}>
          {/* Mobile top bar with tenant selector */}
          {isMobile && <MobileTopBar />}

          <main className="flex-1 overflow-hidden">
            <Routes>
              <Route path="/dashboard" element={<MainDashboard />} />
              <Route path="/confirm" element={<Confirm />} />
              <Route path="/follow-up" element={<FollowUp />} />
              <Route path="/contacts" element={<Contacts />} />
              <Route path="/settings" element={<Settings />} />
              <Route path="/admin" element={<Admin />} />
              <Route path="/" element={<Navigate to="/dashboard" replace />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </main>
        </div>

        {/* Bottom nav: only on mobile */}
        {isMobile && <MobileBottomNav />}
      </div>
    </TenantProvider>
  );
};

const AppRoutes = () => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <Routes>
      <Route path="/auth" element={user ? <Navigate to="/dashboard" replace /> : <Auth />} />
      <Route path="/*" element={<ProtectedLayout />} />
    </Routes>
  );
};

const App = () => (
  <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false} storageKey="app-theme">
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AuthProvider>
            <AppRoutes />
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  </ThemeProvider>
);

export default App;
