import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../api/client";
import { CategoryGrid } from "../components/add/CategoryGrid";
import { MerchantPicker } from "../components/add/MerchantPicker";
import { VoiceButton } from "../components/add/VoiceButton";

const today = () => new Date().toISOString().slice(0, 10);
type TxType = "expense" | "income" | "investment";

const TAB_CONFIG: Record<TxType, {
  label: string; prefix: string; pill: string; border: string; amountCls: string;
  merchantLabel: string; notesLabel: string;
}> = {
  expense: {
    label: "Expense", prefix: "−",
    pill: "bg-rose-100 dark:bg-rose-900/40 text-rose-700 dark:text-rose-300",
    border: "border-t-2 border-rose-300 dark:border-rose-700",
    amountCls: "text-rose-600 dark:text-rose-400",
    merchantLabel: "Merchant / Payee",
    notesLabel: "Notes (optional)",
  },
  income: {
    label: "Income", prefix: "+",
    pill: "bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300",
    border: "border-t-2 border-emerald-300 dark:border-emerald-700",
    amountCls: "text-emerald-600 dark:text-emerald-400",
    merchantLabel: "From / Source",
    notesLabel: "Notes (optional)",
  },
  investment: {
    label: "Invest", prefix: "↗",
    pill: "bg-violet-100 dark:bg-violet-900/40 text-violet-700 dark:text-violet-300",
    border: "border-t-2 border-violet-300 dark:border-violet-700",
    amountCls: "text-violet-600 dark:text-violet-400",
    merchantLabel: "Fund / Stock / Platform",
    notesLabel: "Folio / Reference",
  },
};

const INCOME_SOURCES = ["Salary", "Freelance", "Business", "Dividend", "Interest", "Cashback", "Gift", "Other"];
const INVESTMENT_TYPES = ["SIP", "Lump Sum", "Stocks", "Crypto", "PPF / EPF", "FD", "NPS", "Other"];
const INVEST_PLATFORMS = ["Zerodha", "Groww", "Kuvera", "Paytm Money", "ELSS Fund", "PPF Account", "Other"];

function QuickPills({ items, onSelect }: { items: string[]; onSelect: (v: string) => void }) {
  return (
    <div className="flex flex-wrap gap-1.5 mb-2">
      {items.map((s) => (
        <button key={s} type="button" onClick={() => onSelect(s)}
          className="px-3 py-1 text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded-full hover:bg-teal-50 dark:hover:bg-teal-900/30 hover:text-teal-700 dark:hover:text-teal-400 transition-colors">
          {s}
        </button>
      ))}
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

function addMonthsToDate(dateStr: string, n: number): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(y, m - 1 + n, d);
  // Clamp to last day of month
  const lastDay = new Date(dt.getFullYear(), dt.getMonth() + 1, 0).getDate();
  const clamped = new Date(dt.getFullYear(), dt.getMonth(), Math.min(d, lastDay));
  return clamped.toISOString().slice(0, 10);
}

export function AddTransaction() {
  const qc = useQueryClient();
  const [txType, setTxType] = useState<TxType>("expense");
  const [recurring, setRecurring] = useState(false);
  const [recurringMonths, setRecurringMonths] = useState(12);
  const [form, setForm] = useState({
    date: today(),
    merchant_raw: "",
    amount: "",
    currency: localStorage.getItem("finbuddy_currency") || "INR",
    category: "",
    notes: "",
  });
  const [success, setSuccess] = useState(false);

  const cfg = TAB_CONFIG[txType];

  const buildPayload = (monthOffset = 0) => ({
    ...form,
    date: monthOffset === 0 ? form.date : addMonthsToDate(form.date, monthOffset),
    amount: parseFloat(form.amount) || 0,
    tx_type: txType === "investment" ? "expense" : txType,
    category: form.category || (txType === "investment" ? "Investments" : undefined),
    notes: recurring && monthOffset > 0 ? `${form.notes ? form.notes + " · " : ""}Recurring` : form.notes || undefined,
  });

  const mutation = useMutation({
    mutationFn: async () => {
      await api.transactions.create(buildPayload(0));
      if (recurring) {
        for (let i = 1; i < recurringMonths; i++) {
          await api.transactions.create(buildPayload(i));
        }
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["transactions"] });
      qc.invalidateQueries({ queryKey: ["summary"] });
      qc.invalidateQueries({ queryKey: ["categories"] });
      setForm({ date: today(), merchant_raw: "", amount: "", currency: form.currency, category: "", notes: "" });
      setSuccess(true);
      setTimeout(() => setSuccess(false), 2000);
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
      setTxType(v.tx_type as TxType);
    }
  };

  const handleTabChange = (t: TxType) => {
    setTxType(t);
    setForm((f) => ({ ...f, category: "", merchant_raw: "" }));
  };

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
        <div className="flex bg-white dark:bg-gray-800 rounded-2xl p-1 shadow-sm border border-gray-100 dark:border-gray-700">
          {(Object.keys(TAB_CONFIG) as TxType[]).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => handleTabChange(t)}
              className={`flex-1 py-2 text-xs font-semibold rounded-xl transition-all ${
                txType === t
                  ? TAB_CONFIG[t].pill + " shadow-sm"
                  : "text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-400"
              }`}
            >
              {TAB_CONFIG[t].label}
            </button>
          ))}
        </div>

        {/* Voice — expense only */}
        {txType === "expense" && (
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-sm border border-gray-100 dark:border-gray-700">
            <VoiceButton onParsed={handleVoiceParsed} />
          </div>
        )}

        {/* Main form */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-sm border border-gray-100 dark:border-gray-700 space-y-4">
          {/* Amount */}
          <div>
            <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Amount</label>
            <div className="flex items-center mt-1.5 border border-gray-200 dark:border-gray-600 rounded-xl overflow-hidden focus-within:ring-2 focus-within:ring-teal-400">
              <span className="px-3 py-3 text-gray-400 dark:text-gray-500 bg-gray-50 dark:bg-gray-700 border-r border-gray-200 dark:border-gray-600 text-sm font-medium select-none">
                {cfg.prefix}
              </span>
              <select
                value={form.currency}
                onChange={(e) => setForm((f) => ({ ...f, currency: e.target.value }))}
                className="py-3 px-2 text-sm text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-700 border-r border-gray-200 dark:border-gray-600 focus:outline-none"
              >
                {["INR", "GBP", "USD", "EUR"].map((c) => (
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

          {/* Merchant / Source / Account / Platform */}
          <div>
            <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">{cfg.merchantLabel}</label>
            <div className="mt-1.5">
              {txType === "income" && !form.merchant_raw && (
                <QuickPills items={INCOME_SOURCES} onSelect={(v) => setForm((f) => ({ ...f, merchant_raw: v }))} />
              )}
              {txType === "investment" && !form.merchant_raw && (
                <QuickPills items={INVEST_PLATFORMS} onSelect={(v) => setForm((f) => ({ ...f, merchant_raw: v }))} />
              )}
              {txType === "expense" ? (
                <MerchantPicker value={form.merchant_raw} onChange={(v) => setForm((f) => ({ ...f, merchant_raw: v }))} />
              ) : (
                <input
                  type="text"
                  placeholder={cfg.merchantLabel + "…"}
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

          {/* Notes */}
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
        </div>

        {/* Category section */}
        {txType === "expense" && (
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-sm border border-gray-100 dark:border-gray-700">
            <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide block mb-3">Category</label>
            <CategoryGrid value={form.category} onChange={(v) => setForm((f) => ({ ...f, category: v }))} />
          </div>
        )}
        {txType === "income" && (
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-sm border border-gray-100 dark:border-gray-700">
            <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide block mb-3">Source Type</label>
            <CategoryChips items={INCOME_SOURCES} value={form.category} onChange={(v) => setForm((f) => ({ ...f, category: v }))} />
          </div>
        )}
        {txType === "investment" && (
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-sm border border-gray-100 dark:border-gray-700">
            <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide block mb-3">Investment Type</label>
            <CategoryChips items={INVESTMENT_TYPES} value={form.category} onChange={(v) => setForm((f) => ({ ...f, category: v }))} />
          </div>
        )}

        {/* Recurring toggle */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl px-4 py-3 shadow-sm border border-gray-100 dark:border-gray-700 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-700 dark:text-gray-200">Recurring</p>
              <p className="text-xs text-gray-400 dark:text-gray-500">Auto-add for future months</p>
            </div>
            <button
              type="button"
              onClick={() => setRecurring((r) => !r)}
              className={`relative w-11 h-6 rounded-full transition-colors ${recurring ? "bg-teal-500" : "bg-gray-200 dark:bg-gray-600"}`}
            >
              <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${recurring ? "translate-x-5" : ""}`} />
            </button>
          </div>
          {recurring && (
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">Duration</p>
              <div className="flex gap-2 flex-wrap">
                {[3, 6, 12].map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setRecurringMonths(n)}
                    className={`px-3 py-1.5 text-xs rounded-full border transition-all ${
                      recurringMonths === n
                        ? "border-teal-400 bg-teal-50 dark:bg-teal-900/30 text-teal-700 dark:text-teal-400 font-medium"
                        : "border-gray-200 dark:border-gray-600 text-gray-500 dark:text-gray-400"
                    }`}
                  >
                    {n} months
                  </button>
                ))}
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    min={1}
                    max={60}
                    value={![3, 6, 12].includes(recurringMonths) ? recurringMonths : ""}
                    placeholder="Custom"
                    onChange={(e) => {
                      const v = parseInt(e.target.value);
                      if (v > 0) setRecurringMonths(v);
                    }}
                    className="w-20 border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-full px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-teal-400 text-center"
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Submit */}
        <button
          type="button"
          disabled={!form.merchant_raw || !form.amount || mutation.isPending}
          onClick={() => mutation.mutate()}
          className="w-full bg-teal-600 text-white py-4 rounded-2xl font-semibold text-base disabled:opacity-50 hover:bg-teal-700 transition-colors shadow"
        >
          {mutation.isPending
            ? (recurring ? `Saving ${recurringMonths} months…` : "Saving…")
            : (recurring ? `Add ${TAB_CONFIG[txType].label} · ${recurringMonths} months` : `Add ${TAB_CONFIG[txType].label}`)}
        </button>

        {mutation.isError && (
          <p className="text-sm text-red-500 text-center">
            {mutation.error instanceof Error ? mutation.error.message : "Failed to save"}
          </p>
        )}
      </div>
    </div>
  );
}
