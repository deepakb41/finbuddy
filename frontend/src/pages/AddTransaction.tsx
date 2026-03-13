import { useState, useRef, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ShoppingCart, ArrowLeftRight, ArrowDownLeft, TrendingUp, Repeat, type LucideIcon } from "lucide-react";
import { api } from "../api/client";
import { CategoryGrid } from "../components/add/CategoryGrid";
import { MerchantPicker } from "../components/add/MerchantPicker";
import { VoiceButton } from "../components/add/VoiceButton";

const today = () => new Date().toISOString().slice(0, 10);
type TxType = "expense" | "income" | "investment";
type TabKey = "expense" | "loans" | "income" | "investment";
type LoanMode = "lent" | "borrowed" | "emi";
type InvestMode = "onetime" | "sip";

const TAB_CONFIG: Record<TabKey, {
  label: string; prefix: string; pill: string; border: string; amountCls: string;
  merchantLabel: string; notesLabel: string; submitCls: string;
}> = {
  expense: {
    label: "Expense", prefix: "−",
    pill: "bg-rose-100 dark:bg-rose-900/40 text-rose-700 dark:text-rose-300",
    border: "border-t-2 border-rose-300 dark:border-rose-700",
    amountCls: "text-rose-600 dark:text-rose-400",
    merchantLabel: "Merchant / Payee",
    notesLabel: "Notes (optional)",
    submitCls: "bg-rose-500 hover:bg-rose-600",
  },
  loans: {
    label: "Loans", prefix: "⇄",
    pill: "bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300",
    border: "border-t-2 border-amber-300 dark:border-amber-700",
    amountCls: "text-amber-600 dark:text-amber-400",
    merchantLabel: "Person / Institution",
    notesLabel: "Notes (optional)",
    submitCls: "bg-amber-500 hover:bg-amber-600",
  },
  income: {
    label: "Income", prefix: "+",
    pill: "bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300",
    border: "border-t-2 border-emerald-300 dark:border-emerald-700",
    amountCls: "text-emerald-600 dark:text-emerald-400",
    merchantLabel: "From / Source",
    notesLabel: "Notes (optional)",
    submitCls: "bg-emerald-500 hover:bg-emerald-600",
  },
  investment: {
    label: "Invest", prefix: "↗",
    pill: "bg-violet-100 dark:bg-violet-900/40 text-violet-700 dark:text-violet-300",
    border: "border-t-2 border-violet-300 dark:border-violet-700",
    amountCls: "text-violet-600 dark:text-violet-400",
    merchantLabel: "Fund / Stock / Platform",
    notesLabel: "Folio / Reference",
    submitCls: "bg-violet-600 hover:bg-violet-700",
  },
};

const TAB_ICONS: Record<TabKey, LucideIcon> = {
  expense: ShoppingCart,
  loans: ArrowLeftRight,
  income: ArrowDownLeft,
  investment: TrendingUp,
};

const INCOME_SOURCES = ["Salary", "Freelance", "Business", "Dividend", "Interest", "Cashback", "Gift", "Other"];
const INVESTMENT_TYPES = ["Lump Sum", "Stocks", "Index Fund", "ETF", "REIT", "Bonds", "Gold / Silver", "Crypto", "PPF / EPF", "FD", "NPS", "Other"];

// Sorted alphabetically; frozen items ("Family / Friend", "Other") always shown at bottom
const INDIAN_FUNDS_MAIN = [
  "5Paisa", "Aditya Birla Sun Life MF", "Angel One", "Axis MF",
  "CAMS", "Canara Robeco MF", "DSP Mutual Fund", "Edelweiss MF",
  "ELSS Fund", "EPF", "ET Money", "Franklin Templeton India",
  "Groww", "HDFC Mutual Fund", "ICICI Prudential MF", "Invesco India MF",
  "KFintech", "Kotak Mahindra MF", "Kuvera", "MF Central",
  "Mirae Asset", "Motilal Oswal MF", "Navi MF", "Nippon India MF",
  "NPS", "NSC", "Parag Parikh MF", "Paytm Money",
  "PGIM India MF", "PPF Account", "SBI Mutual Fund", "Sukanya Samriddhi",
  "Tata Mutual Fund", "UTI Mutual Fund", "Upstox", "WhiteOak MF",
  "Zerodha Coin", "Zerodha Kite",
];
const INDIAN_FUNDS_FROZEN = ["Other"];
const INDIAN_LENDERS_MAIN = [
  "Aditya Birla Finance", "Axis Bank", "Bajaj Finance", "Bajaj Finserv",
  "Bank of Baroda", "HDFC Bank", "HDFC Ltd", "Hero FinCorp",
  "ICICI Bank", "IDFC First Bank", "IIFL Finance", "IndusInd Bank",
  "Kotak Bank", "L&T Finance", "LIC Housing Finance", "Mahindra Finance",
  "Muthoot Finance", "PNB", "SBI", "Shriram Finance",
  "Tata Capital", "Yes Bank",
];
const INDIAN_LENDERS_FROZEN = ["Family / Friend", "Other"];
const SIP_FREQUENCIES = ["Daily", "Weekly", "Monthly", "Quarterly"];

// Searchable dropdown — main options sorted alphabetically, frozen items always at bottom
function SearchablePicker({
  value,
  onChange,
  mainOptions,
  frozenOptions = [],
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  mainOptions: string[];
  frozenOptions?: string[];
  placeholder: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState(value);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => { setQuery(value); }, [value]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const filteredMain = mainOptions.filter((o) =>
    !query || o.toLowerCase().includes(query.toLowerCase())
  );
  const filteredFrozen = frozenOptions.filter((o) =>
    !query || o.toLowerCase().includes(query.toLowerCase())
  );
  const filtered = [...filteredMain, ...filteredFrozen];

  return (
    <div ref={ref} className="relative">
      <input
        type="text"
        placeholder={placeholder}
        value={query}
        onChange={(e) => { setQuery(e.target.value); onChange(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        className="w-full border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400"
      />
      {open && filtered.length > 0 && (
        <ul className="absolute z-30 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-xl shadow-lg max-h-56 overflow-y-auto">
          {filteredMain.map((opt) => (
            <li key={opt}>
              <button
                type="button"
                onMouseDown={() => { onChange(opt); setQuery(opt); setOpen(false); }}
                className="w-full text-left px-4 py-2.5 text-sm text-gray-700 dark:text-gray-200 hover:bg-teal-50 dark:hover:bg-teal-900/30 hover:text-teal-700 dark:hover:text-teal-400 transition-colors"
              >
                {opt}
              </button>
            </li>
          ))}
          {filteredFrozen.length > 0 && filteredMain.length > 0 && (
            <li className="border-t border-gray-100 dark:border-gray-700" />
          )}
          {filteredFrozen.map((opt) => (
            <li key={opt}>
              <button
                type="button"
                onMouseDown={() => { onChange(opt); setQuery(opt); setOpen(false); }}
                className="w-full text-left px-4 py-2.5 text-sm text-gray-500 dark:text-gray-400 hover:bg-teal-50 dark:hover:bg-teal-900/30 hover:text-teal-700 dark:hover:text-teal-400 transition-colors italic"
              >
                {opt}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function CategoryChips({ items, value, onChange }: { items: string[]; value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      {items.map((c) => (
        <button key={c} type="button" onClick={() => onChange(c)}
          className={`px-3 py-1.5 text-xs rounded-full border transition-all ${
            value === c
              ? "border-teal-400 bg-teal-50 dark:bg-teal-900/30 text-teal-700 dark:text-teal-400 font-medium"
              : "border-gray-200 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:border-gray-300"
          }`}>
          {c}
        </button>
      ))}
    </div>
  );
}

export function AddTransaction() {
  const qc = useQueryClient();
  const [activeTab, setActiveTab] = useState<TabKey>("expense");
  const [loanMode, setLoanMode] = useState<LoanMode>("lent");
  const [investMode, setInvestMode] = useState<InvestMode>("onetime");
  const [form, setForm] = useState({
    date: today(),
    merchant_raw: "",
    amount: "",
    currency: localStorage.getItem("finbuddy_currency") || "INR",
    category: "",
    notes: "",
  });
  const [sipDayOfMonth, setSipDayOfMonth] = useState("1");
  const [sipFrequency, setSipFrequency] = useState("Monthly");
  // EMI form state (for Loans → +EMI)
  const [emiForm, setEmiForm] = useState({
    merchant_raw: "",
    amount: "",
    currency: "INR",
    category: "EMI",
    day_of_month: "1",
    months_remaining: "",
  });
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurringDay, setRecurringDay] = useState("1");
  const [success, setSuccess] = useState(false);
  const [recurringSuccess, setRecurringSuccess] = useState(false);
  const [emiSuccess, setEmiSuccess] = useState(false);
  const [sipSuccess, setSipSuccess] = useState(false);

  const txType: TxType = activeTab === "investment" ? "investment"
    : activeTab === "income" ? "income"
    : "expense";
  void txType;

  const cfg = TAB_CONFIG[activeTab];

  const buildPayload = () => {
    if (activeTab === "loans") {
      return {
        ...form,
        amount: parseFloat(form.amount) || 0,
        tx_type: loanMode === "borrowed" ? "income" : "expense",
        category: "Lend & Split",
        notes: `${loanMode === "lent" ? "Lent to" : "Borrowed from"}: ${form.merchant_raw}${form.notes ? " — " + form.notes : ""}`,
      };
    }
    return {
      ...form,
      amount: parseFloat(form.amount) || 0,
      tx_type: activeTab === "investment" ? "expense" : activeTab,
      category: form.category || (activeTab === "investment" ? "Investments" : undefined),
    };
  };

  const mutation = useMutation({
    mutationFn: () => api.transactions.create(buildPayload()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["transactions"] });
      qc.invalidateQueries({ queryKey: ["summary"] });
      qc.invalidateQueries({ queryKey: ["categories"] });
      qc.invalidateQueries({ queryKey: ["latest-month"] });
      qc.invalidateQueries({ queryKey: ["health-score"] });
      setForm({ date: today(), merchant_raw: "", amount: "", currency: form.currency, category: "", notes: "" });
      setSuccess(true);
      setTimeout(() => setSuccess(false), 2000);
    },
  });

  const emiMutation = useMutation({
    mutationFn: () => api.profile.createRecurring({
      merchant_raw: emiForm.merchant_raw,
      amount: parseFloat(emiForm.amount) || 0,
      currency: emiForm.currency,
      category: emiForm.category,
      day_of_month: parseInt(emiForm.day_of_month) || 1,
      months_remaining: emiForm.months_remaining ? parseInt(emiForm.months_remaining) : undefined,
    }),
    onSuccess: () => {
      setEmiForm({ merchant_raw: "", amount: "", currency: "INR", category: "EMI", day_of_month: "1", months_remaining: "" });
      setEmiSuccess(true);
      setTimeout(() => setEmiSuccess(false), 3000);
    },
  });

  const sipMutation = useMutation({
    mutationFn: () => api.profile.createRecurring({
      merchant_raw: form.merchant_raw,
      amount: parseFloat(form.amount) || 0,
      currency: form.currency,
      category: form.category || "SIP",
      day_of_month: parseInt(sipDayOfMonth) || 1,
      frequency: sipFrequency.toLowerCase(),
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["recurring"] });
      setForm({ date: today(), merchant_raw: "", amount: "", currency: form.currency, category: "", notes: "" });
      setSipDayOfMonth("1");
      setSipFrequency("Monthly");
      setSipSuccess(true);
      setTimeout(() => setSipSuccess(false), 3000);
    },
  });

  const recurringExpenseMutation = useMutation({
    mutationFn: async () => {
      await api.transactions.create(buildPayload());
      await api.profile.createRecurring({
        merchant_raw: form.merchant_raw,
        amount: parseFloat(form.amount) || 0,
        currency: form.currency,
        category: form.category || "Other / Misc",
        day_of_month: parseInt(recurringDay) || 1,
        frequency: "monthly",
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["transactions"] });
      qc.invalidateQueries({ queryKey: ["summary"] });
      qc.invalidateQueries({ queryKey: ["categories"] });
      qc.invalidateQueries({ queryKey: ["recurring"] });
      qc.invalidateQueries({ queryKey: ["latest-month"] });
      qc.invalidateQueries({ queryKey: ["health-score"] });
      setForm({ date: today(), merchant_raw: "", amount: "", currency: form.currency, category: "", notes: "" });
      setIsRecurring(false);
      setRecurringDay("1");
      setRecurringSuccess(true);
      setTimeout(() => setRecurringSuccess(false), 3000);
    },
  });

  const handleVoiceParsed = (v: { amount?: number | null; merchant?: string | null; notes?: string | null; tx_type?: string; category?: string | null }) => {
    setForm((f) => ({
      ...f,
      ...(v.amount != null ? { amount: String(v.amount) } : {}),
      ...(v.merchant ? { merchant_raw: v.merchant } : {}),
      ...(v.notes ? { notes: v.notes } : {}),
      ...(v.category ? { category: v.category } : {}),
    }));
    if (v.tx_type && ["expense", "income", "investment"].includes(v.tx_type)) {
      setActiveTab(v.tx_type as TabKey);
    }
  };

  const handleTabChange = (t: TabKey) => {
    setActiveTab(t);
    setInvestMode("onetime");
    setForm((f) => ({ ...f, category: "", merchant_raw: "" }));
  };

  const isLoansEmi = activeTab === "loans" && loanMode === "emi";
  const isLoansTx = activeTab === "loans" && loanMode !== "emi";
  const isInvestSip = activeTab === "investment" && investMode === "sip";
  void isLoansTx;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 pb-24">
      <div className="bg-white dark:bg-gray-900 px-4 pt-4 pb-4 shadow-sm border-b border-gray-100 dark:border-gray-800">
        <div className="max-w-lg mx-auto">
          <h1 className="text-xl font-bold text-gray-800 dark:text-gray-100">Add Transaction</h1>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 pt-4 space-y-4 animate-fade-in">
        {success && (
          <div className="animate-pop-in bg-teal-50 dark:bg-teal-900/30 border border-teal-200 dark:border-teal-700 rounded-xl px-4 py-3 text-sm text-teal-700 dark:text-teal-400 font-medium text-center">
            ✅ Transaction saved!
          </div>
        )}

        {/* Type tabs */}
        <div className="flex bg-white dark:bg-gray-800 rounded-2xl p-1 shadow-sm border border-gray-100 dark:border-gray-700 fin-card">
          {(Object.keys(TAB_CONFIG) as TabKey[]).map((t) => {
            const Icon = TAB_ICONS[t];
            return (
              <button
                key={t}
                type="button"
                onClick={() => handleTabChange(t)}
                className={`flex-1 py-1.5 flex flex-col items-center gap-0.5 text-[10px] font-semibold rounded-xl transition-all ${
                  activeTab === t
                    ? TAB_CONFIG[t].pill + " shadow-sm"
                    : "text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-400"
                }`}
              >
                <Icon size={14} />
                {TAB_CONFIG[t].label}
              </button>
            );
          })}
        </div>

        {/* Loans sub-tabs */}
        {activeTab === "loans" && (
          <div className="flex bg-white dark:bg-gray-800 rounded-2xl p-1 shadow-sm border border-gray-100 dark:border-gray-700 fin-card gap-1">
            {(["lent", "borrowed", "emi"] as LoanMode[]).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => setLoanMode(mode)}
                className={`flex-1 py-2 text-xs font-semibold rounded-xl transition-all capitalize ${
                  loanMode === mode
                    ? "bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 shadow-sm"
                    : "text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-400"
                }`}
              >
                {mode === "emi" ? "+ EMI" : mode.charAt(0).toUpperCase() + mode.slice(1)}
              </button>
            ))}
          </div>
        )}

        {/* Invest sub-tabs (One-time / SIP) */}
        {activeTab === "investment" && (
          <div className="flex bg-white dark:bg-gray-800 rounded-2xl p-1 shadow-sm border border-gray-100 dark:border-gray-700 fin-card gap-1">
            {(["onetime", "sip"] as InvestMode[]).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => setInvestMode(mode)}
                className={`flex-1 py-2 text-xs font-semibold rounded-xl transition-all ${
                  investMode === mode
                    ? "bg-violet-100 dark:bg-violet-900/40 text-violet-700 dark:text-violet-300 shadow-sm"
                    : "text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-400"
                }`}
              >
                {mode === "onetime" ? "One-time" : "SIP (Recurring)"}
              </button>
            ))}
          </div>
        )}


        {/* EMI form (Loans → +EMI) */}
        {isLoansEmi && (
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-sm border border-gray-100 dark:border-gray-700 fin-card space-y-4">
            <p className="text-sm font-semibold text-gray-700 dark:text-gray-200">Add Recurring EMI</p>
            {emiSuccess && (
              <div className="bg-teal-50 dark:bg-teal-900/30 border border-teal-200 dark:border-teal-700 rounded-xl px-4 py-3 text-sm text-teal-700 dark:text-teal-400 font-medium text-center">
                ✅ EMI added — will auto-create each month!
              </div>
            )}
            <div>
              <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Merchant / Institution</label>
              <SearchablePicker
                value={emiForm.merchant_raw}
                onChange={(v) => setEmiForm((f) => ({ ...f, merchant_raw: v }))}
                mainOptions={INDIAN_LENDERS_MAIN}
                frozenOptions={INDIAN_LENDERS_FROZEN}
                placeholder="e.g. HDFC Bank, Bajaj Finance…"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Amount (₹)</label>
              <input
                type="number"
                inputMode="decimal"
                placeholder="0.00"
                value={emiForm.amount}
                onChange={(e) => setEmiForm((f) => ({ ...f, amount: e.target.value }))}
                className="mt-1.5 w-full border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400"
              />
            </div>
            <div className="flex gap-3">
              <div className="flex-1">
                <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Day of Month</label>
                <input
                  type="number"
                  min={1}
                  max={28}
                  value={emiForm.day_of_month}
                  onChange={(e) => setEmiForm((f) => ({ ...f, day_of_month: e.target.value }))}
                  className="mt-1.5 w-full border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400"
                />
              </div>
              <div className="flex-1">
                <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Months Remaining</label>
                <input
                  type="number"
                  min={1}
                  placeholder="Ongoing"
                  value={emiForm.months_remaining}
                  onChange={(e) => setEmiForm((f) => ({ ...f, months_remaining: e.target.value }))}
                  className="mt-1.5 w-full border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400"
                />
              </div>
            </div>
            <button
              type="button"
              disabled={!emiForm.merchant_raw || !emiForm.amount || emiMutation.isPending}
              onClick={() => emiMutation.mutate()}
              className="w-full bg-amber-500 text-white py-3 rounded-2xl font-semibold text-sm disabled:opacity-50 hover:bg-amber-600 transition-colors shadow"
            >
              {emiMutation.isPending ? "Adding EMI…" : "Add Recurring EMI"}
            </button>
            {emiMutation.isError && (
              <p className="text-sm text-red-500 text-center">Failed to save EMI</p>
            )}
          </div>
        )}

        {/* Main form (all tabs except Loans+EMI) */}
        {!isLoansEmi && (
          <>
            {sipSuccess && (
              <div className="animate-pop-in bg-violet-50 dark:bg-violet-900/30 border border-violet-200 dark:border-violet-700 rounded-xl px-4 py-3 text-sm text-violet-700 dark:text-violet-400 font-medium text-center">
                ✅ SIP added — will auto-create each month!
              </div>
            )}
            {recurringSuccess && (
              <div className="animate-pop-in bg-teal-50 dark:bg-teal-900/30 border border-teal-200 dark:border-teal-700 rounded-xl px-4 py-3 text-sm text-teal-700 dark:text-teal-400 font-medium text-center">
                ✅ Added as recurring — will auto-create each month!
              </div>
            )}

            <div className="bg-white dark:bg-gray-800 rounded-2xl p-3 shadow-sm border border-gray-100 dark:border-gray-700 fin-card space-y-3">
              {/* Amount */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Amount</label>
                  {activeTab !== "loans" && (
                    <VoiceButton onParsed={handleVoiceParsed} />
                  )}
                </div>
                <div className="flex items-center border border-gray-200 dark:border-gray-600 rounded-xl overflow-hidden focus-within:ring-2 focus-within:ring-teal-400">
                  <span className="px-3 py-3 text-gray-400 dark:text-gray-500 bg-gray-50 dark:bg-gray-700 border-r border-gray-200 dark:border-gray-600 text-sm font-medium select-none">
                    {cfg.prefix}
                  </span>
                  <select
                    value={form.currency}
                    onChange={(e) => setForm((f) => ({ ...f, currency: e.target.value }))}
                    className="py-3 px-2 text-sm text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-700 border-r border-gray-200 dark:border-gray-600 focus:outline-none"
                  >
                    {["INR", "GBP", "USD", "EUR", "AED"].map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                  <input
                    type="number"
                    inputMode="decimal"
                    placeholder="0.00"
                    value={form.amount}
                    onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
                    className={`flex-1 px-4 py-3 text-xl font-bold focus:outline-none bg-white dark:bg-gray-800 ${cfg.amountCls}`}
                  />
                </div>
              </div>

              {/* Merchant / Source — context-aware */}
              <div>
                <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                  {activeTab === "loans" && loanMode === "lent" ? "Person's Name" :
                   activeTab === "loans" && loanMode === "borrowed" ? "Lender / Institution" :
                   cfg.merchantLabel}
                </label>
                <div className="mt-1.5">
                  {activeTab === "expense" ? (
                    <MerchantPicker value={form.merchant_raw} onChange={(v) => setForm((f) => ({ ...f, merchant_raw: v }))} />
                  ) : activeTab === "loans" && loanMode === "borrowed" ? (
                    <SearchablePicker
                      value={form.merchant_raw}
                      onChange={(v) => setForm((f) => ({ ...f, merchant_raw: v }))}
                      mainOptions={INDIAN_LENDERS_MAIN}
                      frozenOptions={INDIAN_LENDERS_FROZEN}
                      placeholder="Search bank or lender…"
                    />
                  ) : activeTab === "investment" ? (
                    <SearchablePicker
                      value={form.merchant_raw}
                      onChange={(v) => setForm((f) => ({ ...f, merchant_raw: v }))}
                      mainOptions={INDIAN_FUNDS_MAIN}
                      frozenOptions={INDIAN_FUNDS_FROZEN}
                      placeholder="Search fund, platform…"
                    />
                  ) : (
                    <input
                      type="text"
                      placeholder={
                        activeTab === "loans" && loanMode === "lent"
                          ? "Who did you lend to?"
                          : cfg.merchantLabel + "…"
                      }
                      value={form.merchant_raw}
                      onChange={(e) => setForm((f) => ({ ...f, merchant_raw: e.target.value }))}
                      className="w-full border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400"
                    />
                  )}
                </div>
              </div>

              {/* Date */}
              <div>
                <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Date</label>
                <input
                  type="date"
                  value={form.date}
                  onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
                  className="mt-1.5 w-full border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400"
                />
              </div>

              {/* SIP extra fields */}
              {isInvestSip && (
                <div className="space-y-3">
                  <div>
                    <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Frequency</label>
                    <div className="mt-1.5 flex gap-1.5">
                      {SIP_FREQUENCIES.map((f) => (
                        <button
                          key={f}
                          type="button"
                          onClick={() => setSipFrequency(f)}
                          className={`flex-1 py-2 text-xs rounded-xl border font-medium transition-all ${
                            sipFrequency === f
                              ? "border-violet-400 bg-violet-50 dark:bg-violet-900/30 text-violet-700 dark:text-violet-400"
                              : "border-gray-200 dark:border-gray-600 text-gray-500 dark:text-gray-400"
                          }`}
                        >
                          {f}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Day of Month</label>
                    <input
                      type="number"
                      min={1}
                      max={28}
                      value={sipDayOfMonth}
                      onChange={(e) => setSipDayOfMonth(e.target.value)}
                      className="mt-1.5 w-full border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400"
                    />
                  </div>
                </div>
              )}

              {/* Notes */}
              {!isInvestSip && (
                <div>
                  <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">{cfg.notesLabel}</label>
                  <input
                    type="text"
                    placeholder="Add details…"
                    value={form.notes}
                    onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                    className="mt-1.5 w-full border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400"
                  />
                </div>
              )}

              {/* Recurring toggle — expense only */}
              {activeTab === "expense" && !isInvestSip && (
                <div className="space-y-2 pt-1 border-t border-gray-100 dark:border-gray-700">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Repeat size={13} className="text-gray-400" />
                      <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Repeat monthly</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setIsRecurring((r) => !r)}
                      className={`relative w-10 h-5 rounded-full transition-colors ${isRecurring ? "bg-teal-500" : "bg-gray-200 dark:bg-gray-600"}`}
                    >
                      <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${isRecurring ? "translate-x-5" : "translate-x-0"}`} />
                    </button>
                  </div>
                  {isRecurring && (
                    <input
                      type="number"
                      min={1}
                      max={28}
                      value={recurringDay}
                      onChange={(e) => setRecurringDay(e.target.value)}
                      placeholder="Day of month (1–28)"
                      className="w-full border border-teal-200 dark:border-teal-700 dark:bg-gray-700 dark:text-white rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400"
                    />
                  )}
                </div>
              )}
            </div>

            {/* Category section */}
            {activeTab === "expense" && (
              <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-sm border border-gray-100 dark:border-gray-700 fin-card">
                <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide block mb-3">Category</label>
                <CategoryGrid value={form.category} onChange={(v) => setForm((f) => ({ ...f, category: v }))} />
              </div>
            )}
            {activeTab === "income" && (
              <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-sm border border-gray-100 dark:border-gray-700 fin-card">
                <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide block mb-3">Source Type</label>
                <CategoryChips items={INCOME_SOURCES} value={form.category} onChange={(v) => setForm((f) => ({ ...f, category: v }))} />
              </div>
            )}
            {activeTab === "investment" && !isInvestSip && (
              <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-sm border border-gray-100 dark:border-gray-700 fin-card">
                <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide block mb-3">Investment Type</label>
                <CategoryChips items={INVESTMENT_TYPES} value={form.category} onChange={(v) => setForm((f) => ({ ...f, category: v }))} />
              </div>
            )}

            {/* Submit */}
            {isInvestSip ? (
              <button
                type="button"
                disabled={!form.merchant_raw || !form.amount || sipMutation.isPending}
                onClick={() => sipMutation.mutate()}
                className="w-full bg-violet-600 text-white py-4 rounded-2xl font-semibold text-base disabled:opacity-50 hover:bg-violet-700 transition-colors shadow"
              >
                {sipMutation.isPending ? "Adding SIP…" : "Add SIP"}
              </button>
            ) : isRecurring && activeTab === "expense" ? (
              <button
                type="button"
                disabled={!form.merchant_raw || !form.amount || recurringExpenseMutation.isPending}
                onClick={() => recurringExpenseMutation.mutate()}
                className="w-full bg-teal-600 text-white py-4 rounded-2xl font-semibold text-base disabled:opacity-50 hover:bg-teal-700 transition-colors shadow"
              >
                {recurringExpenseMutation.isPending ? "Saving…" : "Add & Set Recurring"}
              </button>
            ) : (
              <button
                type="button"
                disabled={!form.merchant_raw || !form.amount || mutation.isPending}
                onClick={() => mutation.mutate()}
                className={`w-full text-white py-4 rounded-2xl font-semibold text-base disabled:opacity-50 transition-colors shadow ${cfg.submitCls}`}
              >
                {mutation.isPending ? "Saving…" : `Add ${TAB_CONFIG[activeTab].label}`}
              </button>
            )}

            {mutation.isError && (
              <p className="text-sm text-red-500 text-center">
                {mutation.error instanceof Error ? mutation.error.message : "Failed to save"}
              </p>
            )}
            {sipMutation.isError && (
              <p className="text-sm text-red-500 text-center">Failed to save SIP</p>
            )}
            {recurringExpenseMutation.isError && (
              <p className="text-sm text-red-500 text-center">Failed to save recurring expense</p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
