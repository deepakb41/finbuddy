import { getToken } from "../hooks/useAuth";

const BASE = import.meta.env.VITE_API_URL || "http://localhost:8000/api";

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const res = await fetch(`${BASE}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
    ...options,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || `HTTP ${res.status}`);
  }
  return res.json();
}

export interface Transaction {
  transaction_id: string;
  date: string;
  merchant_raw: string;
  merchant_normalized: string | null;
  amount: number;
  currency: string;
  type: string;
  category: string | null;
  notes: string | null;
  status: string;
}

export interface TransactionCreate {
  date: string;
  merchant_raw: string;
  amount: number;
  currency?: string;
  tx_type?: string;
  notes?: string;
  category?: string;
}

export const api = {
  transactions: {
    list: (params: { month?: string; category?: string; search?: string; limit?: number } = {}) => {
      const q = new URLSearchParams();
      if (params.month)    q.set("month", params.month);
      if (params.category) q.set("category", params.category);
      if (params.search)   q.set("search", params.search);
      if (params.limit)    q.set("limit", String(params.limit));
      return request<Transaction[]>(`/transactions?${q}`);
    },
    create: (body: TransactionCreate) =>
      request<{ transaction_id: string }>("/transactions", {
        method: "POST",
        body: JSON.stringify(body),
      }),
    patch: (id: string, body: Partial<Pick<Transaction, "category" | "notes" | "merchant_normalized">>) =>
      request<{ status: string }>(`/transactions/${id}`, {
        method: "PATCH",
        body: JSON.stringify(body),
      }),
    delete: (id: string) =>
      request<{ status: string }>(`/transactions/${id}`, { method: "DELETE" }),
    deleteAll: () =>
      request<{ status: string }>("/transactions/all", { method: "DELETE" }),
  },

  insights: {
    latestMonth: () => request<{ month: string }>("/insights/latest-month"),
    summary: (params: { month?: string; year?: string; alltime?: boolean } = {}) => {
      const q = new URLSearchParams();
      if (params.month) q.set("month", params.month);
      if (params.year) q.set("year", params.year);
      if (params.alltime) q.set("alltime", "1");
      const qs = q.toString() ? `?${q}` : "";
      return request<{
        total_expense: number; total_income: number; tx_count: number;
        savings_rate: number; projected_month_end: number;
        days_elapsed: number; days_in_month: number;
        tx_count_last_month?: number;
      }>(`/insights/summary${qs}`);
    },
    monthlyTrend: (n_months = 6) =>
      request<{ month: string; category: string; total: number }[]>(
        `/insights/monthly-trend?n_months=${n_months}`
      ),
    categories: (params: { month?: string; year?: string; alltime?: boolean } = {}) => {
      const q = new URLSearchParams();
      if (params.month) q.set("month", params.month);
      if (params.year) q.set("year", params.year);
      if (params.alltime) q.set("alltime", "1");
      const qs = q.toString() ? `?${q}` : "";
      return request<{ category: string; this_month: number; last_month: number }[]>(
        `/insights/categories${qs}`
      );
    },
    forecast: () =>
      request<{
        history: { month: string; total: number }[];
        forecast: { month: string; total: number }[];
        trend: string;
        insight: string;
      }>("/insights/forecast"),
    topMerchants: (month?: string) => {
      const q = month ? `?month=${month}` : "";
      return request<{ merchant: string; total: number; tx_count: number }[]>(
        `/insights/top-merchants${q}`
      );
    },
    budget: (month?: string) => {
      const q = month ? `?month=${month}` : "";
      return request<{ category: string; budget: number; spent: number; currency: string; pct_used: number }[]>(
        `/insights/budget${q}`
      );
    },
    healthScore: (month?: string) => {
      const q = month ? `?month=${month}` : "";
      return request<{ score: number; breakdown: Record<string, unknown> }>(
        `/insights/health-score${q}`
      );
    },
    aiSummary: (month?: string) => {
      const q = month ? `?month=${month}` : "";
      return request<{ summary: string; cached: boolean }>(`/insights/ai-summary${q}`);
    },
    ask: (question: string) =>
      request<{ answer: string }>("/insights/ask", {
        method: "POST",
        body: JSON.stringify({ question }),
      }),
  },

  aa: {
    initiate: (phone: string) =>
      request<{ consent_handle: string; redirect_url: string }>("/aa/initiate", {
        method: "POST",
        body: JSON.stringify({ phone }),
      }),
    fetch: (consentHandle: string) =>
      request<{ status: string; transactions_found: number; suggestions_created: number }>(
        `/aa/fetch/${consentHandle}`,
        { method: "POST" }
      ),
    consents: () =>
      request<{ id: number; consent_handle: string; phone: string; status: string; last_fetched_at: string | null; created_at: string }[]>(
        "/aa/consents"
      ),
    revoke: (consentHandle: string) =>
      request<{ status: string }>(`/aa/consents/${consentHandle}`, { method: "DELETE" }),
  },

  budgets: {
    list: () => request<{ id: number; category: string; monthly_limit: number; currency: string }[]>("/budgets"),
    upsert: (body: { category: string; monthly_limit: number; currency?: string }) =>
      request<{ status: string; category: string }>("/budgets", {
        method: "POST",
        body: JSON.stringify(body),
      }),
    delete: (category: string) =>
      request<{ status: string }>(`/budgets/${encodeURIComponent(category)}`, { method: "DELETE" }),
  },

  voice: {
    parse: (text: string) =>
      request<{
        amount: number | null; merchant: string | null; notes: string | null;
        tx_type: string; category: string | null; raw_text: string;
      }>("/voice/parse", { method: "POST", body: JSON.stringify({ text }) }),
    transcribe: async (audioBlob: Blob): Promise<{ transcript: string; parsed: unknown }> => {
      const form = new FormData();
      form.append("file", audioBlob, "recording.webm");
      const token = getToken();
      const res = await fetch(`${BASE}/voice/transcribe`, {
        method: "POST",
        body: form,
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error(`Transcription failed: ${res.statusText}`);
      return res.json();
    },
  },

  profile: {
    get: () =>
      request<{
        user_id: number; monthly_income: number | null;
        savings_target_pct: number; onboarding_completed: boolean;
      }>("/profile"),
    upsert: (body: { monthly_income?: number | null; savings_target_pct?: number; onboarding_completed?: boolean }) =>
      request<{ status: string }>("/profile", { method: "POST", body: JSON.stringify(body) }),
    listRecurring: () =>
      request<{
        id: number; merchant_raw: string; amount: number; currency: string;
        category: string; day_of_month: number; months_remaining: number | null;
        frequency: string; last_created_month: string | null; notes: string | null;
      }[]>("/profile/recurring"),
    createRecurring: (body: {
      merchant_raw: string; amount: number; currency?: string;
      category?: string; day_of_month?: number; months_remaining?: number;
      frequency?: string; notes?: string;
    }) =>
      request<{ id: number; status: string }>("/profile/recurring", {
        method: "POST",
        body: JSON.stringify(body),
      }),
    patchRecurring: (id: number, body: {
      scope: "this_month" | "future";
      merchant_raw?: string; amount?: number; currency?: string;
      category?: string; day_of_month?: number; months_remaining?: number;
      frequency?: string; notes?: string;
    }) =>
      request<{ status: string }>(`/profile/recurring/${id}`, {
        method: "PATCH",
        body: JSON.stringify(body),
      }),
    deleteRecurring: (id: number) =>
      request<{ status: string }>(`/profile/recurring/${id}`, { method: "DELETE" }),
    processRecurring: () =>
      request<{ created: string[]; count: number }>("/profile/recurring/process", { method: "POST" }),
  },

  suggestions: {
    pending: (month?: string) =>
      request<{
        id: number; source: string; raw_text: string; merchant: string | null;
        amount: number | null; currency: string; date: string | null;
        category: string | null; tx_type: string; created_at: string;
      }[]>(`/suggestions/pending${month ? `?month=${encodeURIComponent(month)}` : ""}`),
    ingest: (raw_text: string, source = "manual") =>
      request<{ id: number; status: string; parsed: unknown }>("/suggestions/ingest", {
        method: "POST",
        body: JSON.stringify({ raw_text, source }),
      }),
    accept: (id: number) =>
      request<{ status: string; transaction_id: string }>(`/suggestions/${id}/accept`, { method: "PATCH" }),
    reject: (id: number) =>
      request<{ status: string }>(`/suggestions/${id}/reject`, { method: "PATCH" }),
  },
};
