import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { api } from "../api/client";
import { useTheme } from "../hooks/useTheme";
import { ActivityRings } from "../components/ui/activity-rings";

const FIXED_CATS = new Set(["Rent", "Finance & EMI", "Telecom", "Utilities & Bills", "Education", "Investments"]);
const _currency = localStorage.getItem("finbuddy_currency") || "INR";
const _symbol = ({ GBP: "£", INR: "₹", USD: "$", EUR: "€" } as Record<string, string>)[_currency] || _currency;


export function Insights() {
  const qc = useQueryClient();
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState<string | null>(null);
  const [asking, setAsking] = useState(false);

  const symbol = _symbol;

  const { data: aiSummary, isLoading: loadingSummary, refetch: refetchSummary } = useQuery({
    queryKey: ["ai-summary"],
    queryFn: () => api.insights.aiSummary(),
    staleTime: 60 * 60_000,
    retry: false,
  });

  const { data: categories } = useQuery({
    queryKey: ["categories-all"],
    queryFn: () => api.insights.categories(),
  });

  const { data: topMerchants } = useQuery({
    queryKey: ["top-merchants"],
    queryFn: () => api.insights.topMerchants(),
  });

  const { data: health } = useQuery({
    queryKey: ["health-score"],
    queryFn: () => api.insights.healthScore(),
  });

  const { data: summary } = useQuery({
    queryKey: ["insights-summary"],
    queryFn: () => api.insights.summary(),
  });

  const theme = useTheme();
  const accentColor = theme === "pink" ? "#c084fc" : theme === "dark" ? "#2dd4bf" : "#0d9488";
  const gridColor = theme === "dark" ? "#1f2937" : "#f1f5f9";
  const axisColor = theme === "dark" ? "#6b7280" : "#94a3b8";
  const tooltipBg = theme === "dark" ? "#1f2937" : "#ffffff";
  const tooltipBorder = theme === "pink" ? "#f0abfc" : "#e2e8f0";
  const barLastColor = theme === "dark" ? "#6b7280" : "#94a3b8";

  const handleAsk = async () => {
    if (!question.trim()) return;
    setAsking(true);
    setAnswer(null);
    try {
      const res = await api.insights.ask(question);
      setAnswer(res.answer);
    } catch {
      setAnswer("Could not get an answer. Check your GROQ_API_KEY.");
    } finally {
      setAsking(false);
    }
  };

  const momRows = categories
    ? [...categories]
        .filter((r) => r.this_month > 0 || r.last_month > 0)
        .map(r => ({
          ...r,
          variation: r.last_month > 0
            ? Math.abs((r.this_month - r.last_month) / r.last_month)
            : (r.this_month > 0 ? 999 : 0),
        }))
        .sort((a, b) => b.variation - a.variation)
        .slice(0, 5)
    : [];

  // Smart insight card content
  const biggestOpportunity = categories
    ? (() => {
        const varCats = categories.filter(c => !FIXED_CATS.has(c.category) && c.this_month > 0);
        const biggest = varCats.sort((a, b) => b.this_month - a.this_month)[0];
        if (!biggest) return null;
        return `Your top variable spend is ${biggest.category} at ${symbol}${biggest.this_month.toLocaleString("en-IN", { maximumFractionDigits: 0 })} this month.`;
      })()
    : null;

  const anomalyAlert = categories
    ? (() => {
        const anomaly = categories
          .filter(c => c.last_month > 0)
          .map(c => ({ ...c, pct: ((c.this_month - c.last_month) / c.last_month) * 100 }))
          .sort((a, b) => b.pct - a.pct)[0];
        if (!anomaly || anomaly.pct < 20) return "No significant spending anomalies this month.";
        return `${anomaly.category} is up ${Math.round(anomaly.pct)}% (${symbol}${anomaly.this_month.toLocaleString("en-IN", { maximumFractionDigits: 0 })}) vs last month (${symbol}${anomaly.last_month.toLocaleString("en-IN", { maximumFractionDigits: 0 })}).`;
      })()
    : null;

  const goalProgress = health
    ? (() => {
        const s = health.score;
        return `Your financial health score is ${s}/100. ${s >= 70 ? "You're on a solid track!" : s >= 50 ? "Room to improve — focus on savings." : "Consider reviewing your spending habits."}`;
      })()
    : null;

  const investBody = summary
    ? (() => {
        const surplus = summary.total_income - summary.total_expense;
        if (surplus <= 0) return "Reduce expenses to free up money to invest.";
        const investAmt = surplus * 0.2;
        const annualReturn = investAmt * 12 * 0.12;
        return `Invest 20% of your surplus (${symbol}${Math.round(investAmt).toLocaleString("en-IN")}/mo) and earn ~${symbol}${Math.round(annualReturn).toLocaleString("en-IN")} a year at 12% p.a.`;
      })()
    : null;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 pb-24">
      <div className="bg-white dark:bg-gray-900 px-4 pt-12 pb-4 shadow-sm border-b border-gray-100 dark:border-gray-800">
        <div className="max-w-lg mx-auto">
          <h1 className="text-xl font-bold text-gray-800 dark:text-gray-100">AI Insights</h1>
          <p className="text-xs text-gray-500 dark:text-gray-400">Powered by Groq · Llama 3.3</p>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 pt-4 space-y-4 animate-fade-in">

        {/* ── AI Summary ─────────────────────────────────────────── */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-sm border border-gray-100 dark:border-gray-700 fin-card">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-200">Spending Summary</h2>
            <button
              type="button"
              onClick={() => { qc.removeQueries({ queryKey: ["ai-summary"] }); refetchSummary(); }}
              className="text-xs text-teal-600 dark:text-teal-400 hover:underline"
            >
              Refresh
            </button>
          </div>

          {loadingSummary && (
            <div className="space-y-2">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="h-4 bg-gray-100 dark:bg-gray-700 rounded animate-pulse" style={{ width: `${70 + i * 8}%` }} />
              ))}
            </div>
          )}

          {aiSummary && (
            <div className="space-y-1.5">
              {aiSummary.summary.split("\n").filter(Boolean).map((line, i) => (
                <p key={i} className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed">{line}</p>
              ))}
              {aiSummary.cached && <p className="text-xs text-gray-300 dark:text-gray-600 mt-2">Cached · refreshes hourly</p>}
            </div>
          )}

          {!loadingSummary && !aiSummary && (
            <p className="text-sm text-gray-400 dark:text-gray-500 text-center py-2">
              Add a GROQ_API_KEY to enable AI summaries.
            </p>
          )}
        </div>

        {/* ── Smart Insight Cards (2×2) ──────────────────────────── */}
        <div>
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-200 px-1 mb-2">Smart Insights</h2>
          <div className="grid grid-cols-2 gap-2">
            {[
              { title: "Opportunity", icon: "💡", body: biggestOpportunity, loading: !categories },
              { title: "Anomaly", icon: "⚠️", body: anomalyAlert, loading: !categories },
              { title: "Progress", icon: "🎯", body: goalProgress, loading: !health },
              { title: "Invest", icon: "📈", body: investBody, loading: !summary },
            ].map(({ title, icon, body, loading }) => (
              <div key={title} className="bg-white dark:bg-gray-800 rounded-xl p-3 shadow-sm border border-gray-100 dark:border-gray-700 flex flex-col gap-1.5 fin-card">
                <div className="flex items-center gap-1.5">
                  <span className="text-base">{icon}</span>
                  <p className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wide leading-tight">{title}</p>
                </div>
                {loading ? (
                  <div className="h-3 bg-gray-100 dark:bg-gray-700 rounded animate-pulse w-3/4" />
                ) : body ? (
                  <p className="text-xs text-gray-700 dark:text-gray-200 leading-snug line-clamp-3">{body}</p>
                ) : (
                  <p className="text-xs text-gray-400 dark:text-gray-500">No data yet</p>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* ── Ask your finances ──────────────────────────────────── */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-sm border border-gray-100 dark:border-gray-700 fin-card">
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-3">Ask your finances</h2>
          <div className="flex gap-2">
            <input
              type="text"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAsk()}
              placeholder="e.g. Where did I spend most last month?"
              className="flex-1 border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400"
            />
            <button
              type="button"
              onClick={handleAsk}
              disabled={asking || !question.trim()}
              className="px-4 py-2.5 bg-teal-600 text-white rounded-xl text-sm font-medium hover:bg-teal-700 transition-colors disabled:opacity-50"
            >
              {asking ? "…" : "Ask"}
            </button>
          </div>

          {/* Quick prompts */}
          <div className="flex flex-wrap gap-1.5 mt-2">
            {[
              "What's my biggest expense category?",
              "How much did I spend on food this month?",
              "Am I saving enough?",
              "Any unusual spending patterns?",
            ].map((q) => (
              <button
                key={q}
                type="button"
                onClick={() => { setQuestion(q); }}
                className="text-xs bg-teal-50 dark:bg-teal-900/30 text-teal-700 dark:text-teal-400 px-2.5 py-1 rounded-full hover:bg-teal-100 dark:hover:bg-teal-900/50 transition-colors"
              >
                {q}
              </button>
            ))}
          </div>

          {answer && (
            <div className="mt-3 bg-gray-50 dark:bg-gray-700 rounded-xl p-3">
              <p className="text-sm text-gray-700 dark:text-gray-200 leading-relaxed whitespace-pre-wrap">{answer}</p>
            </div>
          )}
        </div>

        {/* ── Health Score – Activity Rings ──────────────────────── */}
        {health && (
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-sm border border-gray-100 dark:border-gray-700 fin-card">
            <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-3">Health Score</h2>
            <ActivityRings
              totalScore={health.score}
              accentColor={accentColor}
              categories={Object.entries(health.breakdown).map(([key, val]) => {
                const v = val as { score: number; tip?: string };
                return { label: key.replace(/_/g, " "), score: v.score, tip: v.tip };
              })}
            />
          </div>
        )}

        {/* ── Month vs Last Month (horizontal bars) ──────────────── */}
        {momRows.length > 0 && (
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-sm border border-gray-100 dark:border-gray-700 fin-card">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-200">Month vs Last Month</h2>
              <div className="flex items-center gap-3 text-[11px] text-gray-500 dark:text-gray-400">
                <span className="flex items-center gap-1"><span className="inline-block w-2.5 h-2.5 rounded-sm" style={{ background: accentColor }} />This month</span>
                <span className="flex items-center gap-1"><span className="inline-block w-2.5 h-2.5 rounded-sm" style={{ background: barLastColor }} />Last month</span>
              </div>
            </div>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart
                layout="vertical"
                data={momRows.map(r => ({
                  ...r,
                  cat: r.category.length > 14 ? r.category.slice(0, 14) + "…" : r.category,
                }))}
                margin={{ top: 0, right: 12, left: 0, bottom: 0 }}
                barCategoryGap="22%"
                barGap={3}
              >
                <CartesianGrid strokeDasharray="3 3" stroke={gridColor} horizontal={false} />
                <XAxis
                  type="number"
                  tick={{ fontSize: 10, fill: axisColor }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v) => `${symbol}${(v / 1000).toFixed(0)}k`}
                />
                <YAxis
                  type="category"
                  dataKey="cat"
                  width={90}
                  tick={{ fontSize: 11, fill: axisColor }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  contentStyle={{ background: tooltipBg, border: `1px solid ${tooltipBorder}`, borderRadius: 8, fontSize: 12 }}
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  formatter={(v: any, name: any) => [`${symbol}${Number(v).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`, name]}
                  cursor={{ fill: gridColor }}
                />
                <Bar dataKey="this_month" name="This month" fill={accentColor} radius={[0, 4, 4, 0]} maxBarSize={18} />
                <Bar dataKey="last_month" name="Last month" fill={barLastColor} radius={[0, 4, 4, 0]} maxBarSize={18} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* ── Top Merchants ──────────────────────────────────────── */}
        {topMerchants && topMerchants.length > 0 && (
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-sm border border-gray-100 dark:border-gray-700 fin-card">
            <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-3">Top Merchants (this month)</h2>
            <div className="space-y-2">
              {topMerchants.slice(0, 8).map((m, i) => (
                <div key={m.merchant} className="flex items-center gap-3">
                  <span className="text-xs text-gray-400 dark:text-gray-500 w-5">{i + 1}</span>
                  <span className="flex-1 text-sm text-gray-700 dark:text-gray-200 truncate">{m.merchant}</span>
                  <span className="text-sm font-medium text-gray-800 dark:text-gray-100">
                    {symbol}{m.total.toLocaleString("en-IN", { maximumFractionDigits: 0 })}
                  </span>
                  <span className="text-xs text-gray-400 dark:text-gray-500">{m.tx_count}×</span>
                </div>
              ))}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
