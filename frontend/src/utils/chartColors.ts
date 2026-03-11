// Vibrant-pastel palette that reads well in both light and dark mode
// Uses Tailwind -400 equivalents: visible on white AND dark gray backgrounds
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

// Legacy export kept for any imports that still use PALETTES["multi"]
export const PALETTES = {
  multi: CHART_COLORS,
} as const;

export type PaletteKey = "multi";
export const PALETTE_STORAGE_KEY = "finbuddy_chart_palette";

export function getChartPalette(): PaletteKey {
  return "multi";
}

export function setChartPalette(_key: PaletteKey) {
  // only one palette now — noop
}
