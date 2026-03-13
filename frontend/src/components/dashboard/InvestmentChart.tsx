import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { TrendingUp } from "lucide-react";

const INVEST_CATS = new Set([
  "Investments","SIP","Stocks","Index Fund","ETF","REIT",
  "Bonds","Gold / Silver","Crypto","PPF / EPF","FD","NPS",
]);

interface CategoryRow {
  category: string;
  this_month: number;
  last_month: number;
}

interface Props {
  categories: CategoryRow[] | undefined;
  symbol: string;
}

export function InvestmentChart({ categories, symbol }: Props) {
  const isDark = document.documentElement.classList.contains("dark");
  const tooltipBg = isDark ? "#1f2937" : "#ffffff";
  const tooltipBorder = isDark ? "#374151" : "#e2e8f0";
  const axisColor = isDark ? "#6b7280" : "#94a3b8";
  const data = (categories || [])
    .filter(c => INVEST_CATS.has(c.category) && c.this_month > 0)
    .sort((a, b) => b.this_month - a.this_month);

  const total = data.reduce((s, c) => s + c.this_month, 0);
  if (total === 0) return null;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-sm border border-gray-100 dark:border-gray-700 fin-card">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 bg-violet-100 dark:bg-violet-900/30 rounded-lg flex items-center justify-center">
            <TrendingUp size={14} className="text-violet-600 dark:text-violet-400" />
          </div>
          <div>
            <p className="text-xs font-bold text-gray-700 dark:text-gray-200">Invested This Month</p>
            <p className="text-xs text-gray-400 dark:text-gray-500">{data.length} categories</p>
          </div>
        </div>
        <p className="text-lg font-bold text-violet-600 dark:text-violet-400">
          {symbol}{total.toLocaleString("en-IN", { maximumFractionDigits: 0 })}
        </p>
      </div>

      {data.length > 1 && (
        <ResponsiveContainer width="100%" height={Math.max(56, data.length * 28)}>
          <BarChart data={data} layout="vertical" margin={{ left: 0, right: 8, top: 0, bottom: 0 }}>
            <XAxis type="number" hide />
            <YAxis
              type="category"
              dataKey="category"
              width={90}
              tick={{ fontSize: 10, fill: axisColor }}
            />
            <Tooltip
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              formatter={(v: any) => [`${symbol}${Number(v).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`, ""]}
              contentStyle={{ background: tooltipBg, border: `1px solid ${tooltipBorder}`, borderRadius: 8, fontSize: 11 }}
            />
            <Bar dataKey="this_month" fill="#7c3aed" radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      )}

      {data.length === 1 && (
        <div className="flex items-center justify-between px-1 py-1 bg-violet-50 dark:bg-violet-900/20 rounded-lg">
          <span className="text-xs text-gray-600 dark:text-gray-300">{data[0].category}</span>
          <span className="text-xs font-bold text-violet-600 dark:text-violet-400">
            {symbol}{data[0].this_month.toLocaleString("en-IN", { maximumFractionDigits: 0 })}
          </span>
        </div>
      )}
    </div>
  );
}
