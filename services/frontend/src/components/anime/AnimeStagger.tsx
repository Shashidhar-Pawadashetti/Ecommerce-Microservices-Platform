"use client";

import { useEffect, useRef, ReactNode } from "react";
import anime from "animejs";

interface AnimeStaggerProps {
  children: ReactNode;
  className?: string;
  delay?: number;
  itemSelector?: string;
  staggerDelay?: number;
  fromDirection?: "bottom" | "top" | "left" | "right" | "scale";
}

export function AnimeStagger({
  children,
  className = "",
  delay = 100,
  itemSelector = ".anime-stagger-item",
  staggerDelay = 70,
  fromDirection = "bottom",
}: AnimeStaggerProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const items = containerRef.current.querySelectorAll(itemSelector);
    if (items.length === 0) return;

    let initialTransform: any = { translateY: [30, 0] };
    if (fromDirection === "top") initialTransform = { translateY: [-30, 0] };
    if (fromDirection === "left") initialTransform = { translateX: [-30, 0] };
    if (fromDirection === "right") initialTransform = { translateX: [30, 0] };
    if (fromDirection === "scale") initialTransform = { scale: [0.85, 1] };

    anime({
      targets: items,
      ...initialTransform,
      opacity: [0, 1],
      duration: 650,
      delay: anime.stagger(staggerDelay, { start: delay }),
      easing: "easeOutCubic",
    });
  }, [delay, itemSelector, staggerDelay, fromDirection]);

  return (
    <div ref={containerRef} className={className}>
      {children}
    </div>
  );
}
