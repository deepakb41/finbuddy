import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { api } from "../api/client";
import { useTheme } from "../hooks/useTheme";

const FIXED_CATS = new Set(["Rent", "Finance & EMI", "Telecom", "Utilities & Bills", "Education", "Investments"]);
const _currency = localStorage.getItem("finbuddy_currency") || "INR";
const _symbol = ({ GBP: "£", INR: "₹", USD: "$", EUR: "€" } as Record<string, string>)[_currency] || _currency;

function InsightCard({ title, icon, body, isLoading }: {
  title: string; icon: string; body: string | null; isLoading?: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const [chatQ, setChatQ] = useState("");
  const [chatA, setChatA] = useState<string | null>(null);
  const [chatLoading, setChatLoading] = useState(false);

  const handleAsk = async () => {
    if (!chatQ.trim()) return;
    setChatLoading(true);
    try {
      const res = await api.insights.ask(chatQ);
      setChatA(res.answer);
    } catch {
      setChatA("Could not get an answer.");
    } finally {
      setChatLoading(false);
    }
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-sm border border-gray-100 dark:border-gray-700">
      <div className="flex items-start gap-3">
        <span className="text-xl flex-shrink-0">{icon}</span>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">{title}</p>
          {isLoading ? (
            <div className="h-4 bg-gray-100 dark:bg-gray-700 rounded animate-pulse w-3/4" />
          ) : body ? (
            <p className="text-sm text-gray-700 dark:text-gray-200 leading-relaxed">{body}</p>
          ) : (
            <p className="text-sm text-gray-400 dark:text-gray-500">Not enough data yet</p>
          )}
        </div>
      </div>
      {body && (
        <div className="mt-3">
          <button type="button" onClick={() => setExpanded(e => !e)}
            className="text-xs text-teal-600 dark:text-teal-400 hover:underline">
            {expanded ? "▲ Close" : "→ Ask me more"}
          </button>
          {expanded && (
            <div className="mt-2 space-y-2">
              <div className="flex gap-2">
                <input type="text" value={chatQ} onChange={(e) => setChatQ(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleAsk()}
                  placeholder="Ask a follow-up…"
                  className="flex-1 border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-teal-400"
                />
                <button type="button" onClick={handleAsk} disabled={chatLoading || !chatQ.trim()}
                  className="px-3 py-2 bg-teal-600 text-white rounded-xl text-xs font-medium hover:bg-teal-700 disabled:opacity-50">
                  {chatLoading ? "…" : "Ask"}
                </button>
              </div>
              {chatA && (
                <div className="bg-gray-50 dark:bg-gray-700 rounded-xl p-3">
                  <p className="text-xs text-gray-700 dark:text-gray-200 leading-relaxed whitespace-pre-wrap">{chatA}</p>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

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

  const { data: monthlyTrend } = useQuery({
    queryKey: ["monthly-trend"],
    queryFn: () => api.insights.monthlyTrend(6),
  });

  const theme = useTheme();
  const areaColor = theme === "pink" ? "#c084fc" : theme === "dark" ? "#2dd4bf" : "#0d9488";
  const gridColor = theme === "dark" ? "#1f2937" : "#f1f5f9";
  const axisColor = theme === "dark" ? "#6b7280" : "#94a3b8";
  const tooltipBg = theme === "dark" ? "#1f2937" : "#ffffff";
  const tooltipBorder = theme === "pink" ? "#f0abfc" : "#e2e8f0";

  const trendData = useMemo(() => {
    if (!monthlyTrend) return [];
    const map = new Map<string, number>();
    for (const row of monthlyTrend) {
      map.set(row.month, (map.get(row.month) ?? 0) + row.total);
    }
    return [...map.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, total]) => ({
        month: new Date(month + "-01").toLocaleString("en-IN", { month: "short" }),
        total,
      }));
  }, [monthlyTrend]);

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
        .sort((a, b) => b.this_month - a.this_month)
        .filter((r) => r.this_month > 0 || r.last_month > 0)
        .slice(0, 8)
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

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 pb-24">
      <div className="bg-white dark:bg-gray-900 px-4 pt-12 pb-4 shadow-sm border-b border-gray-100 dark:border-gray-800">
        <div className="max-w-lg mx-auto">
          <h1 className="text-xl font-bold text-gray-800 dark:text-gray-100">AI Insights</h1>
          <p className="text-xs text-gray-500 dark:text-gray-400">Powered by Groq · Llama 3.3</p>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 pt-4 space-y-4 animate-fade-in">

        {/* ── Spending Trend ─────────────────────────────────────── */}
        {trendData.length > 0 && (
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-sm border border-gray-100 dark:border-gray-700">
            <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-3">Spending Trend — Last 6 Months</h2>
            <ResponsiveContainer width="100%" height={150}>
              <AreaChart data={trendData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="trendGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={areaColor} stopOpacity={0.25} />
                    <stop offset="95%" stopColor={areaColor} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: axisColor }} axisLine={false} tickLine={false} />
                <YAxis hide />
                <Tooltip
                  contentStyle={{ background: tooltipBg, border: `1px solid ${tooltipBorder}`, borderRadius: 8, fontSize: 12 }}
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  formatter={(v: any) => [`${symbol}${Number(v).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`, "Total spent"]}
                />
                <Area type="monotone" dataKey="total" stroke={areaColor} strokeWidth={2} fill="url(#trendGrad)" dot={{ r: 3, fill: areaColor }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* ── AI Summary ─────────────────────────────────────────── */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-sm border border-gray-100 dark:border-gray-700">
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

        {/* ── Smart Insight Cards ────────────────────────────────── */}
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-200 px-1">Smart Insights</h2>
          <InsightCard title="Biggest Opportunity" icon="💡" body={biggestOpportunity} isLoading={!categories} />
          <InsightCard title="Anomaly Alert" icon="⚠️" body={anomalyAlert} isLoading={!categories} />
          <InsightCard title="Goal Progress" icon="🎯" body={goalProgress} isLoading={!health} />
        </div>

        {/* ── Ask your finances ──────────────────────────────────── */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-sm border border-gray-100 dark:border-gray-700">
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

        {/* ── Health Score ───────────────────────────────────────── */}
        {health && (
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-sm border border-gray-100 dark:border-gray-700">
            <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-3">Health Score</h2>
            {Object.entries(health.breakdown).map(([key, val]) => {
              const v = val as { score: number; tip?: string };
              return (
                <div key={key} className="py-2 border-b border-gray-50 dark:border-gray-700 last:border-0">
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600 dark:text-gray-300 capitalize">{key.replace(/_/g, " ")}</span>
                    <span className="text-sm font-semibold text-gray-800 dark:text-gray-100">{v.score}/25</span>
                  </div>
                  {v.tip && <p className="text-xs text-gray-400 dark:text-gray-500 italic mt-0.5">{v.tip}</p>}
                </div>
              );
            })}
            <div className="flex justify-between pt-2 font-bold">
              <span className="text-gray-700 dark:text-gray-200">Total</span>
              <span className="text-teal-600 dark:text-teal-400">{health.score}/100</span>
            </div>
          </div>
        )}

        {/* ── Month vs Last Month ────────────────────────────────── */}
        {momRows.length > 0 && (
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-sm border border-gray-100 dark:border-gray-700">
            <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-3">Month vs Last Month</h2>
            <div className="space-y-2">
              {momRows.map((r) => {
                const change = r.last_month > 0
                  ? ((r.this_month - r.last_month) / r.last_month) * 100
                  : 0;
                const up = change > 0;
                return (
                  <div key={r.category} className="flex items-center gap-3 py-1">
                    <span className="text-sm text-gray-700 dark:text-gray-200 flex-1">{r.category}</span>
                    <span className="text-sm text-gray-500 dark:text-gray-400">
                      {symbol}{r.this_month.toLocaleString("en-IN", { maximumFractionDigits: 0 })}
                    </span>
                    {r.last_month > 0 && (
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                        up ? "bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400" : "bg-green-50 dark:bg-green-950/40 text-green-600 dark:text-green-400"
                      }`}>
                        {up ? "▲" : "▼"} {Math.abs(change).toFixed(0)}%
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Top Merchants ──────────────────────────────────────── */}
        {topMerchants && topMerchants.length > 0 && (
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-sm border border-gray-100 dark:border-gray-700">
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
