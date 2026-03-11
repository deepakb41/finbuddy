import { useState, useEffect } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { CHART_COLORS } from "../../utils/chartColors";

interface Props {
  data: { month: string; category: string; total: number }[];
  symbol: string;
}

const FIXED_CATS = new Set(["Rent", "Finance & EMI", "Telecom", "Utilities & Bills", "Education", "Investments"]);
type FilterMode = "all" | "fixed" | "variable";

export function MonthlyTrendChart({ data, symbol }: Props) {
  const [filter, setFilter] = useState<FilterMode>("variable");
  const [selectedCats, setSelectedCats] = useState<string[] | null>(null); // null = show default (3 cats)

  // A4: Initialize with top 3 variable categories on first data load
  useEffect(() => {
    if (selectedCats === null && data.length > 0) {
      const varCats = [...new Set(
        data.filter(d => !FIXED_CATS.has(d.category)).map(d => d.category)
      )];
      setSelectedCats(varCats.slice(0, 3));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  // Build category list based on expense type filter
  const allCatsForFilter = [...new Set(
    data
      .filter(({ category }) => {
        if (filter === "fixed") return FIXED_CATS.has(category);
        if (filter === "variable") return !FIXED_CATS.has(category);
        return true;
      })
      .map(({ category }) => category)
  )];

  const activeCats = selectedCats
    ? selectedCats.filter(c => allCatsForFilter.includes(c))
    : allCatsForFilter;

  const handleFilterChange = (f: FilterMode) => {
    setFilter(f);
    // Pick top 3 of the new filter mode
    const cats = [...new Set(
      data
        .filter(({ category }) => {
          if (f === "fixed") return FIXED_CATS.has(category);
          if (f === "variable") return !FIXED_CATS.has(category);
          return true;
        })
        .map(({ category }) => category)
    )];
    setSelectedCats(cats.slice(0, 3));
  };

  const toggleCat = (cat: string) => {
    const current = selectedCats ?? allCatsForFilter;
    const next = current.includes(cat)
      ? current.filter((c) => c !== cat)
      : [...current, cat];
    setSelectedCats(next);
  };

  const monthMap: Record<string, Record<string, number>> = {};

  data.forEach(({ month, category, total }) => {
    const m = month.slice(0, 7);
    const isFixed = FIXED_CATS.has(category);
    if (filter === "fixed" && !isFixed) return;
    if (filter === "variable" && isFixed) return;
    if (!activeCats.includes(category)) return;
    if (!monthMap[m]) monthMap[m] = {};
    monthMap[m][category] = (monthMap[m][category] || 0) + total;
  });

  const pivoted = Object.entries(monthMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, cats]) => ({ month: month.slice(2), ...cats }));

  const catList = activeCats.slice(0, 10);

  return (
    <div className="space-y-3">
      {/* Row 1: expense type filter */}
      <div className="flex gap-1 bg-gray-100 dark:bg-gray-700 rounded-xl p-1 w-fit">
        {(["all", "fixed", "variable"] as FilterMode[]).map((f) => (
          <button key={f} type="button" onClick={() => handleFilterChange(f)}
            className={`px-3 py-1 rounded-lg text-xs font-medium transition-all capitalize ${
              filter === f
                ? "bg-white dark:bg-gray-600 text-teal-700 dark:text-teal-400 shadow-sm"
                : "text-gray-500 dark:text-gray-400"
            }`}>
            {f}
          </button>
        ))}
      </div>

      {/* Row 2: category filter chips */}
      {allCatsForFilter.length > 1 && (
        <div className="flex flex-wrap gap-1">
          {allCatsForFilter.map((cat, idx) => {
            const on = activeCats.includes(cat);
            const color = CHART_COLORS[idx % CHART_COLORS.length];
            return (
              <button key={cat} type="button" onClick={() => toggleCat(cat)}
                className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                  on ? "border-transparent text-white dark:text-gray-900 font-medium"
                  : "border-gray-200 dark:border-gray-600 text-gray-400 dark:text-gray-500"
                }`}
                style={on ? { backgroundColor: color, borderColor: color } : undefined}>
                {cat}
              </button>
            );
          })}
        </div>
      )}

      {pivoted.length === 0 ? (
        <div className="flex items-center justify-center h-40 text-gray-400 dark:text-gray-500 text-sm">
          No trend data
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={pivoted} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" className="dark:stroke-gray-700" />
            <XAxis dataKey="month" tick={{ fontSize: 11, fill: "#94a3b8" }} />
            <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} tickFormatter={(v) => `${symbol}${(v/1000).toFixed(0)}k`} />
            <Tooltip
              contentStyle={{ backgroundColor: "var(--tooltip-bg, #fff)", border: "1px solid #e2e8f0", borderRadius: 8, fontSize: 12 }}
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              formatter={(value: any, name: any) => [`${symbol}${Number(value).toLocaleString("en-IN",{maximumFractionDigits:0})}`, name]}
            />
            {catList.map((cat, i) => (
              <Bar key={cat} dataKey={cat} stackId="a" fill={CHART_COLORS[i % CHART_COLORS.length]} radius={i === catList.length - 1 ? [3, 3, 0, 0] : [0, 0, 0, 0]} />
            ))}
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
