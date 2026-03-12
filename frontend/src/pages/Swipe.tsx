import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
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

function BankAccountsCard({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-4 shadow-sm">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-semibold text-gray-700 dark:text-gray-200">Bank Accounts</span>
        <button
          type="button"
          onClick={onAdd}
          className="text-xs font-semibold text-teal-600 dark:text-teal-400 bg-teal-50 dark:bg-teal-900/30 hover:bg-teal-100 dark:hover:bg-teal-900/50 px-3 py-1 rounded-lg transition-colors"
        >
          + Add
        </button>
      </div>
      <p className="text-xs text-gray-400 dark:text-gray-500">No accounts connected yet</p>
      <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
        Connect via Setu AA · transactions auto-parsed and categorized by AI
      </p>
    </div>
  );
}

function AddBankModal({ onClose }: { onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg bg-white dark:bg-gray-900 rounded-t-3xl p-6 pb-10 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-10 h-1 bg-gray-200 dark:bg-gray-700 rounded-full mx-auto mb-5" />
        <h2 className="text-lg font-bold text-gray-800 dark:text-gray-100 mb-1">Connect Bank Account</h2>
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
          Transactions are automatically fetched and categorized by AI
        </p>
        <div className="bg-teal-50 dark:bg-teal-900/20 rounded-xl p-4 mb-4 space-y-2">
          <p className="text-xs font-semibold text-teal-700 dark:text-teal-400 uppercase tracking-wide mb-2">How it works</p>
          {[
            "🏛️ Setu Account Aggregator fetches your transactions",
            "🤖 AI parses narration and auto-categorizes each entry",
            "📋 Categorized suggestions appear here for your review",
          ].map((line) => (
            <p key={line} className="text-xs text-gray-600 dark:text-gray-300">{line}</p>
          ))}
        </div>
        <ul className="space-y-1.5 mb-5">
          {[
            "One-time consent · no re-authorization needed",
            "Bank-grade encryption · no passwords stored",
            "Revoke access anytime from this app",
          ].map((item) => (
            <li key={item} className="flex items-start gap-2 text-xs text-gray-500 dark:text-gray-400">
              <span className="text-teal-500 mt-0.5">✓</span>
              {item}
            </li>
          ))}
        </ul>
        <button
          type="button"
          disabled
          className="w-full py-3 bg-gray-100 dark:bg-gray-700 text-gray-400 dark:text-gray-500 rounded-xl text-sm font-semibold cursor-not-allowed"
        >
          Coming soon — Setu integration in progress
        </button>
        <button
          type="button"
          onClick={onClose}
          className="w-full mt-2 py-2.5 text-gray-500 dark:text-gray-400 text-sm hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
        >
          Dismiss
        </button>
      </div>
    </div>
  );
}

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
    <div className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-2xl p-4 shadow-sm">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2.5">
          <div className="w-10 h-10 rounded-xl bg-teal-50 dark:bg-teal-900/30 flex items-center justify-center text-xl flex-shrink-0">
            {icon}
          </div>
          <div>
            <div className="flex items-center gap-1.5 mb-0.5">
              <span className="text-xs font-bold bg-teal-100 dark:bg-teal-900/50 text-teal-700 dark:text-teal-400 px-1.5 py-0.5 rounded-md">AI</span>
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

const COMING_SOON_KEY = "finbuddy_bank_info_dismissed";

export function Swipe() {
  const qc = useQueryClient();
  const months = getMonths();
  const [selectedMonth, setSelectedMonth] = useState(months[0].value);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showInfo, setShowInfo] = useState(() => !localStorage.getItem(COMING_SOON_KEY));

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

  const monthLabel = months.find((m) => m.value === selectedMonth)?.label || selectedMonth;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 pb-28">
      {showAddModal && <AddBankModal onClose={() => setShowAddModal(false)} />}

      {/* Header */}
      <div className="bg-white dark:bg-gray-900 px-4 pt-12 pb-4 border-b border-gray-100 dark:border-gray-800 shadow-sm">
        <div className="max-w-lg mx-auto">
          <h1 className="text-xl font-bold text-gray-800 dark:text-gray-100">Bank</h1>
          <p className="text-xs text-gray-500 dark:text-gray-400">Review AI-categorized transactions</p>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 pt-5 space-y-5">
        {/* Coming Soon info card */}
        {showInfo && (
          <div className="bg-gradient-to-br from-teal-50 to-sky-50 dark:from-teal-900/20 dark:to-sky-900/20 border border-teal-100 dark:border-teal-800/40 rounded-2xl p-4 shadow-sm">
            <div className="flex items-start justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className="text-xl">🏦</span>
                <div>
                  <p className="text-sm font-bold text-teal-800 dark:text-teal-300">Bank Connect — Coming Soon</p>
                  <span className="text-[10px] font-semibold bg-teal-100 dark:bg-teal-900/50 text-teal-700 dark:text-teal-400 px-1.5 py-0.5 rounded-md uppercase tracking-wide">In progress</span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => { setShowInfo(false); localStorage.setItem(COMING_SOON_KEY, "1"); }}
                className="text-teal-400 dark:text-teal-600 hover:text-teal-600 dark:hover:text-teal-400 text-lg leading-none ml-2"
                aria-label="Dismiss"
              >
                ×
              </button>
            </div>
            <p className="text-xs text-teal-700 dark:text-teal-400 mb-3 leading-relaxed">
              Connect your bank via <strong>Setu Account Aggregator</strong>. Transactions will be auto-fetched and categorized by AI — no manual SMS pasting needed.
            </p>
            <div className="space-y-1.5">
              {[
                ["🤖", "AI parses every narration and assigns a category"],
                ["🔒", "Bank-grade encryption · no passwords stored"],
                ["✅", "One-time consent · revoke anytime"],
              ].map(([icon, text]) => (
                <div key={text} className="flex items-start gap-2">
                  <span className="text-sm">{icon}</span>
                  <p className="text-xs text-teal-600 dark:text-teal-400/80">{text}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Bank Accounts section */}
        <BankAccountsCard onAdd={() => setShowAddModal(true)} />

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
