"use client";

import { motion } from "framer-motion";

interface RingData {
  label: string;
  value: number;   // 0–100 percentage for the ring fill
  color: string;
  glowColor: string;
  current: number; // raw score
  max: number;     // max possible (25 for each breakdown)
}

interface CircleRingProps {
  data: RingData;
  index: number;
  size: number;
  strokeWidth: number;
}

function CircleRing({ data, index, size, strokeWidth }: CircleRingProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const progress = ((100 - data.value) / 100) * circumference;
  const gradId = `finring-grad-${index}`;

  return (
    <motion.div
      className="absolute inset-0 flex items-center justify-center"
      initial={{ opacity: 0, scale: 0.85 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.7, delay: index * 0.15, ease: "easeOut" }}
    >
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="transform -rotate-90"
        aria-label={`${data.label} – ${data.current}/${data.max}`}
      >
        <defs>
          <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={data.color} stopOpacity={1} />
            <stop offset="100%" stopColor={data.glowColor} stopOpacity={1} />
          </linearGradient>
        </defs>

        {/* track */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={data.color}
          strokeWidth={strokeWidth}
          opacity={0.12}
        />

        {/* progress arc */}
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={`url(#${gradId})`}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: progress }}
          transition={{ duration: 1.6, delay: index * 0.15, ease: "easeInOut" }}
          strokeLinecap="round"
          style={{ filter: `drop-shadow(0 0 5px ${data.color}55)` }}
        />
      </svg>
    </motion.div>
  );
}

export interface HealthRingData {
  label: string;
  score: number;
  tip?: string;
}

const RING_PALETTE = [
  { color: "#0d9488", glow: "#2dd4bf" }, // teal  (primary brand)
  { color: "#0891b2", glow: "#22d3ee" }, // cyan
  { color: "#7c3aed", glow: "#a78bfa" }, // violet
  { color: "#0f766e", glow: "#14b8a6" }, // deep teal
];

interface ActivityRingsProps {
  categories: HealthRingData[];
  totalScore: number;
  accentColor: string;
}

export function ActivityRings({ categories, totalScore, accentColor }: ActivityRingsProps) {
  const MAX_PER = 25;
  const rings: RingData[] = categories.map((c, i) => ({
    label: c.label,
    value: Math.round((c.score / MAX_PER) * 100),
    color: RING_PALETTE[i % RING_PALETTE.length].color,
    glowColor: RING_PALETTE[i % RING_PALETTE.length].glow,
    current: c.score,
    max: MAX_PER,
  }));

  // concentric sizes — outermost ring is first category
  const outerSize = 160;
  const gap = 26;
  const strokeWidth = 14;

  return (
    <div className="flex items-center gap-5">
      {/* rings */}
      <div
        className="relative flex-shrink-0 flex items-center justify-center"
        style={{ width: outerSize, height: outerSize }}
      >
        {rings.map((ring, i) => {
          const size = outerSize - i * gap;
          return (
            <CircleRing
              key={ring.label}
              data={ring}
              index={i}
              size={size}
              strokeWidth={strokeWidth}
            />
          );
        })}
        {/* center score */}
        <motion.div
          className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8 }}
        >
          <span className="text-2xl font-bold leading-none" style={{ color: accentColor }}>
            {totalScore}
          </span>
          <span className="text-[10px] text-gray-400 dark:text-gray-500 leading-tight">/100</span>
        </motion.div>
      </div>

      {/* legend */}
      <div className="flex flex-col gap-2.5 flex-1 min-w-0">
        {rings.map((ring) => {
          const cat = categories.find(c => c.label === ring.label);
          return (
            <div key={ring.label}>
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: ring.color }} />
                <span className="text-xs text-gray-600 dark:text-gray-300 capitalize flex-1 truncate leading-tight">
                  {ring.label}
                </span>
                <span className="text-xs font-semibold tabular-nums" style={{ color: ring.color }}>
                  {ring.current}/25
                </span>
              </div>
              {cat?.tip && (
                <p className="text-[10px] text-gray-400 dark:text-gray-500 italic ml-4.5 leading-tight mt-0.5 truncate">
                  {cat.tip}
                </p>
              )}
            </div>
          );
        })}
        <div className="flex items-center gap-2 pt-1.5 border-t border-gray-100 dark:border-gray-700">
          <span className="text-xs text-gray-500 dark:text-gray-400 flex-1">Total</span>
          <span className="text-sm font-bold" style={{ color: accentColor }}>{totalScore}/100</span>
        </div>
      </div>
    </div>
  );
}
