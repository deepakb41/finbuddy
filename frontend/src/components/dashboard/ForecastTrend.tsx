import { useQuery } from "@tanstack/react-query";
import { api } from "../../api/client";

interface Props { symbol: string; projectedMonthEnd?: number; }

function fmt(n: number, symbol: string) {
  return `${symbol}${n.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
}

export function ForecastTrend({ symbol, projectedMonthEnd }: Props) {
  const { data, isLoading } = useQuery({
    queryKey: ["forecast"],
    queryFn: () => api.insights.forecast(),
    staleTime: 86_400_000,
  });

  if (isLoading) return <div className="h-32 bg-gray-100 dark:bg-gray-700 rounded-xl animate-pulse" />;
  if (!data || data.history.length === 0) {
    return <div className="flex items-center justify-center h-20 text-gray-400 dark:text-gray-500 text-sm">Not enough data yet</div>;
  }

  const currentMonth = data.history[data.history.length - 1];
  const prevMonth = data.history[data.history.length - 2];
  const pctChange = prevMonth && prevMonth.total > 0
    ? ((currentMonth.total - prevMonth.total) / prevMonth.total) * 100
    : 0;

  const trendColor = data.trend === "decreasing" ? "text-emerald-600 dark:text-emerald-400"
    : data.trend === "increasing" ? "text-rose-600 dark:text-rose-400"
    : "text-sky-600 dark:text-sky-400";

  return (
    <div className="space-y-3">
      {/* Current month summary */}
      <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-xl">
        <div>
          {projectedMonthEnd && projectedMonthEnd > 0 ? (
            <>
              <p className="text-xs text-gray-500 dark:text-gray-400">Projected end of month</p>
              <p className="text-2xl font-bold text-amber-600 dark:text-amber-400">{fmt(projectedMonthEnd, symbol)}</p>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                Spent so far: <span className="font-medium text-gray-600 dark:text-gray-300">{fmt(currentMonth.total, symbol)}</span>
              </p>
            </>
          ) : (
            <>
              <p className="text-xs text-gray-500 dark:text-gray-400">Spent so far</p>
              <p className="text-2xl font-bold text-gray-800 dark:text-gray-100">{fmt(currentMonth.total, symbol)}</p>
            </>
          )}
        </div>
        <div className="text-right">
          <p className={`text-sm font-semibold ${trendColor}`}>
            {pctChange > 0 ? "▲" : pctChange < 0 ? "▼" : "→"} {Math.abs(pctChange).toFixed(0)}%
          </p>
          <p className="text-xs text-gray-400 dark:text-gray-500">vs last month</p>
        </div>
      </div>

      {/* 3-month forecast cards */}
      {data.forecast.length > 0 && (
        <div>
          <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">AI Forecast</p>
          <div className="grid grid-cols-3 gap-2">
            {data.forecast.map((f, i) => {
              const monthLabel = new Date(f.month + "-01").toLocaleDateString("en-IN", { month: "short", year: "2-digit" });
              return (
                <div key={f.month} className={`p-2.5 rounded-xl border text-center ${
                  i === 0 ? "border-violet-200 dark:border-violet-700 bg-violet-50 dark:bg-violet-950/30"
                  : "border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50"
                }`}>
                  <p className="text-xs text-gray-400 dark:text-gray-500">{monthLabel}</p>
                  <p className={`text-sm font-bold mt-0.5 ${i === 0 ? "text-violet-700 dark:text-violet-400" : "text-gray-700 dark:text-gray-200"}`}>
                    {fmt(f.total, symbol)}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <p className="text-xs text-gray-400 dark:text-gray-500 leading-relaxed">
        Based on your last 2 years of spending, adjusted for Indian seasonal patterns (festivals, travel). Fallback: 6-month moving average.
      </p>
    </div>
  );
}
