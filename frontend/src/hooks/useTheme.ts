import { useState, useEffect } from "react";

export type Theme = "light" | "dark" | "pink";

export const THEME_EVENT = "finbuddy-theme-change";

export function dispatchThemeChange(theme: Theme) {
  window.dispatchEvent(new CustomEvent<Theme>(THEME_EVENT, { detail: theme }));
}

/** Returns the active theme and re-renders when it changes. */
export function useTheme(): Theme {
  const [theme, setTheme] = useState<Theme>(() => {
    const html = document.documentElement;
    if (html.classList.contains("dark")) return "dark";
    if (html.classList.contains("pink")) return "pink";
    return "light";
  });

  useEffect(() => {
    const handler = (e: Event) => setTheme((e as CustomEvent<Theme>).detail);
    window.addEventListener(THEME_EVENT, handler);
    return () => window.removeEventListener(THEME_EVENT, handler);
  }, []);

  return theme;
}
