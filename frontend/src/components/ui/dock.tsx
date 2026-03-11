import * as React from "react";
import { useRef } from "react";
import { cn } from "../../lib/utils";

interface DockProps {
  className?: string;
  children: React.ReactNode;
  maxAdditionalSize?: number;
  iconSize?: number;
}

export interface DockIconProps {
  className?: string;
  children: React.ReactNode;
  handleIconHover?: (e: React.MouseEvent<HTMLLIElement>) => void;
  iconSize?: number;
  isActive?: boolean;
  label?: string;
  badge?: number;
}

export function scaleValue(
  value: number,
  from: [number, number],
  to: [number, number]
): number {
  const scale = (to[1] - to[0]) / (from[1] - from[0]);
  const capped = Math.min(from[1], Math.max(from[0], value)) - from[0];
  return Math.floor(capped * scale + to[0]);
}

export function DockIcon({
  className,
  children,
  handleIconHover,
  iconSize = 52,
  isActive,
  label,
  badge,
}: DockIconProps) {
  const ref = useRef<HTMLLIElement | null>(null);

  return (
    <li
      ref={ref}
      style={
        {
          "--icon-size": `${iconSize}px`,
          width: `${iconSize}px`,
          height: `${iconSize}px`,
        } as React.CSSProperties
      }
      onMouseMove={handleIconHover}
      className={cn(
        "dock-icon group relative flex cursor-pointer items-center justify-center rounded-2xl",
        isActive
          ? "bg-teal-50 dark:bg-teal-900/40"
          : "bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700",
        "shadow-sm border border-gray-100 dark:border-gray-700",
        className
      )}
    >
      {/* Tooltip */}
      <span className="pointer-events-none absolute -top-9 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-lg border border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-800 px-2 py-1 text-xs text-gray-700 dark:text-gray-200 shadow-md opacity-0 transition-opacity duration-150 group-hover:opacity-100">
        {label}
      </span>

      {/* Badge */}
      {badge != null && badge > 0 && (
        <span className="absolute -top-1 -right-1 z-10 flex h-4 w-4 items-center justify-center rounded-full bg-teal-500 text-[9px] font-bold text-white">
          {badge > 9 ? "9+" : badge}
        </span>
      )}

      <div className={cn("flex flex-col items-center gap-0.5", isActive ? "text-teal-600 dark:text-teal-400" : "text-gray-500 dark:text-gray-400")}>
        {children}
      </div>

      {/* Active indicator dot */}
      {isActive && (
        <span className="absolute bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-teal-500" />
      )}
    </li>
  );
}

export function Dock({
  className,
  children,
  maxAdditionalSize = 6,
  iconSize = 52,
}: DockProps) {
  const dockRef = useRef<HTMLDivElement | null>(null);

  const handleIconHover = (e: React.MouseEvent<HTMLLIElement>) => {
    if (!dockRef.current) return;
    const mousePos = e.clientX;
    const iconPosLeft = e.currentTarget.getBoundingClientRect().left;
    const iconWidth = e.currentTarget.getBoundingClientRect().width;
    const cursorDistance = (mousePos - iconPosLeft) / iconWidth;
    const offsetPixels = scaleValue(cursorDistance, [0, 1], [maxAdditionalSize * -1, maxAdditionalSize]);
    dockRef.current.style.setProperty("--dock-offset-left", `${offsetPixels * -1}px`);
    dockRef.current.style.setProperty("--dock-offset-right", `${offsetPixels}px`);
  };

  return (
    <nav ref={dockRef} role="navigation" aria-label="Main navigation">
      <ul
        className={cn(
          "flex items-end gap-2 rounded-2xl border border-gray-100 dark:border-gray-800 bg-white/90 dark:bg-gray-900/90 backdrop-blur-md p-2 shadow-lg shadow-black/5 dark:shadow-black/30",
          className
        )}
      >
        {React.Children.map(children, (child) =>
          React.isValidElement<DockIconProps>(child)
            ? React.cloneElement(child, { handleIconHover, iconSize })
            : child
        )}
      </ul>
    </nav>
  );
}
