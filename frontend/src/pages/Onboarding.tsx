import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2 } from "lucide-react";
import { api } from "../api/client";

type Step = "income" | "rent" | "emis" | "sips" | "savings" | "done";

interface EmiEntry {
  merchant_raw: string;
  amount: string;
  months_remaining: string;
  day_of_month: string;
}

interface SipEntry {
  merchant_raw: string;
  amount: string;
  frequency: string;
  day_of_month: string;
}

const STEPS: Step[] = ["income", "rent", "emis", "sips", "savings"];

const FREQUENCIES = ["Daily", "Weekly", "Monthly", "Quarterly"];

const INDIAN_LENDERS = [
  "Aditya Birla Finance", "Axis Bank", "Bajaj Finance", "Bajaj Finserv",
  "Bank of Baroda", "HDFC Bank", "HDFC Ltd", "Hero FinCorp",
  "ICICI Bank", "IDFC First Bank", "IIFL Finance", "IndusInd Bank",
  "Kotak Bank", "L&T Finance", "LIC Housing Finance", "Mahindra Finance",
  "Muthoot Finance", "PNB", "SBI", "Shriram Finance",
  "Tata Capital", "Yes Bank",
  "Family / Friend", "Other",
];

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

// Minimal searchable picker for use in onboarding forms
function LenderPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
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

  // frozen items always shown at bottom
  const frozen = INDIAN_LENDERS.slice(-2); // "Family / Friend", "Other"
  const main = INDIAN_LENDERS.slice(0, -2).filter(
    (o) => !query || o.toLowerCase().includes(query.toLowerCase())
  );
  const frozenFiltered = frozen.filter(
    (o) => !query || o.toLowerCase().includes(query.toLowerCase())
  );
  const filtered = [...main, ...frozenFiltered];

  return (
    <div ref={ref} className="relative">
      <input
        type="text"
        placeholder="Bank / Lender name or start typing…"
        value={query}
        onChange={(e) => { setQuery(e.target.value); onChange(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        className="w-full border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400"
      />
      {open && filtered.length > 0 && (
        <ul className="absolute z-30 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-xl shadow-lg max-h-48 overflow-y-auto">
          {filtered.map((opt) => (
            <li key={opt}>
              <button
                type="button"
                onMouseDown={() => { onChange(opt); setQuery(opt); setOpen(false); }}
                className="w-full text-left px-3 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-teal-50 dark:hover:bg-teal-900/30 hover:text-teal-700 dark:hover:text-teal-400 transition-colors"
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

function FundPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
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

  const filtered = INDIAN_FUNDS_MAIN.filter(
    (o) => !query || o.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <div ref={ref} className="relative">
      <input
        type="text"
        placeholder="Fund / AMC / Platform name…"
        value={query}
        onChange={(e) => { setQuery(e.target.value); onChange(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        className="w-full border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400"
      />
      {open && filtered.length > 0 && (
        <ul className="absolute z-30 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-xl shadow-lg max-h-48 overflow-y-auto">
          {filtered.map((opt) => (
            <li key={opt}>
              <button
                type="button"
                onMouseDown={() => { onChange(opt); setQuery(opt); setOpen(false); }}
                className="w-full text-left px-3 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-violet-50 dark:hover:bg-violet-900/30 hover:text-violet-700 dark:hover:text-violet-400 transition-colors"
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

export function Onboarding() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [step, setStep] = useState<Step>("income");
  const [income, setIncome] = useState("");
  const [rent, setRent] = useState("");
  const [rentDay, setRentDay] = useState("1");
  const [currency] = useState("INR");
  const [emis, setEmis] = useState<EmiEntry[]>([]);
  const [sips, setSips] = useState<SipEntry[]>([]);
  const [savingsPct, setSavingsPct] = useState(20);
  const [fadeOut, setFadeOut] = useState(false);

  // Auto-redirect from done screen with fade-out
  useEffect(() => {
    if (step === "done") {
      const t1 = setTimeout(() => setFadeOut(true), 1800);
      const t2 = setTimeout(() => navigate("/"), 2500);
      return () => { clearTimeout(t1); clearTimeout(t2); };
    }
  }, [step, navigate]);

  // EMI helpers
  const addEmi = () => setEmis((e) => [...e, { merchant_raw: "", amount: "", months_remaining: "", day_of_month: "1" }]);
  const updateEmi = (i: number, field: keyof EmiEntry, val: string) =>
    setEmis((e) => e.map((em, idx) => idx === i ? { ...em, [field]: val } : em));
  const removeEmi = (i: number) => setEmis((e) => e.filter((_, idx) => idx !== i));

  // SIP helpers
  const addSip = () => setSips((s) => [...s, { merchant_raw: "", amount: "", frequency: "Monthly", day_of_month: "1" }]);
  const updateSip = (i: number, field: keyof SipEntry, val: string) =>
    setSips((s) => s.map((sp, idx) => idx === i ? { ...sp, [field]: val } : sp));
  const removeSip = (i: number) => setSips((s) => s.filter((_, idx) => idx !== i));

  const skipAll = useMutation({
    mutationFn: () => api.profile.upsert({ onboarding_completed: true }),
    onSuccess: () => {
      // Optimistically update cache so OnboardingGuard doesn't redirect back
      qc.setQueryData(["profile"], (old: Record<string, unknown> | undefined) =>
        old ? { ...old, onboarding_completed: true } : { onboarding_completed: true }
      );
      navigate("/");
    },
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      await api.profile.upsert({
        monthly_income: income ? parseFloat(income) : null,
        savings_target_pct: savingsPct,
        onboarding_completed: true,
      });
      if (rent && parseFloat(rent) > 0) {
        await api.profile.createRecurring({
          merchant_raw: "House Rent",
          amount: parseFloat(rent),
          currency,
          category: "Rent",
          day_of_month: parseInt(rentDay) || 1,
          frequency: "monthly",
        });
      }
      for (const emi of emis) {
        if (!emi.merchant_raw || !emi.amount) continue;
        await api.profile.createRecurring({
          merchant_raw: emi.merchant_raw,
          amount: parseFloat(emi.amount) || 0,
          currency,
          category: "EMI",
          day_of_month: parseInt(emi.day_of_month) || 1,
          months_remaining: emi.months_remaining ? parseInt(emi.months_remaining) : undefined,
          frequency: "monthly",
        });
      }
      for (const sip of sips) {
        if (!sip.merchant_raw || !sip.amount) continue;
        await api.profile.createRecurring({
          merchant_raw: sip.merchant_raw,
          amount: parseFloat(sip.amount) || 0,
          currency,
          category: "SIP",
          day_of_month: parseInt(sip.day_of_month) || 1,
          frequency: sip.frequency.toLowerCase(),
        });
      }
      // Immediately create this month's transactions from the templates we just saved
      await api.profile.processRecurring().catch(() => {});
    },
    onSuccess: () => {
      qc.setQueryData(["profile"], (old: Record<string, unknown> | undefined) =>
        old ? { ...old, onboarding_completed: true } : { onboarding_completed: true }
      );
      // Invalidate dashboard data so Rent/EMI/SIP appear immediately
      qc.invalidateQueries({ queryKey: ["summary"] });
      qc.invalidateQueries({ queryKey: ["categories"] });
      qc.invalidateQueries({ queryKey: ["latest-month"] });
      qc.invalidateQueries({ queryKey: ["health-score"] });
      qc.invalidateQueries({ queryKey: ["transactions"] });
      setStep("done");
    },
  });

  const stepIndex = STEPS.indexOf(step as Step);

  return (
    <div className="min-h-screen bg-gradient-to-b from-teal-50 to-white dark:from-gray-950 dark:to-gray-900 flex flex-col items-center justify-center px-4 pb-12">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <img src="/logo.png" alt="FinBuddy" className="w-14 h-14 mb-3" />
          <h1 className="fin-brand text-2xl font-bold text-teal-700 dark:text-teal-400">Welcome to FinBuddy</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Let's set up your profile</p>
        </div>

        {/* Step indicators */}
        {step !== "done" && (
          <div className="flex gap-2 justify-center mb-8">
            {STEPS.map((s, i) => (
              <div
                key={s}
                className={`h-1.5 rounded-full flex-1 transition-all ${
                  step === s ? "bg-teal-500" :
                  stepIndex > i ? "bg-teal-300" : "bg-gray-200 dark:bg-gray-700"
                }`}
              />
            ))}
          </div>
        )}

        {/* Step: Income */}
        {step === "income" && (
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-100 dark:border-gray-700 space-y-5">
            <div>
              <h2 className="text-lg font-bold text-gray-800 dark:text-gray-100">Monthly Income</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">What's your monthly take-home income?</p>
            </div>
            <div className="flex items-center border border-gray-200 dark:border-gray-600 rounded-xl overflow-hidden focus-within:ring-2 focus-within:ring-teal-400">
              <span className="px-3 py-3 text-sm text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-700 border-r border-gray-200 dark:border-gray-600">₹</span>
              <input
                type="number"
                inputMode="numeric"
                min={0}
                placeholder="e.g. 80000"
                value={income}
                onChange={(e) => setIncome(e.target.value)}
                className="flex-1 px-4 py-3 text-xl font-bold focus:outline-none bg-white dark:bg-gray-800 text-teal-600 dark:text-teal-400"
              />
            </div>
            <button
              type="button"
              onClick={() => setStep("rent")}
              className="w-full bg-teal-600 text-white py-3 rounded-2xl font-semibold text-sm hover:bg-teal-700 transition-colors"
            >Next →</button>
            <button
              type="button"
              onClick={() => skipAll.mutate()}
              disabled={skipAll.isPending}
              className="w-full text-xs text-gray-300 dark:text-gray-600 hover:text-gray-400 disabled:opacity-50"
            >
              Skip onboarding
            </button>
          </div>
        )}

        {/* Step: Rent */}
        {step === "rent" && (
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-100 dark:border-gray-700 space-y-5">
            <div>
              <h2 className="text-lg font-bold text-gray-800 dark:text-gray-100">Monthly Rent</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Do you pay rent? We'll track it automatically each month.</p>
            </div>
            <div className="flex items-center border border-gray-200 dark:border-gray-600 rounded-xl overflow-hidden focus-within:ring-2 focus-within:ring-teal-400">
              <span className="px-3 py-3 text-sm text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-700 border-r border-gray-200 dark:border-gray-600">₹</span>
              <input
                type="number"
                inputMode="numeric"
                min={0}
                placeholder="Monthly rent (leave blank if none)"
                value={rent}
                onChange={(e) => setRent(e.target.value)}
                className="flex-1 px-4 py-3 text-xl font-bold focus:outline-none bg-white dark:bg-gray-800 text-teal-600 dark:text-teal-400"
              />
            </div>
            {rent && parseFloat(rent) > 0 && (
              <div>
                <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Day of Month Rent is Due</label>
                <input
                  type="number"
                  min={1}
                  max={28}
                  value={rentDay}
                  onChange={(e) => setRentDay(e.target.value)}
                  className="mt-1.5 w-full border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400"
                />
              </div>
            )}
            <div className="flex gap-3">
              <button type="button" onClick={() => setStep("income")} className="flex-1 border border-gray-200 dark:border-gray-600 py-3 rounded-2xl text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                ← Back
              </button>
              <button type="button" onClick={() => setStep("emis")} className="flex-1 bg-teal-600 text-white py-3 rounded-2xl font-semibold text-sm hover:bg-teal-700 transition-colors">
                Next →
              </button>
            </div>
            <button
              type="button"
              onClick={() => skipAll.mutate()}
              disabled={skipAll.isPending}
              className="w-full text-xs text-gray-300 dark:text-gray-600 hover:text-gray-400 disabled:opacity-50"
            >
              Skip onboarding
            </button>
          </div>
        )}

        {/* Step: EMIs */}
        {step === "emis" && (
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-100 dark:border-gray-700 space-y-5">
            <div>
              <h2 className="text-lg font-bold text-gray-800 dark:text-gray-100">Regular EMIs</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Add any recurring loan EMIs or subscriptions</p>
            </div>

            {emis.length === 0 && (
              <p className="text-sm text-gray-400 dark:text-gray-500 text-center py-3">No EMIs added yet</p>
            )}

            {emis.map((emi, i) => (
              <div key={i} className="border border-gray-100 dark:border-gray-700 rounded-xl p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">EMI #{i + 1}</span>
                  <button type="button" onClick={() => removeEmi(i)} className="text-xs text-red-400 hover:text-red-500">Remove</button>
                </div>
                <LenderPicker
                  value={emi.merchant_raw}
                  onChange={(v) => updateEmi(i, "merchant_raw", v)}
                />
                <div className="flex gap-2">
                  <input
                    type="number"
                    min={0}
                    placeholder="Amount (₹)"
                    value={emi.amount}
                    onChange={(e) => updateEmi(i, "amount", e.target.value)}
                    className="flex-1 border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400"
                  />
                  <input
                    type="number"
                    placeholder="Months left"
                    value={emi.months_remaining}
                    onChange={(e) => updateEmi(i, "months_remaining", e.target.value)}
                    className="flex-1 border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400"
                  />
                </div>
              </div>
            ))}

            <button
              type="button"
              onClick={addEmi}
              className="w-full border-2 border-dashed border-gray-200 dark:border-gray-600 py-3 rounded-xl text-sm text-gray-400 hover:border-teal-400 hover:text-teal-500 transition-colors"
            >+ Add EMI</button>

            <div className="flex gap-3">
              <button type="button" onClick={() => setStep("rent")} className="flex-1 border border-gray-200 dark:border-gray-600 py-3 rounded-2xl text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                ← Back
              </button>
              <button type="button" onClick={() => setStep("sips")} className="flex-1 bg-teal-600 text-white py-3 rounded-2xl font-semibold text-sm hover:bg-teal-700 transition-colors">
                Next →
              </button>
            </div>
            <button
              type="button"
              onClick={() => skipAll.mutate()}
              disabled={skipAll.isPending}
              className="w-full text-xs text-gray-300 dark:text-gray-600 hover:text-gray-400 disabled:opacity-50"
            >
              Skip onboarding
            </button>
          </div>
        )}

        {/* Step: SIPs */}
        {step === "sips" && (
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-100 dark:border-gray-700 space-y-5">
            <div>
              <h2 className="text-lg font-bold text-gray-800 dark:text-gray-100">Regular SIPs</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Add any recurring SIPs or investments</p>
            </div>

            {sips.length === 0 && (
              <p className="text-sm text-gray-400 dark:text-gray-500 text-center py-3">No SIPs added yet</p>
            )}

            {sips.map((sip, i) => (
              <div key={i} className="border border-gray-100 dark:border-gray-700 rounded-xl p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">SIP #{i + 1}</span>
                  <button type="button" onClick={() => removeSip(i)} className="text-xs text-red-400 hover:text-red-500">Remove</button>
                </div>
                <FundPicker
                  value={sip.merchant_raw}
                  onChange={(v) => updateSip(i, "merchant_raw", v)}
                />
                <div className="flex gap-2">
                  <input
                    type="number"
                    min={0}
                    placeholder="Amount (₹)"
                    value={sip.amount}
                    onChange={(e) => updateSip(i, "amount", e.target.value)}
                    className="flex-1 border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400"
                  />
                  <input
                    type="number"
                    placeholder="Day (1-28)"
                    value={sip.day_of_month}
                    onChange={(e) => updateSip(i, "day_of_month", e.target.value)}
                    className="flex-1 border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400"
                  />
                </div>
                {/* Frequency pills */}
                <div className="flex gap-1.5">
                  {FREQUENCIES.map((f) => (
                    <button
                      key={f}
                      type="button"
                      onClick={() => updateSip(i, "frequency", f)}
                      className={`flex-1 py-1.5 text-xs rounded-lg border font-medium transition-all ${
                        sip.frequency === f
                          ? "border-violet-400 bg-violet-50 dark:bg-violet-900/30 text-violet-700 dark:text-violet-400"
                          : "border-gray-200 dark:border-gray-600 text-gray-500 dark:text-gray-400"
                      }`}
                    >
                      {f}
                    </button>
                  ))}
                </div>
              </div>
            ))}

            <button
              type="button"
              onClick={addSip}
              className="w-full border-2 border-dashed border-gray-200 dark:border-gray-600 py-3 rounded-xl text-sm text-gray-400 hover:border-violet-400 hover:text-violet-500 transition-colors"
            >+ Add SIP</button>

            <div className="flex gap-3">
              <button type="button" onClick={() => setStep("emis")} className="flex-1 border border-gray-200 dark:border-gray-600 py-3 rounded-2xl text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                ← Back
              </button>
              <button type="button" onClick={() => setStep("savings")} className="flex-1 bg-teal-600 text-white py-3 rounded-2xl font-semibold text-sm hover:bg-teal-700 transition-colors">
                Next →
              </button>
            </div>
            <button
              type="button"
              onClick={() => skipAll.mutate()}
              disabled={skipAll.isPending}
              className="w-full text-xs text-gray-300 dark:text-gray-600 hover:text-gray-400 disabled:opacity-50"
            >
              Skip onboarding
            </button>
          </div>
        )}

        {/* Step: Savings target */}
        {step === "savings" && (
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-100 dark:border-gray-700 space-y-5">
            <div>
              <h2 className="text-lg font-bold text-gray-800 dark:text-gray-100">Savings Target</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">What % of income do you want to save?</p>
            </div>
            <div className="text-center">
              <span className="text-4xl font-bold text-teal-600 dark:text-teal-400">{savingsPct}%</span>
              {income && (
                <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">
                  ≈ ₹{Math.round(parseFloat(income || "0") * savingsPct / 100).toLocaleString()} / month
                </p>
              )}
            </div>
            <input
              type="range"
              min={5}
              max={60}
              step={5}
              value={savingsPct}
              onChange={(e) => setSavingsPct(parseInt(e.target.value))}
              className="w-full accent-teal-500"
            />
            <div className="flex justify-between text-xs text-gray-400">
              <span>5%</span><span>30% (healthy)</span><span>60%</span>
            </div>
            <div className="flex gap-3">
              <button type="button" onClick={() => setStep("sips")} className="flex-1 border border-gray-200 dark:border-gray-600 py-3 rounded-2xl text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                ← Back
              </button>
              <button
                type="button"
                disabled={saveMutation.isPending}
                onClick={() => saveMutation.mutate()}
                className="flex-1 bg-teal-600 text-white py-3 rounded-2xl font-semibold text-sm disabled:opacity-50 hover:bg-teal-700 transition-colors"
              >
                {saveMutation.isPending ? "Saving…" : "Finish Setup"}
              </button>
            </div>
            {saveMutation.isError && (
              <p className="text-sm text-red-500 text-center">Something went wrong. Please try again.</p>
            )}
          </div>
        )}

        {/* Step: Done */}
        {step === "done" && (
          <div className={`bg-white dark:bg-gray-800 rounded-2xl p-8 shadow-sm border border-gray-100 dark:border-gray-700 text-center space-y-4 transition-all duration-700 ${fadeOut ? "opacity-0 scale-95" : "opacity-100 scale-100"}`}>
            <div className="w-16 h-16 bg-teal-50 dark:bg-teal-900/30 rounded-full flex items-center justify-center mx-auto">
              <CheckCircle2 size={36} className="text-teal-500" />
            </div>
            <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100">Setup complete!</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Your finances are all set up. Heading to your dashboard…
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
