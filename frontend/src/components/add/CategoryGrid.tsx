import {
  UtensilsCrossed, ShoppingCart, Car, Plane, ShoppingBag,
  Clapperboard, Zap, Heart, Dumbbell, Home, BookOpen,
  Sparkles, Gift, MoreHorizontal, type LucideIcon,
} from "lucide-react";

interface Category {
  label: string;
  Icon: LucideIcon;
  color: string;
}

const CATEGORIES: Category[] = [
  { label: "Food & Dining",    Icon: UtensilsCrossed, color: "text-orange-500" },
  { label: "Groceries",        Icon: ShoppingCart,    color: "text-green-600" },
  { label: "Transport",        Icon: Car,             color: "text-blue-500" },
  { label: "Travel",           Icon: Plane,           color: "text-sky-500" },
  { label: "Shopping",         Icon: ShoppingBag,     color: "text-pink-500" },
  { label: "Entertainment",    Icon: Clapperboard,    color: "text-purple-500" },
  { label: "Utilities & Bills",Icon: Zap,             color: "text-yellow-500" },
  { label: "Healthcare",       Icon: Heart,           color: "text-red-500" },
  { label: "Fitness",          Icon: Dumbbell,        color: "text-teal-500" },
  { label: "Rent",             Icon: Home,            color: "text-indigo-500" },
  { label: "Education",        Icon: BookOpen,        color: "text-blue-600" },
  { label: "Personal Care",    Icon: Sparkles,        color: "text-rose-400" },
  { label: "Gifting",          Icon: Gift,            color: "text-amber-500" },
  { label: "Other / Misc",     Icon: MoreHorizontal,  color: "text-gray-400" },
];

interface Props {
  value: string;
  onChange: (cat: string) => void;
}

export function CategoryGrid({ value, onChange }: Props) {
  return (
    <div className="grid grid-cols-4 gap-2">
      {CATEGORIES.map((cat) => {
        const isActive = value === cat.label;
        return (
          <button
            key={cat.label}
            type="button"
            onClick={() => onChange(cat.label)}
            className={`flex flex-col items-center gap-1 py-2 px-1 rounded-xl border text-center transition-all ${
              isActive
                ? "border-teal-400 bg-teal-50 dark:bg-teal-900/30"
                : "border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 hover:border-gray-300 dark:hover:border-gray-500"
            }`}
          >
            <cat.Icon
              size={18}
              className={isActive ? "text-teal-600 dark:text-teal-400" : cat.color}
            />
            <span className={`text-[9px] leading-tight font-medium ${
              isActive ? "text-teal-700 dark:text-teal-400" : "text-gray-600 dark:text-gray-300"
            }`}>
              {cat.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}

export { CATEGORIES };
