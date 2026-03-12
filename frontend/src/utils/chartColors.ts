// Default vibrant-pastel palette (light + dark mode)
export const CHART_COLORS = [
  "#818cf8", // indigo-400
  "#34d399", // emerald-400
  "#f87171", // red-400
  "#fbbf24", // amber-400
  "#60a5fa", // blue-400
  "#a78bfa", // violet-400
  "#4ade80", // green-400
  "#f472b6", // pink-400
  "#fb923c", // orange-400
  "#2dd4bf", // teal-400
  "#e879f9", // fuchsia-400
  "#94a3b8", // slate-400
];

// Pink / purple pastel palette for the pink theme
export const PINK_CHART_COLORS = [
  "#f472b6", // pink-400
  "#c084fc", // purple-400
  "#e879f9", // fuchsia-400
  "#a78bfa", // violet-400
  "#fb7185", // rose-400
  "#d946ef", // fuchsia-500
  "#818cf8", // indigo-400
  "#f9a8d4", // pink-300
  "#ddd6fe", // violet-300
  "#f0abfc", // fuchsia-300
  "#c4b5fd", // violet-300
  "#fbcfe8", // pink-200
];

export function getActiveChartColors(): string[] {
  return document.documentElement.classList.contains("pink")
    ? PINK_CHART_COLORS
    : CHART_COLORS;
}

// Legacy exports
export const PALETTES = { multi: CHART_COLORS } as const;
export type PaletteKey = "multi";
export const PALETTE_STORAGE_KEY = "finbuddy_chart_palette";
export function getChartPalette(): PaletteKey { return "multi"; }
export function setChartPalette(_key: PaletteKey) {}
