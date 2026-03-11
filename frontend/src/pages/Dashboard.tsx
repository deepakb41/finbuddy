import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { api } from "../api/client";
import { SummaryCards } from "../components/dashboard/SummaryCards";
import { CategoryDonut } from "../components/dashboard/CategoryDonut";
import { MonthlyTrendChart } from "../components/dashboard/MonthlyTrendChart";
import { HealthScore } from "../components/dashboard/HealthScore";
import { ForecastTrend } from "../components/dashboard/ForecastTrend";

const CURRENCIES: { code: string; symbol: string }[] = [
  { code: "INR", symbol: "₹" },
  { code: "GBP", symbol: "£" },
  { code: "USD", symbol: "$" },
  { code: "EUR", symbol: "€" },
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
    staleTime: Infinity,
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
          <div className="bg-white dark:bg-gray-800 rounded-2xl px-4 py-3 shadow-sm border border-gray-100 dark:border-gray-700/50">
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
          <SummaryCards data={summary} currency={currency} symbol={symbol} categories={categories} viewMode={viewMode} />
        ) : null}

        {/* Spending by Category */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-sm border border-gray-100 dark:border-gray-700/50">
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Spending by Category</h2>
          {loadingCats ? (
            <div className="h-48 bg-gray-100 dark:bg-gray-700 rounded-xl animate-pulse" />
          ) : categories ? (
            <CategoryDonut data={categories} symbol={symbol} totalIncome={summary?.total_income ?? 0} />
          ) : null}
        </div>

        {/* Forecast Trend */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-sm border border-gray-100 dark:border-gray-700/50">
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Spending Forecast</h2>
          <ForecastTrend symbol={symbol} projectedMonthEnd={viewMode === "monthly" ? summary?.projected_month_end : undefined} />
        </div>

        {/* 12-Month Trend */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-sm border border-gray-100 dark:border-gray-700/50">
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">12-Month Trend</h2>
          <MonthlyTrendChart data={trend || []} symbol={symbol} />
        </div>
      </div>
    </div>
  );
}
