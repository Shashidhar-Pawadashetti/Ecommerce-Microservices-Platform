"use client";

import { useEffect, useRef } from "react";
import anime from "animejs";

export function AnimeBackground() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    // Floating morphing glowing orbs
    anime({
      targets: ".anime-orb-1",
      translateX: [
        { value: 80, duration: 4000, easing: "easeInOutSine" },
        { value: -40, duration: 5000, easing: "easeInOutQuad" },
        { value: 0, duration: 4500, easing: "easeInOutSine" },
      ],
      translateY: [
        { value: -60, duration: 4500, easing: "easeInOutQuad" },
        { value: 50, duration: 5500, easing: "easeInOutSine" },
        { value: 0, duration: 4000, easing: "easeInOutQuad" },
      ],
      scale: [
        { value: 1.25, duration: 6000, easing: "easeInOutSine" },
        { value: 0.9, duration: 5000, easing: "easeInOutQuad" },
        { value: 1, duration: 5500, easing: "easeInOutSine" },
      ],
      loop: true,
    });

    anime({
      targets: ".anime-orb-2",
      translateX: [
        { value: -100, duration: 5500, easing: "easeInOutSine" },
        { value: 60, duration: 4500, easing: "easeInOutQuad" },
        { value: 0, duration: 5000, easing: "easeInOutSine" },
      ],
      translateY: [
        { value: 70, duration: 5000, easing: "easeInOutQuad" },
        { value: -50, duration: 6000, easing: "easeInOutSine" },
        { value: 0, duration: 4500, easing: "easeInOutQuad" },
      ],
      scale: [
        { value: 0.85, duration: 4500, easing: "easeInOutQuad" },
        { value: 1.3, duration: 5500, easing: "easeInOutSine" },
        { value: 1, duration: 5000, easing: "easeInOutQuad" },
      ],
      loop: true,
    });

    anime({
      targets: ".anime-orb-3",
      translateX: [
        { value: 50, duration: 6000, easing: "easeInOutQuad" },
        { value: -80, duration: 4500, easing: "easeInOutSine" },
        { value: 0, duration: 5500, easing: "easeInOutQuad" },
      ],
      translateY: [
        { value: -80, duration: 5000, easing: "easeInOutSine" },
        { value: 40, duration: 6000, easing: "easeInOutQuad" },
        { value: 0, duration: 4500, easing: "easeInOutSine" },
      ],
      scale: [
        { value: 1.2, duration: 5000, easing: "easeInOutSine" },
        { value: 0.95, duration: 4000, easing: "easeInOutQuad" },
        { value: 1, duration: 5000, easing: "easeInOutSine" },
      ],
      loop: true,
    });

    // Floating micro-particles
    anime({
      targets: ".anime-particle",
      translateY: () => anime.random(-30, 30),
      translateX: () => anime.random(-30, 30),
      scale: () => [anime.random(0.5, 1.2), anime.random(0.8, 1.5)],
      opacity: () => [anime.random(0.2, 0.6), anime.random(0.4, 0.9)],
      duration: () => anime.random(3000, 6000),
      delay: anime.stagger(200),
      direction: "alternate",
      loop: true,
      easing: "easeInOutSine",
    });
  }, []);

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 pointer-events-none overflow-hidden z-0 mesh-grid"
      aria-hidden="true"
    >
      {/* Dynamic colorful gradient orbs */}
      <div className="anime-orb-1 absolute -top-24 left-1/6 w-96 h-96 rounded-full bg-gradient-to-tr from-cyan-500/20 via-blue-600/25 to-indigo-600/20 blur-3xl" />
      <div className="anime-orb-2 absolute top-1/3 -right-20 w-[30rem] h-[30rem] rounded-full bg-gradient-to-tr from-purple-600/25 via-pink-600/20 to-rose-500/15 blur-3xl" />
      <div className="anime-orb-3 absolute -bottom-32 left-1/4 w-[34rem] h-[34rem] rounded-full bg-gradient-to-tr from-emerald-500/15 via-teal-600/20 to-indigo-700/20 blur-3xl" />

      {/* Geometric floating particles */}
      <div className="absolute inset-0 flex justify-around items-center opacity-40">
        {[...Array(12)].map((_, i) => (
          <div
            key={i}
            className="anime-particle absolute w-2 h-2 rounded-full"
            style={{
              top: `${(i * 19) % 95}%`,
              left: `${(i * 27) % 92}%`,
              backgroundColor:
                i % 4 === 0
                  ? "#06b6d4"
                  : i % 4 === 1
                  ? "#8b5cf6"
                  : i % 4 === 2
                  ? "#ec4899"
                  : "#10b981",
              boxShadow: `0 0 12px ${
                i % 4 === 0
                  ? "#06b6d4"
                  : i % 4 === 1
                  ? "#8b5cf6"
                  : i % 4 === 2
                  ? "#ec4899"
                  : "#10b981"
              }`,
            }}
          />
        ))}
      </div>
    </div>
  );
}
