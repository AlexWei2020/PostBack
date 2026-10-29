"use client";

import { useEffect, useRef } from "react";

// 列表底部哨兵：进入视窗（提前 600px）时触发 onReach，用于"翻到底自动加载"。
// enabled 每次由 false 变回 true（例如一批加载完成）都会重建观察器，
// 新观察器会立即上报当前是否可见——屏幕很高、一批填不满时会继续加载下一批。
export function useLoadMoreSentinel(onReach: () => void, enabled: boolean) {
  const ref = useRef<HTMLDivElement>(null);
  const onReachRef = useRef(onReach);

  useEffect(() => {
    onReachRef.current = onReach;
  });

  useEffect(() => {
    const el = ref.current;
    if (!enabled || !el || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) onReachRef.current();
      },
      { rootMargin: "0px 0px 600px 0px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [enabled]);

  return ref;
}
