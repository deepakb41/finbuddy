import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";

const THRESHOLD = 70;

export function usePullToRefresh() {
  const qc = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);
  const startY = useRef(0);
  const maxDy = useRef(0);

  useEffect(() => {
    const onTouchStart = (e: TouchEvent) => {
      if (window.scrollY === 0) {
        startY.current = e.touches[0].clientY;
        maxDy.current = 0;
      } else {
        startY.current = 0;
      }
    };

    const onTouchMove = (e: TouchEvent) => {
      if (!startY.current) return;
      const dy = e.touches[0].clientY - startY.current;
      if (dy > 0) maxDy.current = Math.max(maxDy.current, dy);
    };

    const onTouchEnd = async () => {
      if (startY.current && maxDy.current >= THRESHOLD) {
        setRefreshing(true);
        await qc.invalidateQueries();
        setTimeout(() => setRefreshing(false), 700);
      }
      startY.current = 0;
      maxDy.current = 0;
    };

    document.addEventListener("touchstart", onTouchStart, { passive: true });
    document.addEventListener("touchmove", onTouchMove, { passive: true });
    document.addEventListener("touchend", onTouchEnd);
    return () => {
      document.removeEventListener("touchstart", onTouchStart);
      document.removeEventListener("touchmove", onTouchMove);
      document.removeEventListener("touchend", onTouchEnd);
    };
  }, [qc]);

  return { refreshing };
}
