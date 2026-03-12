import { useState } from "react";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";
import { getActiveChartColors } from "../../utils/chartColors";
import { useTheme } from "../../hooks/useTheme";

const STORAGE_KEY = "finbuddy_cat_filter";

interface Props {
  data: { category: string; this_month: number }[];
  symbol: string;
  totalIncome: number;
}

export function CategoryDonut({ data, symbol, totalIncome }: Props) {
  const theme = useTheme();
  const CHART_COLORS = getActiveChartColors();
  const tooltipBorder = theme === "pink" ? "#f0abfc" : "#e2e8f0";
  const allCategories = data
    .filter((d) => d.this_month > 0)
    .sort((a, b) => b.this_month - a.this_month)
    .map((d) => d.category);

  const [viewMode, setViewMode] = useState<"amount" | "pct">("amount");
  const [selected, setSelected] = useState<string[]>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed: string[] = JSON.parse(stored);
        const valid = parsed.filter((c) => allCategories.includes(c));
        if (valid.length > 0) return valid;
      }
    } catch {}
    return [...allCategories];
  });

  const toggle = (cat: string) => {
    const next = selected.includes(cat)
      ? selected.filter((c) => c !== cat)
      : [...selected, cat];
    setSelected(next);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  };

  const selectAll = () => {
    setSelected(allCategories);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(allCategories));
  };

  const clearAll = () => {
    setSelected([]);
    localStorage.setItem(STORAGE_KEY, JSON.stringify([]));
  };

  if (!allCategories.length) {
    return (
      <div className="flex items-center justify-center h-48 text-gray-400 dark:text-gray-500 text-sm">
        No spending data for this period
      </div>
    );
  }

  const filtered = data
    .filter((d) => d.this_month > 0 && selected.includes(d.category))
    .sort((a, b) => b.this_month - a.this_month);

  return (
    <div className="space-y-3">
      {/* View mode toggle */}
      <div className="flex items-center justify-between">
        <div className="flex gap-1 bg-gray-100 dark:bg-gray-700 rounded-xl p-1">
          <button type="button" onClick={() => setViewMode("amount")}
            className={`px-3 py-1 rounded-lg text-xs font-medium transition-all ${viewMode === "amount" ? "bg-white dark:bg-gray-600 text-teal-700 dark:text-teal-400 shadow-sm" : "text-gray-500 dark:text-gray-400"}`}>
            {symbol} Amount
          </button>
          {totalIncome > 0 && (
            <button type="button" onClick={() => setViewMode("pct")}
              className={`px-3 py-1 rounded-lg text-xs font-medium transition-all ${viewMode === "pct" ? "bg-white dark:bg-gray-600 text-teal-700 dark:text-teal-400 shadow-sm" : "text-gray-500 dark:text-gray-400"}`}>
              % of Income
            </button>
          )}
        </div>
      </div>

      {/* Category filter chips */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">Categories</p>
          <div className="flex gap-2">
            <button onClick={selectAll} className="text-xs text-teal-600 dark:text-teal-400 hover:underline">All</button>
            <span className="text-gray-300 dark:text-gray-600">·</span>
            <button onClick={clearAll} className="text-xs text-gray-400 dark:text-gray-500 hover:underline">None</button>
          </div>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {allCategories.map((cat, idx) => {
            const on = selected.includes(cat);
            const color = CHART_COLORS[idx % CHART_COLORS.length];
            return (
              <button
                key={cat}
                onClick={() => toggle(cat)}
                className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                  on
                    ? "border-transparent text-white dark:text-gray-900 font-medium"
                    : "bg-transparent border-gray-200 dark:border-gray-600 text-gray-400 dark:text-gray-500"
                }`}
                style={on ? { backgroundColor: color, borderColor: color } : undefined}
              >
                {cat}
              </button>
            );
          })}
        </div>
      </div>

      {/* Chart */}
      {filtered.length === 0 ? (
        <div className="flex items-center justify-center h-32 text-gray-400 dark:text-gray-500 text-sm">
          Select categories above to view chart
        </div>
      ) : viewMode === "pct" && totalIncome > 0 ? (
        // % of income — horizontal bar chart
        <div className="space-y-1.5 pt-1">
          {filtered.map((d) => {
            const pct = Math.min(100, (d.this_month / totalIncome) * 100);
            const color = CHART_COLORS[allCategories.indexOf(d.category) % CHART_COLORS.length];
            return (
              <div key={d.category} className="space-y-0.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-600 dark:text-gray-300 truncate max-w-[60%]">{d.category}</span>
                  <span className="font-semibold tabular-nums" style={{ color }}>
                    {pct.toFixed(1)}%
                    <span className="text-gray-400 dark:text-gray-500 font-normal ml-1">
                      ({symbol}{d.this_month.toLocaleString("en-IN", { maximumFractionDigits: 0 })})
                    </span>
                  </span>
                </div>
                <div className="h-2 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{ width: `${pct}%`, backgroundColor: color }}
                  />
                </div>
              </div>
            );
          })}
          <p className="text-xs text-gray-400 dark:text-gray-500 pt-1">
            Total spent: {((filtered.reduce((s, d) => s + d.this_month, 0) / totalIncome) * 100).toFixed(1)}% of income
          </p>
        </div>
      ) : (
        // Amount — donut chart
        <ResponsiveContainer width="100%" height={220}>
          <PieChart>
            <Pie
              data={filtered}
              dataKey="this_month"
              nameKey="category"
              cx="50%"
              cy="50%"
              innerRadius={50}
              outerRadius={85}
              paddingAngle={2}
            >
              {filtered.map((entry) => {
                const idx = allCategories.indexOf(entry.category);
                return <Cell key={entry.category} fill={CHART_COLORS[idx % CHART_COLORS.length]} />;
              })}
            </Pie>
            <Tooltip
              contentStyle={{ backgroundColor: "var(--tooltip-bg,#fff)", border: `1px solid ${tooltipBorder}`, borderRadius: 8, fontSize: 12 }}
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              formatter={(value: any, name: any) => [
                `${symbol}${Number(value).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`,
                name,
              ]}
            />
          </PieChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
