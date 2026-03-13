import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  User, DollarSign, Target, Repeat,
  TrendingUp, Download, LogOut,
  ChevronRight, Pencil, Trash2, Bell, X, Check, Sparkles,
} from "lucide-react";
import { api } from "../api/client";
import { useAuth } from "../hooks/useAuth";

const CURRENCIES = [
  { code: "INR", symbol: "₹" },
  { code: "USD", symbol: "$" },
  { code: "GBP", symbol: "£" },
  { code: "EUR", symbol: "€" },
  { code: "AED", symbol: "د.إ" },
];

type RecurringItem = {
  id: number; merchant_raw: string; amount: number; currency: string;
  category: string; day_of_month: number; months_remaining: number | null;
  frequency: string; last_created_month: string | null; notes: string | null;
};

function EditModal({
  item,
  onClose,
  onSave,
}: {
  item: RecurringItem;
  onClose: () => void;
  onSave: (scope: "this_month" | "future", data: Partial<RecurringItem>) => void;
}) {
  const [scope, setScope] = useState<"this_month" | "future">("future");
  const [amount, setAmount] = useState(String(item.amount));
  const [category, setCategory] = useState(item.category);
  const [dayOfMonth, setDayOfMonth] = useState(String(item.day_of_month));
  const [monthsRemaining, setMonthsRemaining] = useState(item.months_remaining ? String(item.months_remaining) : "");

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 px-4 pb-6">
      <div className="w-full max-w-md bg-white dark:bg-gray-800 rounded-2xl p-5 shadow-xl space-y-4">
        <h3 className="text-base font-bold text-gray-800 dark:text-gray-100">Edit: {item.merchant_raw}</h3>

        <div className="flex gap-2">
          {(["this_month", "future"] as const).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setScope(s)}
              className={`flex-1 py-2 text-xs rounded-xl border transition-all font-medium ${
                scope === s
                  ? "border-teal-400 bg-teal-50 dark:bg-teal-900/30 text-teal-700 dark:text-teal-400"
                  : "border-gray-200 dark:border-gray-600 text-gray-500"
              }`}
            >
              {s === "this_month" ? "This month only" : "This & future months"}
            </button>
          ))}
        </div>

        <div>
          <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Amount</label>
          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="mt-1.5 w-full border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400"
          />
        </div>

        {scope === "future" && (
          <>
            <div>
              <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Category</label>
              <input
                type="text"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="mt-1.5 w-full border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400"
              />
            </div>
            <div className="flex gap-3">
              <div className="flex-1">
                <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Day of Month</label>
                <input
                  type="number"
                  min={1}
                  max={28}
                  value={dayOfMonth}
                  onChange={(e) => setDayOfMonth(e.target.value)}
                  className="mt-1.5 w-full border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400"
                />
              </div>
              <div className="flex-1">
                <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Months Left</label>
                <input
                  type="number"
                  placeholder="Ongoing"
                  value={monthsRemaining}
                  onChange={(e) => setMonthsRemaining(e.target.value)}
                  className="mt-1.5 w-full border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400"
                />
              </div>
            </div>
          </>
        )}

        <div className="flex gap-3 pt-1">
          <button type="button" onClick={onClose} className="flex-1 py-2.5 border border-gray-200 dark:border-gray-600 rounded-xl text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
            Cancel
          </button>
          <button
            type="button"
            onClick={() =>
              onSave(scope, {
                amount: parseFloat(amount) || item.amount,
                category,
                day_of_month: parseInt(dayOfMonth) || item.day_of_month,
                months_remaining: monthsRemaining ? parseInt(monthsRemaining) : undefined,
              })
            }
            className="flex-1 py-2.5 bg-teal-600 text-white rounded-xl text-sm font-semibold hover:bg-teal-700 transition-colors"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}

function RecurringSection({
  title,
  items,
  symbol,
  onEdit,
  onDelete,
  isPendingDelete,
}: {
  title: string;
  items: RecurringItem[];
  symbol: string;
  onEdit: (item: RecurringItem) => void;
  onDelete: (id: number) => void;
  isPendingDelete: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div>
      <button
        type="button"
        onClick={() => setExpanded(e => !e)}
        className="w-full flex items-center justify-between py-3 px-1"
      >
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-800 dark:text-gray-100 font-medium">{title}</span>
          <span className="text-xs bg-teal-100 dark:bg-teal-900/40 text-teal-700 dark:text-teal-400 px-2 py-0.5 rounded-full font-semibold">{items.length}</span>
        </div>
        <ChevronRight size={16} className={`text-gray-400 transition-transform ${expanded ? "rotate-90" : ""}`} />
      </button>
      {expanded && (
        <div className="pb-2 space-y-1">
          {items.length === 0 ? (
            <p className="text-sm text-gray-400 dark:text-gray-500 text-center py-3">No {title.toLowerCase()} set up yet.</p>
          ) : (
            items.map((item) => (
              <div key={item.id} className="flex items-center gap-3 py-2 px-1 border-b border-gray-50 dark:border-gray-700/50 last:border-0">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-800 dark:text-gray-100 truncate">{item.merchant_raw}</p>
                  <p className="text-xs text-gray-400 dark:text-gray-500">
                    {item.frequency || "monthly"} · day {item.day_of_month}
                    {item.months_remaining != null ? ` · ${item.months_remaining} mo left` : ""}
                  </p>
                </div>
                <span className="text-sm font-semibold text-gray-700 dark:text-gray-200 flex-shrink-0">
                  {symbol}{Number(item.amount).toLocaleString("en-IN", { maximumFractionDigits: 0 })}
                </span>
                <button
                  type="button"
                  onClick={() => onEdit(item)}
                  className="p-1.5 text-gray-400 hover:text-teal-600 hover:bg-teal-50 dark:hover:bg-teal-900/20 rounded-lg transition-colors flex-shrink-0"
                >
                  <Pencil size={13} />
                </button>
                <button
                  type="button"
                  onClick={() => onDelete(item.id)}
                  disabled={isPendingDelete}
                  className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-lg transition-colors disabled:opacity-50 flex-shrink-0"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

export function Settings() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const [currency, setCurrency] = useState(() => localStorage.getItem("finbuddy_currency") || "INR");
  const [savingsTarget, setSavingsTarget] = useState(() =>
    parseInt(localStorage.getItem("finbuddy_savings_target") || "20")
  );
  const [budgetAlerts, setBudgetAlerts] = useState(() => localStorage.getItem("finbuddy_budget_alerts") !== "off");
  const [editingItem, setEditingItem] = useState<RecurringItem | null>(null);
  const [editingIncome, setEditingIncome] = useState(false);
  const [incomeInput, setIncomeInput] = useState("");
  const [incomeScope, setIncomeScope] = useState<"this_month" | "future">("future");
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [exportDone, setExportDone] = useState(false);
  const [exportError, setExportError] = useState(false);
  const [clearDone, setClearDone] = useState(false);

  const { data: profile } = useQuery({
    queryKey: ["profile"],
    queryFn: () => api.profile.get(),
    staleTime: 30_000,
  });

  const { data: recurringList = [], isLoading: recurringLoading } = useQuery({
    queryKey: ["recurring"],
    queryFn: () => api.profile.listRecurring(),
  });

  const emiList = recurringList.filter((r) => r.category !== "SIP");
  const sipList = recurringList.filter((r) => r.category === "SIP");

  const symbol = CURRENCIES.find((c) => c.code === currency)?.symbol || "₹";

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.profile.deleteRecurring(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["recurring"] }),
  });

  const editMutation = useMutation({
    mutationFn: ({ id, scope, data }: { id: number; scope: "this_month" | "future"; data: Partial<RecurringItem> }) =>
      api.profile.patchRecurring(id, { scope, ...data, months_remaining: data.months_remaining ?? undefined, notes: data.notes ?? undefined }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["recurring"] });
      setEditingItem(null);
    },
  });

  const incomeMutation = useMutation({
    mutationFn: (val: number) => api.profile.upsert({ monthly_income: val }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["profile"] });
      setEditingIncome(false);
    },
  });

  const handleSignOut = () => { logout(); navigate("/login"); };

  const handleCurrencyChange = (code: string) => {
    setCurrency(code);
    localStorage.setItem("finbuddy_currency", code);
  };

  const handleSavingsTargetChange = (val: number) => {
    setSavingsTarget(val);
    localStorage.setItem("finbuddy_savings_target", String(val));
  };

  const handleBudgetAlertsToggle = () => {
    const next = !budgetAlerts;
    setBudgetAlerts(next);
    localStorage.setItem("finbuddy_budget_alerts", next ? "on" : "off");
  };

  const handleExportCSV = async () => {
    setExportError(false);
    try {
      const txs = await api.transactions.list({ limit: 9999 });
      const header = "Date,Merchant,Amount,Currency,Category,Type,Notes";
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const rows = (txs || []).map((t: any) =>
        [t.date, `"${String(t.merchant_raw || "").replace(/"/g, '""')}"`, t.amount, t.currency, t.category || "", t.tx_type || "", `"${String(t.notes || "").replace(/"/g, '""')}"`].join(",")
      );
      const blob = new Blob([[header, ...rows].join("\n")], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `finbuddy-transactions-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      setExportDone(true);
      setTimeout(() => setExportDone(false), 2500);
    } catch {
      setExportError(true);
      setTimeout(() => setExportError(false), 3000);
    }
  };

  const handleDeleteAll = async () => {
    try {
      await api.transactions.deleteAll();
      qc.clear();
      setClearDone(true);
      setShowClearConfirm(false);
      setTimeout(() => setClearDone(false), 3000);
    } catch { /* silent */ }
  };

  const sectionLabel = (label: string) => (
    <p className="text-xs font-bold text-teal-600 dark:text-teal-500 uppercase tracking-widest px-1 pt-5 pb-1.5">
      {label}
    </p>
  );

  const rowCls = "flex items-center gap-3 py-3 px-4";
  const iconWrap = (cls: string) => `w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 ${cls}`;
  const card = "bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 fin-card overflow-hidden divide-y divide-gray-50 dark:divide-gray-700/50";

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 pb-28">
      {/* Header */}
      <div className="bg-white dark:bg-gray-900 px-4 pt-4 pb-4 border-b border-gray-100 dark:border-gray-800 shadow-sm">
        <div className="max-w-lg mx-auto">
          <h1 className="text-xl font-bold text-gray-800 dark:text-gray-100">Settings</h1>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 animate-fade-in">

        {/* ── Profile ── */}
        {sectionLabel("Profile")}
        <div className={card}>
          {/* Avatar + email */}
          <div className={`${rowCls} gap-4`}>
            <div className="w-12 h-12 rounded-full bg-teal-100 dark:bg-teal-900/40 flex items-center justify-center text-xl font-bold text-teal-700 dark:text-teal-400 flex-shrink-0">
              {(user?.email?.[0] || "U").toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-gray-800 dark:text-gray-100 truncate">{user?.email || "User"}</p>
              <p className="text-xs text-gray-400 dark:text-gray-500">FinBuddy account</p>
            </div>
          </div>
        </div>

        {/* ── Preferences ── */}
        {sectionLabel("Preferences")}
        <div className={card}>
          {/* Currency */}
          <div className="px-4 py-3">
            <div className="flex items-center gap-3 mb-2.5">
              <div className={iconWrap("bg-blue-50 dark:bg-blue-900/20")}>
                <DollarSign size={16} className="text-blue-500 dark:text-blue-400" />
              </div>
              <p className="text-sm text-gray-800 dark:text-gray-100">Currency</p>
            </div>
            <div className="flex gap-1.5 flex-wrap ml-11">
              {CURRENCIES.map((c) => (
                <button key={c.code} type="button" onClick={() => handleCurrencyChange(c.code)}
                  className={`px-2.5 py-1 text-xs rounded-lg border font-medium transition-all ${
                    currency === c.code
                      ? "border-teal-400 bg-teal-50 dark:bg-teal-900/30 text-teal-700 dark:text-teal-400"
                      : "border-gray-200 dark:border-gray-600 text-gray-500 dark:text-gray-400"
                  }`}>
                  {c.symbol} {c.code}
                </button>
              ))}
            </div>
          </div>

          {/* Budget alerts */}
          <div className={rowCls}>
            <div className={iconWrap("bg-amber-50 dark:bg-amber-900/20")}>
              <Bell size={16} className="text-amber-500 dark:text-amber-400" />
            </div>
            <p className="flex-1 text-sm text-gray-800 dark:text-gray-100">Budget alerts</p>
            <button type="button" onClick={handleBudgetAlertsToggle}
              className={`relative w-10 h-5 rounded-full transition-colors ${budgetAlerts ? "bg-teal-500" : "bg-gray-200 dark:bg-gray-600"}`}>
              <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${budgetAlerts ? "translate-x-5" : "translate-x-0"}`} />
            </button>
          </div>
        </div>

        {/* ── Financial Setup ── */}
        {sectionLabel("Financial Setup")}
        <div className={card}>
          {/* Monthly income */}
          <div className={rowCls}>
            <div className={iconWrap("bg-green-50 dark:bg-green-900/20")}>
              <DollarSign size={16} className="text-green-600 dark:text-green-400" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-gray-800 dark:text-gray-100">Monthly Income</p>
            </div>
            {!editingIncome ? (
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-gray-600 dark:text-gray-300">
                  {profile?.monthly_income
                    ? `${symbol}${Number(profile.monthly_income).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`
                    : "Not set"}
                </span>
                <button
                  type="button"
                  onClick={() => { setIncomeInput(profile?.monthly_income ? String(profile.monthly_income) : ""); setEditingIncome(true); }}
                  className="p-1.5 text-gray-400 hover:text-teal-600 hover:bg-teal-50 dark:hover:bg-teal-900/20 rounded-lg transition-colors"
                >
                  <Pencil size={13} />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-1.5">
                <input
                  type="number"
                  value={incomeInput}
                  onChange={(e) => setIncomeInput(e.target.value)}
                  placeholder="e.g. 80000"
                  autoFocus
                  className="w-24 border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400"
                />
                <button type="button" onClick={() => incomeMutation.mutate(parseFloat(incomeInput) || 0)} disabled={incomeMutation.isPending}
                  className="p-1.5 bg-teal-600 text-white rounded-lg disabled:opacity-50">
                  <Check size={13} />
                </button>
                <button type="button" onClick={() => setEditingIncome(false)} className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg">
                  <X size={13} />
                </button>
              </div>
            )}
          </div>
          {editingIncome && (
            <div className="px-4 pb-3 flex gap-2">
              {(["this_month", "future"] as const).map((s) => (
                <button key={s} type="button" onClick={() => setIncomeScope(s)}
                  className={`flex-1 py-1.5 text-xs rounded-lg border font-medium transition-all ${
                    incomeScope === s
                      ? "border-teal-400 bg-teal-50 dark:bg-teal-900/30 text-teal-700 dark:text-teal-400"
                      : "border-gray-200 dark:border-gray-600 text-gray-400"
                  }`}>
                  {s === "this_month" ? "This month" : "Going forward"}
                </button>
              ))}
            </div>
          )}

          {/* Savings target */}
          <div className="px-4 py-3 border-t border-gray-50 dark:border-gray-700/50">
            <div className="flex items-center gap-3 mb-3">
              <div className={iconWrap("bg-teal-50 dark:bg-teal-900/20")}>
                <Target size={16} className="text-teal-600 dark:text-teal-400" />
              </div>
              <p className="text-sm text-gray-800 dark:text-gray-100 flex-1">Savings rate target</p>
              <span className="text-sm font-bold text-teal-600 dark:text-teal-400">{savingsTarget}%</span>
            </div>
            <div className="ml-11">
              <input type="range" min={5} max={50} step={5} value={savingsTarget}
                onChange={(e) => handleSavingsTargetChange(parseInt(e.target.value))}
                className="w-full h-2 bg-gray-200 dark:bg-gray-600 rounded-full appearance-none cursor-pointer accent-teal-500 finbuddy-slider"
              />
              <div className="flex justify-between text-xs text-gray-400 dark:text-gray-500 mt-1">
                <span>5%</span><span>25%</span><span>50%</span>
              </div>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                {savingsTarget < 15 ? "Low target — consider increasing" : savingsTarget >= 30 ? "Great ambition!" : "Healthy savings goal"}
              </p>
            </div>
          </div>

          {/* EMIs & SIPs */}
          {recurringLoading ? (
            <div className="py-4 text-center text-sm text-gray-400 dark:text-gray-500 border-t border-gray-50 dark:border-gray-700/50">Loading…</div>
          ) : (
            <>
              <div className="px-4 border-t border-gray-50 dark:border-gray-700/50">
                <div className="flex items-center gap-3 py-1">
                  <div className={iconWrap("bg-orange-50 dark:bg-orange-900/20")}>
                    <Repeat size={16} className="text-orange-500 dark:text-orange-400" />
                  </div>
                  <div className="flex-1">
                    <RecurringSection
                      title="EMIs & Payments"
                      items={emiList}
                      symbol={symbol}
                      onEdit={setEditingItem}
                      onDelete={(id) => deleteMutation.mutate(id)}
                      isPendingDelete={deleteMutation.isPending}
                    />
                  </div>
                </div>
              </div>
              <div className="px-4 border-t border-gray-50 dark:border-gray-700/50">
                <div className="flex items-center gap-3 py-1">
                  <div className={iconWrap("bg-violet-50 dark:bg-violet-900/20")}>
                    <TrendingUp size={16} className="text-violet-600 dark:text-violet-400" />
                  </div>
                  <div className="flex-1">
                    <RecurringSection
                      title="Regular SIPs"
                      items={sipList}
                      symbol={symbol}
                      onEdit={setEditingItem}
                      onDelete={(id) => deleteMutation.mutate(id)}
                      isPendingDelete={deleteMutation.isPending}
                    />
                  </div>
                </div>
              </div>
            </>
          )}

          {/* Re-onboard */}
          <button type="button" onClick={() => navigate("/onboarding")}
            className={`${rowCls} w-full hover:bg-gray-50 dark:hover:bg-gray-700/40 transition-colors border-t border-gray-50 dark:border-gray-700/50`}>
            <div className={iconWrap("bg-teal-50 dark:bg-teal-900/20")}>
              <Sparkles size={16} className="text-teal-600 dark:text-teal-400" />
            </div>
            <div className="flex-1 text-left">
              <p className="text-sm text-gray-800 dark:text-gray-100">Update financial setup</p>
              <p className="text-xs text-gray-400 dark:text-gray-500">Re-run setup to update income, rent, EMIs & SIPs</p>
            </div>
            <ChevronRight size={16} className="text-gray-300 dark:text-gray-600" />
          </button>
        </div>

        {/* ── Data ── */}
        {sectionLabel("Data")}
        <div className={card}>
          <button type="button" onClick={handleExportCSV} className={`${rowCls} w-full hover:bg-gray-50 dark:hover:bg-gray-700/40 transition-colors`}>
            <div className={iconWrap("bg-sky-50 dark:bg-sky-900/20")}>
              <Download size={16} className="text-sky-600 dark:text-sky-400" />
            </div>
            <p className="flex-1 text-sm text-gray-800 dark:text-gray-100 text-left">Export transactions (CSV)</p>
            {exportDone
              ? <span className="text-xs text-green-600 dark:text-green-400 font-semibold">Downloaded!</span>
              : exportError
              ? <span className="text-xs text-red-500 font-semibold">Failed</span>
              : <ChevronRight size={16} className="text-gray-300 dark:text-gray-600" />}
          </button>

          {clearDone ? (
            <div className={`${rowCls} bg-green-50 dark:bg-green-950/20`}>
              <div className={iconWrap("bg-green-100 dark:bg-green-900/30")}>
                <Check size={16} className="text-green-600 dark:text-green-400" />
              </div>
              <p className="flex-1 text-sm text-green-600 dark:text-green-400 font-medium">All transactions deleted</p>
            </div>
          ) : !showClearConfirm ? (
            <button type="button" onClick={() => setShowClearConfirm(true)} className={`${rowCls} w-full hover:bg-gray-50 dark:hover:bg-gray-700/40 transition-colors`}>
              <div className={iconWrap("bg-red-50 dark:bg-red-900/20")}>
                <Trash2 size={16} className="text-red-500 dark:text-red-400" />
              </div>
              <p className="flex-1 text-sm text-red-500 dark:text-red-400 text-left">Clear all data</p>
              <ChevronRight size={16} className="text-gray-300 dark:text-gray-600" />
            </button>
          ) : (
            <div className="px-4 py-3 bg-red-50 dark:bg-red-950/20">
              <p className="text-xs text-red-600 dark:text-red-400 font-medium mb-2">Delete all transactions? This cannot be undone.</p>
              <div className="flex gap-2">
                <button type="button" onClick={() => setShowClearConfirm(false)}
                  className="flex-1 py-2 text-xs border border-gray-200 dark:border-gray-600 rounded-lg text-gray-600 dark:text-gray-300 hover:bg-white dark:hover:bg-gray-700 transition-colors font-medium">
                  Cancel
                </button>
                <button type="button" onClick={handleDeleteAll}
                  className="flex-1 py-2 text-xs bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors font-semibold">
                  Yes, delete all
                </button>
              </div>
            </div>
          )}
        </div>

        {/* ── About ── */}
        {sectionLabel("About")}
        <div className={card}>
          {[
            ["Version", "1.1.0"],
            ["AI Engine", "Groq · Llama 3.3"],
            ["Database", "SQLite · Render Disk"],
          ].map(([k, v]) => (
            <div key={k} className={`${rowCls}`}>
              <p className="flex-1 text-sm text-gray-500 dark:text-gray-400">{k}</p>
              <p className="text-sm font-medium text-gray-700 dark:text-gray-200">{v}</p>
            </div>
          ))}
        </div>

        {/* ── Account ── */}
        {sectionLabel("Account")}
        <div className={card}>
          <button type="button" onClick={handleSignOut}
            className={`${rowCls} w-full hover:bg-red-50 dark:hover:bg-red-950/20 transition-colors`}>
            <div className={iconWrap("bg-red-50 dark:bg-red-900/20")}>
              <LogOut size={16} className="text-red-500 dark:text-red-400" />
            </div>
            <p className="flex-1 text-sm text-red-500 dark:text-red-400 font-medium text-left">Sign out</p>
          </button>
          <div className={`${rowCls} opacity-40`}>
            <div className={iconWrap("bg-gray-100 dark:bg-gray-700")}>
              <User size={16} className="text-gray-500 dark:text-gray-400" />
            </div>
            <p className="flex-1 text-sm text-gray-500 dark:text-gray-400 text-left">Delete account</p>
            <span className="text-xs text-gray-400 dark:text-gray-500">Coming soon</span>
          </div>
        </div>

        <div className="h-4" />
      </div>

      {/* Edit modal */}
      {editingItem && (
        <EditModal
          item={editingItem}
          onClose={() => setEditingItem(null)}
          onSave={(scope, data) =>
            editMutation.mutate({ id: editingItem.id, scope, data })
          }
        />
      )}
    </div>
  );
}
