interface BudgetRow {
  category: string;
  budget: number;
  spent: number;
  currency: string;
  pct_used: number;
}

interface Props {
  data: BudgetRow[];
  symbol: string;
}

export function BudgetBars({ data, symbol }: Props) {
  if (!data.length) {
    return (
      <p className="text-sm text-gray-400 text-center py-4">
        No budgets set. Add budgets in Settings.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {data
        .sort((a, b) => b.pct_used - a.pct_used)
        .map((row) => {
          const pct = Math.min(row.pct_used * 100, 100);
          const over = row.pct_used > 1;
          const warn = row.pct_used > 0.9 && !over;

          return (
            <div key={row.category}>
              <div className="flex justify-between text-sm mb-1">
                <span className="font-medium text-gray-700">{row.category}</span>
                <span className={over ? "text-red-600 font-semibold" : warn ? "text-amber-600" : "text-gray-500"}>
                  {symbol}{row.spent.toLocaleString("en-IN", { maximumFractionDigits: 0 })}
                  {" / "}
                  {symbol}{row.budget.toLocaleString("en-IN", { maximumFractionDigits: 0 })}
                  {over && " 🔴"}
                  {warn && " ⚠️"}
                </span>
              </div>
              <div className="w-full bg-gray-100 rounded-full h-2.5 overflow-hidden">
                <div
                  className={`h-2.5 rounded-full transition-all ${
                    over ? "bg-red-500" : warn ? "bg-amber-400" : "bg-brand-500"
                  }`}
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          );
        })}
    </div>
  );
}
