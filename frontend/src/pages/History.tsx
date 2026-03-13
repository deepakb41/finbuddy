import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "../api/client";
import { TransactionItem } from "../components/history/TransactionItem";

const MONTHS = Array.from({ length: 6 }, (_, i) => {
  const d = new Date();
  d.setMonth(d.getMonth() - i);
  return d.toISOString().slice(0, 7);
});

const FILTER_CATEGORIES = [
  "All", "Food & Dining", "Groceries", "Transport", "Travel",
  "Shopping", "Entertainment", "Utilities & Bills", "Healthcare",
  "Fitness", "Rent", "Education", "Personal Care", "Gifting",
  "Lend & Split", "Investments", "Other / Misc",
];

type SortKey = "date_desc" | "date_asc" | "amount_desc" | "amount_asc";

const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: "date_desc",   label: "Newest" },
  { key: "date_asc",    label: "Oldest" },
  { key: "amount_desc", label: "Highest" },
  { key: "amount_asc",  label: "Lowest" },
];

export function History() {
  const [search, setSearch] = useState("");
  const [month, setMonth] = useState(MONTHS[0]);
  const [filterCategory, setFilterCategory] = useState("");
  const [sortBy, setSortBy] = useState<SortKey>("date_desc");

  const currency = localStorage.getItem("finbuddy_currency") || "INR";
  const symbol = { GBP: "£", INR: "₹", USD: "$", EUR: "€", AED: "د.إ" }[currency] || currency;

  const { data: transactions, isLoading } = useQuery({
    queryKey: ["transactions", month, search, filterCategory],
    queryFn: () => api.transactions.list({
      month,
      search: search || undefined,
      category: filterCategory || undefined,
      limit: 200,
    }),
    refetchInterval: 30_000,
  });

  const totals = transactions?.reduce(
    (acc, tx) => {
      if (tx.status === "deleted") return acc;
      if (tx.type === "expense") acc.expense += tx.amount;
      else if (tx.type === "income") acc.income += tx.amount;
      return acc;
    },
    { expense: 0, income: 0 }
  ) || { expense: 0, income: 0 };

  const visible = (transactions?.filter((t) => t.status !== "deleted") || []);

  const sorted = [...visible].sort((a, b) => {
    if (sortBy === "date_desc")   return b.date.localeCompare(a.date);
    if (sortBy === "date_asc")    return a.date.localeCompare(b.date);
    if (sortBy === "amount_desc") return b.amount - a.amount;
    return a.amount - b.amount;
  });

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 pb-24">
      {/* Header */}
      <div className="bg-white dark:bg-gray-900 px-4 pt-4 pb-3 shadow-sm sticky top-14 z-10 border-b border-gray-100 dark:border-gray-800">
        <div className="max-w-lg mx-auto space-y-3">
          <h1 className="text-xl font-bold text-gray-800 dark:text-gray-100">History</h1>

          {/* Month selector */}
          <div className="flex gap-2 overflow-x-auto pb-1">
            {MONTHS.map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMonth(m)}
                className={`flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  month === m
                    ? "bg-teal-500 text-white"
                    : "bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700"
                }`}
              >
                {new Date(m + "-01").toLocaleDateString("en-IN", { month: "short", year: "2-digit" })}
              </button>
            ))}
          </div>

          {/* Search */}
          <input
            type="search"
            placeholder="Search transactions…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full border border-gray-200 dark:border-gray-600 dark:bg-gray-800 dark:text-white rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400"
          />

          {/* Filter + Sort row */}
          <div className="flex gap-2">
            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              className="flex-1 text-xs border border-gray-200 dark:border-gray-600 dark:bg-gray-800 dark:text-white rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-teal-400"
            >
              {FILTER_CATEGORIES.map((cat) => (
                <option key={cat} value={cat === "All" ? "" : cat}>{cat}</option>
              ))}
            </select>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortKey)}
              className="text-xs border border-gray-200 dark:border-gray-600 dark:bg-gray-800 dark:text-white rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-teal-400"
            >
              {SORT_OPTIONS.map((o) => (
                <option key={o.key} value={o.key}>{o.label}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 pt-3 space-y-3 animate-fade-in">
        {/* Month summary */}
        <div className="flex gap-3">
          <div className="flex-1 bg-rose-50 dark:bg-rose-950/30 rounded-xl p-3 text-center">
            <p className="text-xs text-gray-500 dark:text-gray-400">Spent</p>
            <p className="text-lg font-bold text-rose-700 dark:text-rose-400">
              {symbol}{totals.expense.toLocaleString("en-IN", { maximumFractionDigits: 0 })}
            </p>
          </div>
          <div className="flex-1 bg-emerald-50 dark:bg-emerald-950/30 rounded-xl p-3 text-center">
            <p className="text-xs text-gray-500 dark:text-gray-400">Income</p>
            <p className="text-lg font-bold text-emerald-700 dark:text-emerald-400">
              {symbol}{totals.income.toLocaleString("en-IN", { maximumFractionDigits: 0 })}
            </p>
          </div>
          <div className="flex-1 bg-gray-100 dark:bg-gray-800 rounded-xl p-3 text-center">
            <p className="text-xs text-gray-500 dark:text-gray-400">Count</p>
            <p className="text-lg font-bold text-gray-700 dark:text-gray-300">{sorted.length}</p>
          </div>
        </div>

        {/* Transaction list */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm overflow-hidden">
          {isLoading ? (
            [...Array(6)].map((_, i) => (
              <div key={i} className="flex items-center gap-3 p-4 border-b border-gray-50 dark:border-gray-700">
                <div className="w-10 h-10 bg-gray-100 dark:bg-gray-700 rounded-xl animate-pulse" />
                <div className="flex-1 space-y-2">
                  <div className="h-3 bg-gray-100 dark:bg-gray-700 rounded animate-pulse w-3/4" />
                  <div className="h-2.5 bg-gray-100 dark:bg-gray-700 rounded animate-pulse w-1/2" />
                </div>
                <div className="h-4 bg-gray-100 dark:bg-gray-700 rounded animate-pulse w-16" />
              </div>
            ))
          ) : sorted.length === 0 ? (
            <div className="py-12 text-center text-gray-400 dark:text-gray-500 text-sm">
              <p className="text-3xl mb-2">🔍</p>
              No transactions found
            </div>
          ) : (
            <div className="px-4">
              {sorted.map((tx) => (
                <TransactionItem key={tx.transaction_id} tx={tx} symbol={symbol} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
