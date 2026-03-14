import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useLocation, Link } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { TenantProvider } from "@/contexts/TenantContext";
import AppSidebar from "./components/layout/AppSidebar";
import Auth from "./pages/Auth";
import MainDashboard from "./pages/MainDashboard";
import Confirm from "./pages/Confirm";
import FollowUp from "./pages/FollowUp";
import Settings from "./pages/Settings";
import Contacts from "./pages/Contacts";
import Admin from "./pages/Admin";
import NotFound from "./pages/NotFound";
import { Loader2, LayoutDashboard, CheckCircle, Truck, Users } from "lucide-react";
import { useIsMobile } from "./hooks/use-mobile";

const queryClient = new QueryClient();

const mobileNav = [
  { icon: LayoutDashboard, label: 'الرئيسية', path: '/dashboard' },
  { icon: CheckCircle, label: 'التأكيد', path: '/confirm' },
  { icon: Truck, label: 'المتابعة', path: '/follow-up' },
  { icon: Users, label: 'جهات الاتصال', path: '/contacts' },
];

const MobileBottomNav = () => {
  const location = useLocation();
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-card border-t border-border flex items-center justify-around h-14 px-2 safe-area-bottom">
      {mobileNav.map((item) => {
        const isActive = location.pathname === item.path ||
          (item.path !== '/dashboard' && location.pathname.startsWith(item.path));
        return (
          <Link
            key={item.path}
            to={item.path}
            className={`flex flex-col items-center gap-0.5 flex-1 py-1 rounded-lg transition-colors ${
              isActive ? 'text-primary' : 'text-muted-foreground'
            }`}
          >
            <item.icon className={`w-5 h-5 ${isActive ? 'text-primary' : ''}`} />
            <span className="text-[10px] font-medium">{item.label}</span>
          </Link>
        );
      })}
    </nav>
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

        <main className={`flex-1 overflow-hidden ${isMobile ? 'pb-14' : ''}`}>
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
);

export default App;
