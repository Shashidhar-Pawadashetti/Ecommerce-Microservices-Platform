"use client";

import { useEffect, useRef } from "react";
import anime from "animejs";

interface AnimeCounterProps {
  target: number;
  duration?: number;
  suffix?: string;
  prefix?: string;
  decimals?: number;
  className?: string;
}

export function AnimeCounter({
  target,
  duration = 2000,
  suffix = "",
  prefix = "",
  decimals = 0,
  className = "",
}: AnimeCounterProps) {
  const countRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!countRef.current) return;

    const counterObj = { value: 0 };

    anime({
      targets: counterObj,
      value: target,
      round: decimals === 0 ? 1 : 100,
      easing: "easeOutExpo",
      duration: duration,
      update: () => {
        if (countRef.current) {
          const formatted = decimals > 0 
            ? counterObj.value.toFixed(decimals) 
            : Math.round(counterObj.value).toLocaleString();
          countRef.current.innerHTML = `${prefix}${formatted}${suffix}`;
        }
      },
    });
  }, [target, duration, suffix, prefix, decimals]);

  return (
    <span ref={countRef} className={`font-black tracking-tight ${className}`}>
      {prefix}0{suffix}
    </span>
  );
}
