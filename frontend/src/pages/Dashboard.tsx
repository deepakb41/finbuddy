import { useQuery } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { api } from "../api/client";
import { SummaryCards } from "../components/dashboard/SummaryCards";
import { CategoryDonut } from "../components/dashboard/CategoryDonut";
import { MonthlyTrendChart } from "../components/dashboard/MonthlyTrendChart";
import { HealthScore } from "../components/dashboard/HealthScore";
import { ForecastTrend } from "../components/dashboard/ForecastTrend";
import { InvestmentChart } from "../components/dashboard/InvestmentChart";

const CURRENCIES: { code: string; symbol: string }[] = [
  { code: "INR", symbol: "₹" },
  { code: "GBP", symbol: "£" },
  { code: "USD", symbol: "$" },
  { code: "EUR", symbol: "€" },
  { code: "AED", symbol: "د.إ" },
];

type ViewMode = "monthly" | "yearly" | "alltime";

function addMonths(ym: string, n: number): string {
  const [y, m] = ym.split("-").map(Number);
  const d = new Date(y, m - 1 + n, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function formatMonth(ym: string): string {
  const [y, m] = ym.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("en-IN", { month: "long", year: "numeric" });
}

export function Dashboard() {
  const [currency, setCurrency] = useState(() => localStorage.getItem("finbuddy_currency") || "INR");
  const [selectedMonth, setSelectedMonth] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("monthly");
  const [selectedYear, setSelectedYear] = useState(() => String(new Date().getFullYear()));

  const symbol = CURRENCIES.find((c) => c.code === currency)?.symbol || "₹";

  const handleCurrencyChange = (code: string) => {
    setCurrency(code);
    localStorage.setItem("finbuddy_currency", code);
  };

  const { data: latestMonthData } = useQuery({
    queryKey: ["latest-month"],
    queryFn: () => api.insights.latestMonth(),
    staleTime: 0,
  });

  const activeMonth = selectedMonth ?? latestMonthData?.month ?? new Date().toISOString().slice(0, 7);
  const todayMonth = new Date().toISOString().slice(0, 7);
  const todayYear = String(new Date().getFullYear());
  const isCurrentMonth = activeMonth === todayMonth;

  // Build query param based on view mode
  const summaryParam =
    viewMode === "monthly" ? { month: activeMonth } :
    viewMode === "yearly" ? { year: selectedYear } :
    { alltime: true as const };

  const { data: summary, isLoading: loadingSummary } = useQuery({
    queryKey: ["summary", viewMode, viewMode === "monthly" ? activeMonth : viewMode === "yearly" ? selectedYear : "all"],
    queryFn: () => api.insights.summary(summaryParam),
    refetchInterval: 60_000,
  });

  const { data: categories, isLoading: loadingCats } = useQuery({
    queryKey: ["categories", viewMode, viewMode === "monthly" ? activeMonth : viewMode === "yearly" ? selectedYear : "all"],
    queryFn: () => api.insights.categories(summaryParam),
    refetchInterval: 60_000,
  });

  const { data: trend } = useQuery({
    queryKey: ["trend"],
    queryFn: () => api.insights.monthlyTrend(12),
    refetchInterval: 60_000,
  });

  const { data: healthData } = useQuery({
    queryKey: ["health-score", viewMode === "monthly" ? activeMonth : "overall"],
    queryFn: () => api.insights.healthScore(viewMode === "monthly" ? activeMonth : undefined),
    refetchInterval: 60_000,
  });

  const { data: profile } = useQuery({
    queryKey: ["profile"],
    queryFn: () => api.profile.get(),
    staleTime: 60_000,
  });

  // Use actual logged income; fall back to profile monthly_income for monthly view
  const totalIncomeForDonut =
    (summary?.total_income ?? 0) > 0
      ? (summary?.total_income ?? 0)
      : viewMode === "monthly"
      ? (profile?.monthly_income ?? 0)
      : 0;

  const INVEST_CATS = new Set(["Investments","SIP","Stocks","Index Fund","ETF","REIT","Bonds","Gold / Silver","Crypto","PPF / EPF","FD","NPS"]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const groupedCategories = useMemo(() => {
    if (!categories) return undefined;
    const investTotal = categories.filter(c => INVEST_CATS.has(c.category)).reduce((s, c) => s + c.this_month, 0);
    const nonInvest = categories.filter(c => !INVEST_CATS.has(c.category));
    if (investTotal > 0) return [...nonInvest, { category: "Investments", this_month: investTotal, last_month: 0 }];
    return nonInvest;
  }, [categories]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 pb-24">
      {/* Sticky header */}
      <div className="bg-white dark:bg-gray-900 px-4 pt-4 pb-3 shadow-sm sticky top-14 z-10 border-b border-gray-100 dark:border-gray-800">
        <div className="max-w-lg mx-auto space-y-2">
          {/* View mode toggle */}
          <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-800 rounded-xl p-1 w-fit">
            {(["monthly", "yearly", "alltime"] as ViewMode[]).map((m) => (
              <button
                key={m}
                onClick={() => setViewMode(m)}
                className={`px-3 py-1 rounded-lg text-xs font-medium transition-all ${
                  viewMode === m
                    ? "bg-white dark:bg-gray-700 text-teal-700 dark:text-teal-400 shadow-sm"
                    : "text-gray-500 dark:text-gray-400"
                }`}
              >
                {m === "monthly" ? "Monthly" : m === "yearly" ? "Yearly" : "All Time"}
              </button>
            ))}
          </div>

          <div className="flex items-center justify-between">
            {/* Date navigation */}
            <div className="flex items-center gap-1">
              {viewMode === "monthly" && (
                <>
                  <button onClick={() => setSelectedMonth(addMonths(activeMonth, -1))}
                    className="text-gray-400 dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 text-xl leading-none px-1">‹</button>
                  <div>
                    <h1 className="text-sm font-bold text-gray-800 dark:text-gray-100">{formatMonth(activeMonth)}</h1>
                    {!isCurrentMonth && (
                      <button onClick={() => setSelectedMonth(null)}
                        className="text-xs text-teal-600 dark:text-teal-400 hover:underline">Back to latest</button>
                    )}
                  </div>
                  <button onClick={() => setSelectedMonth(addMonths(activeMonth, 1))}
                    disabled={activeMonth >= todayMonth}
                    className="text-gray-400 dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 text-xl leading-none px-1 disabled:opacity-30">›</button>
                </>
              )}
              {viewMode === "yearly" && (
                <>
                  <button onClick={() => setSelectedYear((y) => String(Number(y) - 1))}
                    className="text-gray-400 dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 text-xl leading-none px-1">‹</button>
                  <h1 className="text-sm font-bold text-gray-800 dark:text-gray-100 px-1">{selectedYear}</h1>
                  <button onClick={() => setSelectedYear((y) => String(Number(y) + 1))}
                    disabled={selectedYear >= todayYear}
                    className="text-gray-400 dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 text-xl leading-none px-1 disabled:opacity-30">›</button>
                </>
              )}
              {viewMode === "alltime" && (
                <h1 className="text-sm font-bold text-gray-800 dark:text-gray-100">All Time</h1>
              )}
            </div>

            <select
              value={currency}
              onChange={(e) => handleCurrencyChange(e.target.value)}
              className="text-sm border border-gray-200 dark:border-gray-600 rounded-lg px-2 py-1 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-teal-400"
            >
              {CURRENCIES.map((c) => (
                <option key={c.code} value={c.code}>{c.symbol} {c.code}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 pt-4 space-y-5 animate-fade-in">
        {/* Health Score */}
        {healthData && (
          <div className="bg-white dark:bg-gray-800 rounded-2xl px-4 py-3 shadow-sm border border-gray-100 dark:border-gray-700/50 fin-card">
            <HealthScore score={healthData.score} breakdown={healthData.breakdown as Record<string, { score: number }>} />
          </div>
        )}

        {/* Summary Cards */}
        {loadingSummary ? (
          <div className="grid grid-cols-2 gap-3">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="bg-gray-100 dark:bg-gray-800 rounded-2xl h-24 animate-pulse" />
            ))}
          </div>
        ) : summary ? (
          <SummaryCards data={summary} currency={currency} symbol={symbol} categories={categories} viewMode={viewMode} profileIncome={profile?.monthly_income} />
        ) : null}

        {/* Spending by Category */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-sm border border-gray-100 dark:border-gray-700/50 fin-card">
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Spending by Category</h2>
          {loadingCats ? (
            <div className="h-48 bg-gray-100 dark:bg-gray-700 rounded-xl animate-pulse" />
          ) : groupedCategories ? (
            <CategoryDonut data={groupedCategories} symbol={symbol} totalIncome={totalIncomeForDonut} />
          ) : null}
        </div>

        {/* Investment Chart */}
        <InvestmentChart categories={categories} symbol={symbol} />

        {/* Forecast Trend */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-sm border border-gray-100 dark:border-gray-700/50 fin-card">
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Spending Forecast</h2>
          <ForecastTrend symbol={symbol} projectedMonthEnd={viewMode === "monthly" ? summary?.projected_month_end : undefined} />
        </div>

        {/* 12-Month Trend */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-sm border border-gray-100 dark:border-gray-700/50 fin-card">
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">12-Month Trend</h2>
          <MonthlyTrendChart data={trend || []} symbol={symbol} />
        </div>
      </div>
    </div>
  );
}
