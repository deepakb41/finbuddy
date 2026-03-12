import { createContext, useContext, useState, useCallback, type ReactNode } from "react";

const BASE = import.meta.env.VITE_API_URL || "http://localhost:8000/api";
const TOKEN_KEY = "finbuddy_token";
const USER_KEY  = "finbuddy_user";

interface AuthUser { id: number; email?: string }

interface AuthContextValue {
  user: AuthUser | null;
  isAuthed: boolean;
  requestOTP: (contact: string) => Promise<{ contact_type: string; expires_in_minutes: number }>;
  verifyOTP: (contact: string, otp: string) => Promise<AuthUser>;
  googleSignIn: (credential: string) => Promise<AuthUser>;
  logout: () => void;
  getToken: () => string | null;
}

function getStoredUser(): AuthUser | null {
  try { return JSON.parse(localStorage.getItem(USER_KEY) || "null"); } catch { return null; }
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(getStoredUser);

  const requestOTP = useCallback(async (contact: string) => {
    const res = await fetch(`${BASE}/auth/request-otp`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contact }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || "Failed to send OTP");
    }
    return res.json() as Promise<{ contact_type: string; expires_in_minutes: number }>;
  }, []);

  const verifyOTP = useCallback(async (contact: string, otp: string) => {
    const res = await fetch(`${BASE}/auth/verify-otp`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contact, otp }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || "Invalid OTP");
    }
    const data = await res.json();
    localStorage.setItem(TOKEN_KEY, data.access_token);
    localStorage.setItem(USER_KEY, JSON.stringify(data.user));
    setUser(data.user);
    return data.user as AuthUser;
  }, []);

  const googleSignIn = useCallback(async (credential: string) => {
    const res = await fetch(`${BASE}/auth/google`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ credential }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || "Google sign-in failed");
    }
    const data = await res.json();
    localStorage.setItem(TOKEN_KEY, data.access_token);
    localStorage.setItem(USER_KEY, JSON.stringify(data.user));
    setUser(data.user);
    return data.user as AuthUser;
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    setUser(null);
  }, []);

  const getToken = useCallback(() => localStorage.getItem(TOKEN_KEY), []);

  return (
    <AuthContext.Provider value={{ user, isAuthed: !!user, requestOTP, verifyOTP, googleSignIn, logout, getToken }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}
