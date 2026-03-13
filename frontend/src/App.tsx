import { useEffect } from "react";
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from "react-router-dom";
import { QueryClient, QueryClientProvider, useQuery } from "@tanstack/react-query";
import { BottomNav } from "./components/layout/BottomNav";
import { TopHeader } from "./components/layout/TopHeader";
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

  if (!isAuthed) return <Navigate to="/login" replace />;
  return (
    <>
      <OnboardingGuard />
      <TopHeader />
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
