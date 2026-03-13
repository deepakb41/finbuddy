import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Sun, Moon } from "lucide-react";
import { useAuth } from "../../hooks/useAuth";
import { Switch } from "../ui/switch";
import { type Theme, dispatchThemeChange } from "../../hooks/useTheme";

function applyTheme(theme: Theme) {
  const html = document.documentElement;
  html.classList.remove("dark", "pink");
  if (theme === "dark") html.classList.add("dark");
  if (theme === "pink") html.classList.add("pink");
  localStorage.setItem("finbuddy_theme", theme);
  dispatchThemeChange(theme);
}

function useLocalTheme() {
  const [theme, setTheme] = useState<Theme>(() => {
    const saved = localStorage.getItem("finbuddy_theme") as Theme | null;
    return saved ?? "light";
  });

  const setAndApply = (t: Theme) => {
    applyTheme(t);
    setTheme(t);
  };

  return { theme, setAndApply };
}

export function TopHeader() {
  const { user } = useAuth();
  const { theme, setAndApply } = useLocalTheme();
  const navigate = useNavigate();

  const initials = user?.email
    ? user.email.slice(0, 2).toUpperCase()
    : "FB";

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-white dark:bg-gray-900 border-b border-gray-100 dark:border-gray-800" style={{ transition: 'background-color 0.2s ease' }}>
      <div className="flex items-center justify-between px-4 h-14 max-w-lg mx-auto">
        <button type="button" onClick={() => navigate("/")} className="flex items-center gap-2">
          <img src="/logo.png" alt="FinBuddy" className="w-8 h-8" />
          <span className="fin-brand text-lg font-bold text-teal-700 dark:text-teal-400 tracking-tight">FinBuddy</span>
        </button>
        <div className="flex items-center gap-2">
          {/* Light / Dark toggle */}
          <div className="flex items-center gap-1.5">
            <Sun className={`size-4 ${theme === "light" ? "text-amber-500" : "text-gray-400"}`} />
            <Switch
              checked={theme === "dark"}
              onCheckedChange={(v) => setAndApply(v ? "dark" : "light")}
              aria-label="Toggle dark mode"
            />
            <Moon className={`size-4 ${theme === "dark" ? "text-teal-400" : "text-gray-400"}`} />
          </div>

          {/* Pink theme toggle */}
          <button
            type="button"
            onClick={() => setAndApply(theme === "pink" ? "light" : "pink")}
            aria-label="Toggle pink theme"
            title="Pink / Purple theme"
            className={`w-5 h-5 rounded-full border-2 transition-all ${
              theme === "pink"
                ? "border-fuchsia-500 scale-110 shadow-md"
                : "border-fuchsia-300 hover:border-fuchsia-400"
            }`}
            style={{ background: "linear-gradient(135deg, #f0abfc, #c084fc)" }}
          />

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
