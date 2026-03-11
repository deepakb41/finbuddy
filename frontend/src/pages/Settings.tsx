import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../api/client";
import { useAuth } from "../hooks/useAuth";

const CURRENCIES = [
  { code: "INR", symbol: "₹", label: "Indian Rupee" },
  { code: "GBP", symbol: "£", label: "British Pound" },
  { code: "USD", symbol: "$", label: "US Dollar" },
  { code: "EUR", symbol: "€", label: "Euro" },
];

export function Settings() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleSignOut = () => {
    logout();
    navigate("/login");
  };
  const qc = useQueryClient();
  const [currency, setCurrency] = useState(() => localStorage.getItem("finbuddy_currency") || "INR");
  const [savingsTarget, setSavingsTarget] = useState(() =>
    parseInt(localStorage.getItem("finbuddy_savings_target") || "20")
  );

  const { data: allTx = [] } = useQuery({
    queryKey: ["transactions", "all-for-settings"],
    queryFn: () => api.transactions.list({ limit: 2000 }),
  });

  const recurringMap = new Map<string, typeof allTx[0]>();
  allTx.forEach((tx) => {
    if (tx.notes?.includes("Recurring") && tx.status !== "deleted") {
      const key = `${tx.merchant_raw}|${tx.amount}|${tx.category}`;
      if (!recurringMap.has(key)) recurringMap.set(key, tx);
    }
  });
  const recurringTemplates = Array.from(recurringMap.values());

  const deleteMutation = useMutation({
    mutationFn: async (tx: typeof allTx[0]) => {
      const toDelete = allTx.filter(
        (t) => t.merchant_raw === tx.merchant_raw &&
               t.amount === tx.amount &&
               t.notes?.includes("Recurring") &&
               t.status !== "deleted"
      );
      for (const t of toDelete) {
        await api.transactions.delete(t.transaction_id);
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["transactions"] });
      qc.invalidateQueries({ queryKey: ["summary"] });
    },
  });

  const handleCurrencyChange = (code: string) => {
    setCurrency(code);
    localStorage.setItem("finbuddy_currency", code);
  };

  const handleSavingsTargetChange = (val: number) => {
    setSavingsTarget(val);
    localStorage.setItem("finbuddy_savings_target", String(val));
  };

  const symbol = CURRENCIES.find((c) => c.code === currency)?.symbol || "₹";

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 pb-24">
      <div className="bg-white dark:bg-gray-900 px-4 pt-4 pb-4 shadow-sm border-b border-gray-100 dark:border-gray-800">
        <div className="max-w-lg mx-auto">
          <h1 className="text-xl font-bold text-gray-800 dark:text-gray-100">Profile & Settings</h1>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 pt-4 space-y-4 animate-fade-in">
        {/* Profile */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-sm border border-gray-100 dark:border-gray-700">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-full bg-teal-100 dark:bg-teal-900/40 flex items-center justify-center text-2xl font-bold text-teal-700 dark:text-teal-400">
              {(user?.email?.[0] || "U").toUpperCase()}
            </div>
            <div>
              <p className="font-semibold text-gray-800 dark:text-gray-100">{user?.email || "User"}</p>
              <p className="text-xs text-gray-400 dark:text-gray-500">FinBuddy account</p>
            </div>
          </div>
        </div>

        {/* Currency */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-sm border border-gray-100 dark:border-gray-700">
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-3">Currency</h2>
          <div className="grid grid-cols-2 gap-2">
            {CURRENCIES.map((c) => (
              <button key={c.code} type="button" onClick={() => handleCurrencyChange(c.code)}
                className={`p-3 rounded-xl border text-left transition-all ${
                  currency === c.code
                    ? "border-teal-400 bg-teal-50 dark:bg-teal-900/30"
                    : "border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500"
                }`}>
                <span className="text-lg">{c.symbol}</span>
                <p className="text-sm font-medium text-gray-800 dark:text-gray-100">{c.code}</p>
                <p className="text-xs text-gray-400 dark:text-gray-500">{c.label}</p>
              </button>
            ))}
          </div>
        </div>

        {/* Financial Goals */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-sm border border-gray-100 dark:border-gray-700">
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-3">Financial Goals</h2>
          <div className="space-y-3">
            <div>
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm text-gray-600 dark:text-gray-300">Savings rate target</span>
                <span className="text-sm font-bold text-teal-600 dark:text-teal-400">{savingsTarget}%</span>
              </div>
              <input
                type="range"
                min={5}
                max={50}
                step={5}
                value={savingsTarget}
                onChange={(e) => handleSavingsTargetChange(parseInt(e.target.value))}
                className="w-full h-2 bg-gray-200 dark:bg-gray-600 rounded-full appearance-none cursor-pointer accent-teal-500"
              />
              <div className="flex justify-between text-xs text-gray-400 dark:text-gray-500 mt-1">
                <span>5%</span>
                <span>25%</span>
                <span>50%</span>
              </div>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                {savingsTarget < 15 ? "Low target — consider increasing" : savingsTarget >= 30 ? "Great ambition!" : "Healthy savings goal"}
              </p>
            </div>
          </div>
        </div>

        {/* Recurring Payments */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-sm border border-gray-100 dark:border-gray-700">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-200">Recurring Payments</h2>
            <span className="text-xs bg-teal-100 dark:bg-teal-900/40 text-teal-700 dark:text-teal-400 px-2 py-0.5 rounded-full">{recurringTemplates.length}</span>
          </div>
          {recurringTemplates.length === 0 ? (
            <p className="text-sm text-gray-400 dark:text-gray-500 text-center py-4">
              No recurring payments set up.<br />
              <span className="text-xs">Enable "Recurring monthly" when adding a transaction.</span>
            </p>
          ) : (
            <div className="space-y-2">
              {recurringTemplates.map((tx) => (
                <div key={tx.transaction_id} className="flex items-center gap-3 py-2 border-b border-gray-50 dark:border-gray-700 last:border-0">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800 dark:text-gray-100 truncate">{tx.merchant_raw}</p>
                    <p className="text-xs text-gray-400 dark:text-gray-500">{tx.category || "Expense"} · monthly</p>
                  </div>
                  <span className="text-sm font-semibold text-gray-700 dark:text-gray-200 flex-shrink-0">{symbol}{Number(tx.amount).toLocaleString("en-IN", { maximumFractionDigits: 0 })}</span>
                  <button type="button" onClick={() => deleteMutation.mutate(tx)}
                    disabled={deleteMutation.isPending}
                    className="p-1.5 text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-lg transition-colors disabled:opacity-50 flex-shrink-0">
                    🗑
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* About */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-sm border border-gray-100 dark:border-gray-700">
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-3">About</h2>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-gray-500 dark:text-gray-400">App</span><span className="text-gray-700 dark:text-gray-200 font-medium">FinBuddy</span></div>
            <div className="flex justify-between"><span className="text-gray-500 dark:text-gray-400">AI Engine</span><span className="text-gray-700 dark:text-gray-200 font-medium">Groq · Llama 3.3</span></div>
            <div className="flex justify-between"><span className="text-gray-500 dark:text-gray-400">Data</span><span className="text-gray-700 dark:text-gray-200 font-medium">Local SQLite</span></div>
          </div>
        </div>

        {/* Sign Out */}
        <button
          type="button"
          onClick={handleSignOut}
          className="w-full py-3 rounded-2xl border border-red-200 dark:border-red-900/50 text-red-600 dark:text-red-400 font-medium text-sm hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
        >
          Sign out
        </button>
      </div>
    </div>
  );
}
