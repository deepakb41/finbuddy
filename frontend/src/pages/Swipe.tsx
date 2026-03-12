import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { api } from "../api/client";

interface Suggestion {
  id: number;
  source: string;
  raw_text: string;
  merchant: string | null;
  amount: number | null;
  currency: string;
  date: string | null;
  category: string | null;
  tx_type: string;
  created_at: string;
}

interface Consent {
  id: number;
  consent_handle: string;
  phone: string;
  status: string;
  last_fetched_at: string | null;
  created_at: string;
}

const CATEGORY_ICONS: Record<string, string> = {
  "Food & Dining": "🍔",
  "Groceries": "🛒",
  "Transport": "🚗",
  "Shopping": "🛍️",
  "Entertainment": "🎬",
  "Travel": "✈️",
  "Rent": "🏠",
  "Utilities & Bills": "💡",
  "Telecom": "📱",
  "Healthcare": "💊",
  "Fitness": "💪",
  "Finance & EMI": "🏦",
  "Investments": "📈",
  "Personal Care": "💅",
  "Education": "📚",
  "Other": "📦",
};

function getMonths(): { label: string; value: string }[] {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(1);
    d.setMonth(d.getMonth() - i);
    const value = d.toISOString().slice(0, 7);
    const label = d.toLocaleDateString("en-IN", { month: "short", year: "numeric" });
    return { label, value };
  });
}

// ── Add Bank Modal ────────────────────────────────────────────────────────────
function AddBankModal({ onClose, onConnected }: { onClose: () => void; onConnected: () => void }) {
  const [phone, setPhone] = useState("");
  const [step, setStep] = useState<"input" | "loading" | "error">("input");
  const [errorMsg, setErrorMsg] = useState("");

  const handleConnect = async () => {
    const clean = phone.trim().replace(/\D/g, "").slice(-10);
    if (clean.length !== 10) {
      setErrorMsg("Enter a valid 10-digit mobile number");
      return;
    }
    setStep("loading");
    setErrorMsg("");
    try {
      const res = await api.aa.initiate(clean);
      onConnected();
      // Redirect user to Setu consent page
      window.location.href = res.redirect_url;
    } catch (e: unknown) {
      setStep("error");
      setErrorMsg(e instanceof Error ? e.message : "Failed to connect");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40" onClick={onClose}>
      <div
        className="w-full max-w-lg bg-white dark:bg-gray-900 rounded-t-3xl p-6 pb-10 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-10 h-1 bg-gray-200 dark:bg-gray-700 rounded-full mx-auto mb-5" />
        <h2 className="text-lg font-bold text-gray-800 dark:text-gray-100 mb-1">Connect Bank Account</h2>
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
          Transactions auto-fetched and categorized by AI via Setu Account Aggregator
        </p>

        <div className="bg-teal-50 dark:bg-teal-900/20 rounded-xl p-3 mb-4 space-y-1.5">
          {[
            ["🏛️", "RBI-regulated Account Aggregator framework"],
            ["🤖", "AI parses narrations and assigns categories"],
            ["🔒", "Bank-grade encryption · no passwords stored"],
            ["✅", "One-time consent · revoke anytime"],
          ].map(([icon, text]) => (
            <div key={text} className="flex items-start gap-2">
              <span className="text-sm">{icon}</span>
              <p className="text-xs text-teal-700 dark:text-teal-400">{text}</p>
            </div>
          ))}
        </div>

        {step !== "loading" && (
          <>
            <div className="mb-3">
              <label className="text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1 block">
                Mobile number linked to your bank
              </label>
              <div className="flex items-center border border-gray-200 dark:border-gray-600 rounded-xl overflow-hidden bg-white dark:bg-gray-800">
                <span className="px-3 text-sm text-gray-500 dark:text-gray-400 border-r border-gray-200 dark:border-gray-600 py-3">+91</span>
                <input
                  type="tel"
                  maxLength={10}
                  value={phone}
                  onChange={(e) => setPhone(e.target.value.replace(/\D/g, ""))}
                  onKeyDown={(e) => e.key === "Enter" && handleConnect()}
                  placeholder="9876543210"
                  className="flex-1 px-3 py-3 text-sm bg-transparent text-gray-800 dark:text-gray-100 focus:outline-none"
                />
              </div>
              {errorMsg && <p className="text-xs text-rose-500 mt-1">{errorMsg}</p>}
            </div>
            <button
              type="button"
              onClick={handleConnect}
              disabled={phone.length < 10}
              className="w-full py-3 bg-teal-600 text-white rounded-xl text-sm font-semibold hover:bg-teal-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Connect via Setu →
            </button>
          </>
        )}

        {step === "loading" && (
          <div className="flex flex-col items-center gap-3 py-4">
            <div className="w-8 h-8 border-3 border-teal-600 border-t-transparent rounded-full animate-spin" />
            <p className="text-sm text-gray-500 dark:text-gray-400">Opening Setu consent page…</p>
          </div>
        )}

        {step !== "loading" && (
          <button
            type="button"
            onClick={onClose}
            className="w-full mt-2 py-2.5 text-gray-500 dark:text-gray-400 text-sm hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
          >
            Cancel
          </button>
        )}
      </div>
    </div>
  );
}

// ── Connected Accounts Card ───────────────────────────────────────────────────
function BankAccountsCard({
  consents,
  onAdd,
  onFetch,
  onRevoke,
  fetchLoading,
}: {
  consents: Consent[];
  onAdd: () => void;
  onFetch: (handle: string) => void;
  onRevoke: (handle: string) => void;
  fetchLoading: string | null;
}) {
  const statusBadge = (s: string) => {
    const map: Record<string, string> = {
      ACTIVE: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
      PENDING: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
      EXPIRED: "bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400",
      REVOKED: "bg-rose-100 text-rose-500 dark:bg-rose-900/30 dark:text-rose-400",
    };
    return map[s] || "bg-gray-100 text-gray-500";
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-4 shadow-sm fin-card">
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-semibold text-gray-700 dark:text-gray-200">Bank Accounts</span>
        <button
          type="button"
          onClick={onAdd}
          className="text-xs font-semibold text-teal-600 dark:text-teal-400 bg-teal-50 dark:bg-teal-900/30 hover:bg-teal-100 dark:hover:bg-teal-900/50 px-3 py-1 rounded-lg transition-colors"
        >
          + Add
        </button>
      </div>

      {consents.length === 0 ? (
        <div className="text-center py-4">
          <p className="text-sm text-gray-400 dark:text-gray-500">No accounts connected yet</p>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
            Connect via Setu AA · transactions auto-parsed and categorized by AI
          </p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {consents.map((c) => (
            <div key={c.consent_handle} className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-teal-50 dark:bg-teal-900/30 flex items-center justify-center text-lg flex-shrink-0">
                🏦
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold text-gray-700 dark:text-gray-200">+91 {c.phone}</p>
                  <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full uppercase ${statusBadge(c.status)}`}>
                    {c.status}
                  </span>
                </div>
                <p className="text-xs text-gray-400 dark:text-gray-500">
                  {c.last_fetched_at
                    ? `Last synced ${new Date(c.last_fetched_at).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}`
                    : "Never synced"}
                </p>
              </div>
              <div className="flex items-center gap-1.5 flex-shrink-0">
                {c.status === "ACTIVE" && (
                  <button
                    type="button"
                    onClick={() => onFetch(c.consent_handle)}
                    disabled={fetchLoading === c.consent_handle}
                    className="text-xs bg-teal-600 text-white px-2.5 py-1.5 rounded-lg hover:bg-teal-700 disabled:opacity-50 transition-colors"
                  >
                    {fetchLoading === c.consent_handle ? "Syncing…" : "Sync"}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => onRevoke(c.consent_handle)}
                  className="text-xs text-rose-400 hover:text-rose-600 px-2 py-1.5 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-900/20 transition-colors"
                >
                  Remove
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Suggestion Card ───────────────────────────────────────────────────────────
function SuggestionCard({
  suggestion,
  onAccept,
  onReject,
}: {
  suggestion: Suggestion;
  onAccept: () => void;
  onReject: () => void;
}) {
  const [done, setDone] = useState<"accepted" | "rejected" | null>(null);
  const symbol = ({ INR: "₹", GBP: "£", USD: "$", EUR: "€" } as Record<string, string>)[suggestion.currency] || suggestion.currency;
  const icon = CATEGORY_ICONS[suggestion.category || ""] || "💳";
  const formattedDate = suggestion.date
    ? new Date(suggestion.date + "T00:00:00").toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })
    : new Date(suggestion.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });

  if (done === "accepted") {
    return (
      <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-700 rounded-2xl p-4 flex items-center gap-3">
        <span className="text-emerald-500 text-lg">✓</span>
        <div>
          <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">Added to transactions</p>
          <p className="text-xs text-emerald-600/70 dark:text-emerald-500">{suggestion.merchant || "Unknown"}</p>
        </div>
      </div>
    );
  }
  if (done === "rejected") {
    return (
      <div className="bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-2xl p-4 flex items-center gap-3 opacity-60">
        <span className="text-gray-400 text-lg">✕</span>
        <p className="text-sm text-gray-500 dark:text-gray-400">Skipped</p>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-2xl p-4 shadow-sm fin-card">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2.5">
          <div className="w-10 h-10 rounded-xl bg-teal-50 dark:bg-teal-900/30 flex items-center justify-center text-xl flex-shrink-0">
            {icon}
          </div>
          <div>
            <div className="flex items-center gap-1.5 mb-0.5">
              <span className={`text-xs font-bold px-1.5 py-0.5 rounded-md ${
                suggestion.source === "setu"
                  ? "bg-violet-100 dark:bg-violet-900/40 text-violet-700 dark:text-violet-400"
                  : "bg-teal-100 dark:bg-teal-900/50 text-teal-700 dark:text-teal-400"
              }`}>
                {suggestion.source === "setu" ? "AA" : "AI"}
              </span>
              {suggestion.category && (
                <span className="text-xs text-gray-500 dark:text-gray-400">{suggestion.category}</span>
              )}
            </div>
            <p className="text-sm font-bold text-gray-800 dark:text-gray-100">{suggestion.merchant || "Unknown"}</p>
          </div>
        </div>
        <p className="text-base font-bold text-teal-600 dark:text-teal-400">
          {symbol}{(suggestion.amount || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}
        </p>
      </div>
      <p className="text-xs text-gray-400 dark:text-gray-500 mb-1">{formattedDate}</p>
      {suggestion.raw_text && (
        <p className="text-xs text-gray-400 dark:text-gray-500 italic mb-3 line-clamp-2">"{suggestion.raw_text}"</p>
      )}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => { setDone("accepted"); onAccept(); }}
          className="flex-1 py-2 bg-teal-600 text-white rounded-xl text-xs font-semibold hover:bg-teal-700 transition-colors"
        >
          ✓ Add Transaction
        </button>
        <button
          type="button"
          onClick={() => { setDone("rejected"); onReject(); }}
          className="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 rounded-xl text-xs font-semibold hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
        >
          ✕ Skip
        </button>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export function Swipe() {
  const qc = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const months = getMonths();
  const [selectedMonth, setSelectedMonth] = useState(months[0].value);
  const [showAddModal, setShowAddModal] = useState(false);
  const [fetchLoading, setFetchLoading] = useState<string | null>(null);
  const [fetchResult, setFetchResult] = useState<string | null>(null);

  // Handle redirect back from Setu: /inbox?fi={consentHandle}
  useEffect(() => {
    const handle = searchParams.get("fi") || searchParams.get("consentHandle");
    if (!handle) return;

    // Remove query param from URL
    setSearchParams({}, { replace: true });

    // Trigger data fetch automatically
    setFetchLoading(handle);
    setFetchResult(null);
    api.aa.fetch(handle)
      .then((r) => {
        setFetchResult(`Synced ${r.transactions_found} transactions — ${r.suggestions_created} suggestions ready for review`);
        qc.invalidateQueries({ queryKey: ["suggestions-pending"] });
        qc.invalidateQueries({ queryKey: ["aa-consents"] });
      })
      .catch((e: unknown) => {
        setFetchResult(`Sync error: ${e instanceof Error ? e.message : "Unknown error"}`);
      })
      .finally(() => setFetchLoading(null));
  }, []);  // run once on mount

  const { data: consents = [] } = useQuery({
    queryKey: ["aa-consents"],
    queryFn: () => api.aa.consents(),
    refetchInterval: 30_000,
  });

  const { data: suggestions = [], isLoading } = useQuery({
    queryKey: ["suggestions-pending", selectedMonth],
    queryFn: () => api.suggestions.pending(selectedMonth),
    refetchInterval: 30_000,
  });

  const acceptMutation = useMutation({
    mutationFn: (id: number) => api.suggestions.accept(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["transactions"] });
      qc.invalidateQueries({ queryKey: ["suggestions-pending"] });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: (id: number) => api.suggestions.reject(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["suggestions-pending"] }),
  });

  const handleFetch = async (handle: string) => {
    setFetchLoading(handle);
    setFetchResult(null);
    try {
      const r = await api.aa.fetch(handle);
      setFetchResult(`Synced ${r.transactions_found} transactions · ${r.suggestions_created} new suggestions`);
      qc.invalidateQueries({ queryKey: ["suggestions-pending"] });
      qc.invalidateQueries({ queryKey: ["aa-consents"] });
    } catch (e: unknown) {
      setFetchResult(`Sync failed: ${e instanceof Error ? e.message : "Unknown error"}`);
    } finally {
      setFetchLoading(null);
    }
  };

  const handleRevoke = async (handle: string) => {
    if (!confirm("Remove this account connection?")) return;
    await api.aa.revoke(handle);
    qc.invalidateQueries({ queryKey: ["aa-consents"] });
  };

  const monthLabel = months.find((m) => m.value === selectedMonth)?.label || selectedMonth;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 pb-28">
      {showAddModal && (
        <AddBankModal
          onClose={() => setShowAddModal(false)}
          onConnected={() => setShowAddModal(false)}
        />
      )}

      {/* Header */}
      <div className="bg-white dark:bg-gray-900 px-4 pt-12 pb-4 border-b border-gray-100 dark:border-gray-800 shadow-sm">
        <div className="max-w-lg mx-auto">
          <h1 className="text-xl font-bold text-gray-800 dark:text-gray-100">Bank</h1>
          <p className="text-xs text-gray-500 dark:text-gray-400">Review AI-categorized transactions</p>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 pt-5 space-y-5">

        {/* Fetch result banner */}
        {fetchResult && (
          <div className={`rounded-2xl p-3 text-sm font-medium flex items-center justify-between gap-2 ${
            fetchResult.startsWith("Sync")
              ? "bg-rose-50 dark:bg-rose-900/20 text-rose-700 dark:text-rose-400 border border-rose-100 dark:border-rose-800"
              : "bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-800"
          }`}>
            <span>{fetchResult}</span>
            <button type="button" onClick={() => setFetchResult(null)} className="text-lg leading-none opacity-60 hover:opacity-100">×</button>
          </div>
        )}

        {/* Syncing banner */}
        {fetchLoading && (
          <div className="bg-teal-50 dark:bg-teal-900/20 border border-teal-100 dark:border-teal-800 rounded-2xl p-3 flex items-center gap-3">
            <div className="w-4 h-4 border-2 border-teal-600 border-t-transparent rounded-full animate-spin flex-shrink-0" />
            <p className="text-sm text-teal-700 dark:text-teal-400">Fetching transactions from your bank… this may take 30–60 seconds</p>
          </div>
        )}

        {/* Bank Accounts */}
        <BankAccountsCard
          consents={consents}
          onAdd={() => setShowAddModal(true)}
          onFetch={handleFetch}
          onRevoke={handleRevoke}
          fetchLoading={fetchLoading}
        />

        {/* Month selector */}
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
          {months.map((m) => (
            <button
              key={m.value}
              type="button"
              onClick={() => setSelectedMonth(m.value)}
              className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                selectedMonth === m.value
                  ? "bg-teal-600 text-white"
                  : "bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700"
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>

        {/* Suggestion cards */}
        {isLoading && (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-28 bg-gray-100 dark:bg-gray-800 rounded-2xl animate-pulse" />
            ))}
          </div>
        )}

        {!isLoading && suggestions.length === 0 && (
          <div className="text-center py-14">
            <div className="text-4xl mb-3">🏦</div>
            <p className="text-sm font-semibold text-gray-600 dark:text-gray-300">No transactions to review</p>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">for {monthLabel}</p>
            {consents.some((c) => c.status === "ACTIVE") && (
              <button
                type="button"
                onClick={() => handleFetch(consents.find((c) => c.status === "ACTIVE")!.consent_handle)}
                className="mt-4 text-xs text-teal-600 dark:text-teal-400 underline"
              >
                Sync transactions now
              </button>
            )}
          </div>
        )}

        {!isLoading && suggestions.length > 0 && (
          <div className="space-y-3">
            <p className="text-xs text-gray-400 dark:text-gray-500 font-medium">
              {suggestions.length} pending · {monthLabel}
            </p>
            {suggestions.map((s) => (
              <SuggestionCard
                key={s.id}
                suggestion={s}
                onAccept={() => acceptMutation.mutate(s.id)}
                onReject={() => rejectMutation.mutate(s.id)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
