import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { DollarSign, type LucideIcon } from "lucide-react";
import { api } from "../../api/client";
import type { Transaction } from "../../api/client";
import { CATEGORIES as CAT_LIST } from "../add/CategoryGrid";

// Build a map from category label → Lucide icon component
const CATEGORY_ICON_MAP: Record<string, LucideIcon> = Object.fromEntries(
  CAT_LIST.map((c) => [c.label, c.Icon])
);

const CATEGORY_COLOR_MAP: Record<string, string> = Object.fromEntries(
  CAT_LIST.map((c) => [c.label, c.color])
);

const CATEGORY_NAMES = CAT_LIST.map((c) => c.label);

interface Props {
  tx: Transaction;
  symbol: string;
}

export function TransactionItem({ tx, symbol }: Props) {
  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [category, setCategory] = useState(tx.category || "Other / Misc");

  const patchMutation = useMutation({
    mutationFn: (cat: string) => api.transactions.patch(tx.transaction_id, { category: cat }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["transactions"] });
      qc.invalidateQueries({ queryKey: ["categories"] });
      setEditing(false);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => api.transactions.delete(tx.transaction_id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["transactions"] });
      qc.invalidateQueries({ queryKey: ["summary"] });
    },
  });

  const isIncome = tx.type === "income";
  const date = new Date(tx.date).toLocaleDateString("en-IN", { day: "numeric", month: "short" });

  const IconComponent = CATEGORY_ICON_MAP[tx.category || ""] || DollarSign;
  const iconColor = isIncome
    ? "text-emerald-500"
    : CATEGORY_COLOR_MAP[tx.category || ""] || "text-gray-400";
  const iconBg = isIncome
    ? "bg-emerald-50 dark:bg-emerald-900/20"
    : "bg-gray-100 dark:bg-gray-700";

  return (
    <div className="flex items-center gap-3 py-3 border-b border-gray-100 dark:border-gray-700/60 last:border-0 hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors rounded-xl px-1 -mx-1">
      <div className={`w-10 h-10 rounded-xl ${iconBg} flex items-center justify-center flex-shrink-0`}>
        <IconComponent size={18} className={iconColor} />
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-gray-800 dark:text-gray-100 truncate">
          {tx.merchant_normalized || tx.merchant_raw}
        </p>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-xs text-gray-400 dark:text-gray-500">{date}</span>
          {editing ? (
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              onBlur={() => {
                if (category !== tx.category) patchMutation.mutate(category);
                else setEditing(false);
              }}
              autoFocus
              className="text-xs border border-teal-300 dark:border-teal-600 rounded-md px-1.5 py-0.5 focus:outline-none bg-white dark:bg-gray-700 dark:text-white"
            >
              {CATEGORY_NAMES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          ) : (
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="text-xs bg-gray-100 dark:bg-gray-700 rounded-md px-1.5 py-0.5 text-gray-500 dark:text-gray-400 hover:bg-teal-50 dark:hover:bg-teal-900/30 hover:text-teal-700 dark:hover:text-teal-400 transition-colors"
            >
              {tx.category || "Uncategorized"}
            </button>
          )}
        </div>
      </div>

      <div className="flex flex-col items-end gap-1">
        <span className={`text-sm font-bold ${isIncome ? "text-emerald-600 dark:text-emerald-400" : "text-gray-800 dark:text-gray-100"}`}>
          {isIncome ? "+" : "-"}{symbol}{Math.abs(tx.amount).toLocaleString("en-IN", { maximumFractionDigits: 0 })}
        </span>
        <button
          type="button"
          onClick={() => deleteMutation.mutate()}
          disabled={deleteMutation.isPending}
          className="text-xs text-gray-300 dark:text-gray-600 hover:text-red-400 dark:hover:text-red-400 transition-colors"
        >
          ✕
        </button>
      </div>
    </div>
  );
}
