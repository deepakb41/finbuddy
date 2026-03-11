import { useState } from "react";

interface Props {
  score: number;
  breakdown?: Record<string, { score: number; tip?: string }>;
}

function getColor(score: number) {
  if (score >= 80) return { text: "text-emerald-600 dark:text-emerald-400", bar: "#10b981" };
  if (score >= 60) return { text: "text-amber-600 dark:text-amber-400", bar: "#f59e0b" };
  if (score >= 40) return { text: "text-orange-500 dark:text-orange-400", bar: "#f97316" };
  return { text: "text-red-500 dark:text-red-400", bar: "#ef4444" };
}

function getLabel(score: number) {
  if (score >= 80) return "Excellent";
  if (score >= 60) return "Good";
  if (score >= 40) return "Fair";
  return "Needs work";
}

export function HealthScore({ score, breakdown }: Props) {
  const [expanded, setExpanded] = useState(false);
  const { text, bar } = getColor(score);

  return (
    <div>
      {/* Compact row */}
      <button
        type="button"
        onClick={() => setExpanded((e) => !e)}
        className="w-full flex items-center gap-3 group"
      >
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className={`text-xl font-bold tabular-nums ${text}`}>{score}</span>
          <span className={`text-xs font-medium ${text} hidden sm:block`}>{getLabel(score)}</span>
        </div>
        <div className="flex-1 h-1.5 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-700"
            style={{ width: `${score}%`, backgroundColor: bar }}
          />
        </div>
        <span className={`text-xs font-medium ${text} sm:hidden`}>{getLabel(score)}</span>
        <span className="text-xs text-gray-400 dark:text-gray-500 group-hover:text-gray-600 dark:group-hover:text-gray-400 flex-shrink-0">
          {expanded ? "▲" : "▼"} Health
        </span>
      </button>

      {/* Expandable breakdown */}
      {expanded && breakdown && (
        <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-700 space-y-2">
          {Object.entries(breakdown).map(([key, val]) => {
            const v = val as { score: number; tip?: string };
            const pct = (v.score / 25) * 100;
            return (
              <div key={key} className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-500 dark:text-gray-400 capitalize flex-1">
                    {key.replace(/_/g, " ")}
                  </span>
                  <div className="w-16 h-1.5 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden flex-shrink-0">
                    <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: bar }} />
                  </div>
                  <span className={`text-xs font-medium tabular-nums flex-shrink-0 w-8 text-right ${text}`}>{v.score}/25</span>
                </div>
                {v.tip && (
                  <p className="text-xs text-gray-400 dark:text-gray-500 pl-0 italic">{v.tip}</p>
                )}
              </div>
            );
          })}
          <div className="flex justify-between pt-2 border-t border-gray-100 dark:border-gray-700">
            <span className="text-xs text-gray-500 dark:text-gray-400">Total</span>
            <span className={`text-xs font-bold ${text}`}>{score}/100</span>
          </div>
        </div>
      )}
    </div>
  );
}
