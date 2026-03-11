const CATEGORIES = [
  { label: "Food & Dining",    icon: "🍔" },
  { label: "Groceries",        icon: "🛒" },
  { label: "Transport",        icon: "🚗" },
  { label: "Travel",           icon: "✈️" },
  { label: "Shopping",         icon: "🛍️" },
  { label: "Entertainment",    icon: "🎬" },
  { label: "Utilities & Bills",icon: "💡" },
  { label: "Telecom",          icon: "📱" },
  { label: "Healthcare",       icon: "💊" },
  { label: "Fitness",          icon: "💪" },
  { label: "Rent",             icon: "🏠" },
  { label: "Education",        icon: "📚" },
  { label: "Finance & EMI",    icon: "💳" },
  { label: "Personal Care",    icon: "💅" },
  { label: "Lend & Split",     icon: "🤝" },
  { label: "Other / Misc",     icon: "📦" },
];

interface Props {
  value: string;
  onChange: (cat: string) => void;
}

export function CategoryGrid({ value, onChange }: Props) {
  return (
    <div className="grid grid-cols-4 gap-2">
      {CATEGORIES.map((cat) => (
        <button
          key={cat.label}
          type="button"
          onClick={() => onChange(cat.label)}
          className={`flex flex-col items-center gap-1 py-2 px-1 rounded-xl border text-center transition-all ${
            value === cat.label
              ? "border-teal-400 bg-teal-50 dark:bg-teal-900/30 text-teal-700 dark:text-teal-400"
              : "border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:border-gray-300 dark:hover:border-gray-500"
          }`}
        >
          <span className="text-xl">{cat.icon}</span>
          <span className="text-[10px] leading-tight font-medium">{cat.label}</span>
        </button>
      ))}
    </div>
  );
}

export { CATEGORIES };
