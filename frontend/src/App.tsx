import { useEffect } from "react";
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from "react-router-dom";
import { QueryClient, QueryClientProvider, useQuery } from "@tanstack/react-query";
import { RefreshCw } from "lucide-react";
import { BottomNav } from "./components/layout/BottomNav";
import { TopHeader } from "./components/layout/TopHeader";
import { usePullToRefresh } from "./hooks/usePullToRefresh";
import { Dashboard } from "./pages/Dashboard";
import { AddTransaction } from "./pages/AddTransaction";
import { History } from "./pages/History";
import { Insights } from "./pages/Insights";
import { Swipe } from "./pages/Swipe";
import { Login } from "./pages/Login";
import { Settings } from "./pages/Settings";
import { Onboarding } from "./pages/Onboarding";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { api } from "./api/client";

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 30_000, retry: 1 } },
});

function useAutoProcessRecurring() {
  useEffect(() => {
    // Idempotent — safe to call every app open
    api.profile.processRecurring().catch(() => {/* silent */});
  }, []);
}

function OnboardingGuard() {
  const navigate = useNavigate();
  const { data: profile } = useQuery({
    queryKey: ["profile"],
    queryFn: () => api.profile.get(),
    staleTime: 60_000,
  });

  useEffect(() => {
    if (profile && !profile.onboarding_completed) {
      navigate("/onboarding", { replace: true });
    }
  }, [profile, navigate]);

  return null;
}

function PrivateRoutes() {
  const { isAuthed } = useAuth();
  useAutoProcessRecurring();
  const { refreshing } = usePullToRefresh();

  if (!isAuthed) return <Navigate to="/login" replace />;
  return (
    <>
      <OnboardingGuard />
      <TopHeader />
      {refreshing && (
        <div className="fixed top-14 left-0 right-0 z-40 flex justify-center py-2 pointer-events-none">
          <div className="bg-white dark:bg-gray-800 rounded-full shadow-md px-3 py-1.5 flex items-center gap-2 text-xs text-teal-600 dark:text-teal-400 font-medium">
            <RefreshCw size={12} className="animate-spin" />
            Refreshing…
          </div>
        </div>
      )}
      <div className="pt-14 pb-16">
        <Routes>
          <Route path="/"           element={<Dashboard />} />
          <Route path="/add"        element={<AddTransaction />} />
          <Route path="/history"    element={<History />} />
          <Route path="/insights"   element={<Insights />} />
          <Route path="/inbox"      element={<Swipe />} />
          <Route path="/settings"   element={<Settings />} />
          <Route path="/onboarding" element={<Onboarding />} />
          <Route path="*"           element={<Navigate to="/" replace />} />
        </Routes>
      </div>
      <BottomNav />
    </>
  );
}

function App() {
  return (
    <AuthProvider>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <Routes>
            <Route path="/login"    element={<Login />} />
            <Route path="/register" element={<Login />} />
            <Route path="/*"        element={<PrivateRoutes />} />
          </Routes>
        </BrowserRouter>
      </QueryClientProvider>
    </AuthProvider>
  );
}

export default App;
