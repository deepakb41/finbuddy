import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Sun, Moon } from "lucide-react";
import { useAuth } from "../../hooks/useAuth";
import { Switch } from "../ui/switch";

function useDarkMode() {
  const [dark, setDark] = useState(() =>
    document.documentElement.classList.contains("dark")
  );

  const toggle = () => {
    const next = !document.documentElement.classList.contains("dark");
    if (next) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
    setDark(next);
    localStorage.setItem("finbuddy_theme", next ? "dark" : "light");
  };

  return { dark, toggle };
}

export function TopHeader() {
  const { user } = useAuth();
  const { dark, toggle } = useDarkMode();
  const navigate = useNavigate();

  const initials = user?.email
    ? user.email.slice(0, 2).toUpperCase()
    : "FB";

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-white dark:bg-gray-900 border-b border-gray-100 dark:border-gray-800" style={{ transition: 'background-color 0.2s ease' }}>
      <div className="flex items-center justify-between px-4 h-14 max-w-lg mx-auto">
        <div className="flex items-center gap-2">
          <img src="/logo.png" alt="FinBuddy" className="w-8 h-8" />
          <span className="text-lg font-bold text-teal-700 dark:text-teal-400 tracking-tight">FinBuddy</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5">
            <Sun className={`size-4 ${dark ? "text-gray-400 dark:text-gray-500" : "text-amber-500"}`} />
            <Switch checked={dark} onCheckedChange={toggle} aria-label="Toggle dark mode" />
            <Moon className={`size-4 ${dark ? "text-teal-400" : "text-gray-400"}`} />
          </div>
          <button
            type="button"
            onClick={() => navigate("/settings")}
            aria-label="Profile & settings"
            className="w-9 h-9 flex items-center justify-center rounded-full bg-teal-100 dark:bg-teal-900/40 hover:bg-teal-200 dark:hover:bg-teal-800/50 transition-colors text-xs font-bold text-teal-700 dark:text-teal-400"
          >
            {initials}
          </button>
        </div>
      </div>
    </header>
  );
}
