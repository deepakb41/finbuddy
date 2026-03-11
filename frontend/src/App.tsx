import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BottomNav } from "./components/layout/BottomNav";
import { TopHeader } from "./components/layout/TopHeader";
import { Dashboard } from "./pages/Dashboard";
import { AddTransaction } from "./pages/AddTransaction";
import { History } from "./pages/History";
import { Insights } from "./pages/Insights";
import { Swipe } from "./pages/Swipe";
import { Login } from "./pages/Login";
import { Settings } from "./pages/Settings";
import { AuthProvider, useAuth } from "./contexts/AuthContext";

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 30_000, retry: 1 } },
});

function PrivateRoutes() {
  const { isAuthed } = useAuth();
  if (!isAuthed) return <Navigate to="/login" replace />;
  return (
    <>
      <TopHeader />
      <div className="pt-14 pb-16">
        <Routes>
          <Route path="/"         element={<Dashboard />} />
          <Route path="/add"      element={<AddTransaction />} />
          <Route path="/history"  element={<History />} />
          <Route path="/insights" element={<Insights />} />
          <Route path="/inbox"    element={<Swipe />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="*"         element={<Navigate to="/" replace />} />
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
