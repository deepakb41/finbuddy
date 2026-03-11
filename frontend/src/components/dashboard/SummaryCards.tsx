interface SummaryData {
  total_expense: number;
  total_income: number;
  tx_count: number;
  savings_rate: number;
  projected_month_end: number;
  days_elapsed: number;
  days_in_month: number;
  last_month_expense?: number;
}

interface Props {
  data: SummaryData;
  currency: string;
  symbol: string;
  categories?: { category: string; this_month: number; last_month: number }[];
  viewMode?: "monthly" | "yearly" | "alltime";
}

const FIXED_CATS = new Set(["Rent", "Finance & EMI", "Telecom", "Utilities & Bills", "Education", "Investments"]);

function Card({ title, value, sub, cls, textCls, subCls }: {
  title: string; value: string; sub?: string; cls: string; textCls: string; subCls?: string;
}) {
  return (
    <div className={`rounded-2xl p-4 ${cls} flex flex-col gap-1 transition-transform duration-200 hover:scale-[1.02] active:scale-[0.98] animate-fade-in`}>
      <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">{title}</p>
      <p className={`text-xl font-bold ${textCls} leading-tight`}>{value}</p>
      {sub && <p className={`text-xs ${subCls ?? "text-gray-500 dark:text-gray-400"}`}>{sub}</p>}
    </div>
  );
}

export function SummaryCards({ data, symbol, categories, viewMode = "monthly" }: Props) {
  const fmt = (n: number) => `${symbol}${n.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;

  // Savings rate — use user-defined target from settings
  const savingsTarget = parseInt(localStorage.getItem("finbuddy_savings_target") || "20");
  const savingsPct = Math.round(data.savings_rate * 100);

  const investments = categories
    ? categories.filter((c) => c.category === "Investments").reduce((sum, c) => sum + c.this_month, 0)
    : 0;

  const biggestVarCat = categories
    ?.filter(c => c.this_month > 0 && !FIXED_CATS.has(c.category))
    .sort((a, b) => b.this_month - a.this_month)[0];

  // A3: Top cat vs last month
  const biggestVarCatLastMonth = categories
    ?.filter(c => c.last_month > 0 && !FIXED_CATS.has(c.category))
    .sort((a, b) => b.last_month - a.last_month)[0];
  const topCatSame = biggestVarCatLastMonth?.category === biggestVarCat?.category;
  const topCatSub = biggestVarCat
    ? `${biggestVarCat.category}${viewMode === "monthly" ? ` · ${topCatSame ? "same as last month" : biggestVarCatLastMonth ? `↑ from ${biggestVarCatLastMonth.category}` : ""}` : ""}`
    : undefined;

  // A1: Daily avg — use backend last_month_expense with actual last-month day count
  const daysTracked = Math.max(1, data.days_elapsed);
  const dailyAvg = data.total_expense / daysTracked;

  let lastMonthDailyAvg = 0;
  if (viewMode === "monthly" && data.last_month_expense != null && data.last_month_expense > 0) {
    // Compute actual days in previous month
    const prevMonthDate = new Date();
    prevMonthDate.setDate(1);
    prevMonthDate.setMonth(prevMonthDate.getMonth() - 1);
    const lastMonthDays = new Date(prevMonthDate.getFullYear(), prevMonthDate.getMonth() + 1, 0).getDate();
    lastMonthDailyAvg = data.last_month_expense / lastMonthDays;
  }

  const dailyDiff = viewMode === "monthly" && lastMonthDailyAvg > 0
    ? Math.round(((dailyAvg - lastMonthDailyAvg) / lastMonthDailyAvg) * 100)
    : null;
  const dailySubText = dailyDiff === null
    ? `${daysTracked} days tracked`
    : dailyDiff > 0
    ? `▲ ${dailyDiff}% vs last month`
    : dailyDiff < 0
    ? `▼ ${Math.abs(dailyDiff)}% vs last month`
    : "same pace as last month";
  const dailySubCls = dailyDiff === null || dailyDiff === 0
    ? undefined
    : dailyDiff > 0
    ? "text-rose-500 dark:text-rose-400"
    : "text-emerald-500 dark:text-emerald-400";

  // Title variants
  const spendTitle = viewMode === "yearly" ? "Spent this year" : viewMode === "alltime" ? "Total spent" : "Spent this month";

  // A2: Month-end estimate — blank/show total for past months
  const isPastMonth = data.projected_month_end === 0 && viewMode === "monthly";
  const forecastTitle = viewMode === "yearly"
    ? "Monthly average"
    : viewMode === "alltime"
    ? "Avg per month"
    : isPastMonth
    ? "Month total"
    : "Month-end est.";
  const forecastValue = viewMode === "yearly"
    ? fmt(data.total_expense / 12)
    : viewMode === "alltime"
    ? fmt(data.total_expense / Math.max(1, 24))
    : isPastMonth
    ? fmt(data.total_expense)
    : fmt(data.projected_month_end);
  const forecastSub = viewMode === "yearly"
    ? "this year"
    : viewMode === "alltime"
    ? "~2 year avg"
    : isPastMonth
    ? "Complete month"
    : `Day ${data.days_elapsed} of ${data.days_in_month} · daily rate`;

  const investTitle = viewMode === "yearly" ? "Invested YTD" : viewMode === "alltime" ? "Total invested" : "Invested";
  const savingsTitle = viewMode === "alltime" ? "Avg savings rate" : "Savings rate";
  const dailyTitle = viewMode === "yearly" ? "Daily pace" : "Daily avg";
  const dailySub = viewMode === "monthly" ? dailySubText : "per day";

  return (
    <div className="grid grid-cols-2 gap-3 stagger">
      <Card title={spendTitle} value={fmt(data.total_expense)} sub={`${data.tx_count} transactions`}
        cls="bg-rose-50 dark:bg-rose-950/30" textCls="text-rose-700 dark:text-rose-400" />
      <Card title={forecastTitle} value={forecastValue} sub={forecastSub}
        cls="bg-amber-50 dark:bg-amber-950/30" textCls="text-amber-700 dark:text-amber-400" />
      <Card title={investTitle} value={fmt(investments)} sub={investments === 0 ? "No investments" : "SIPs & funds"}
        cls="bg-violet-50 dark:bg-violet-950/30" textCls="text-violet-700 dark:text-violet-400" />
      <Card title={savingsTitle} value={`${savingsPct}%`}
        sub={savingsPct >= savingsTarget ? "✅ On track" : savingsPct > 0 ? `⚠️ Below ${savingsTarget}%` : "—"}
        cls="bg-sky-50 dark:bg-sky-950/30" textCls="text-sky-700 dark:text-sky-400" />
      {biggestVarCat && (
        <Card title="Top spending" value={fmt(biggestVarCat.this_month)} sub={topCatSub}
          cls="bg-orange-50 dark:bg-orange-950/30" textCls="text-orange-700 dark:text-orange-400" />
      )}
      <Card
        title={dailyTitle}
        value={`${fmt(dailyAvg)}/day`}
        sub={dailySub}
        subCls={dailySubCls}
        cls="bg-teal-50 dark:bg-teal-950/30"
        textCls="text-teal-700 dark:text-teal-400"
      />
    </div>
  );
}
