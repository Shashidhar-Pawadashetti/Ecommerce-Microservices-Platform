"use client";

import { useEffect, useRef } from "react";
import anime from "animejs";

interface AnimeTextProps {
  text: string;
  className?: string;
  delay?: number;
  as?: "h1" | "h2" | "h3" | "h4" | "p" | "span";
  gradient?: "neon" | "amber" | "emerald" | "none";
}

export function AnimeText({
  text,
  className = "",
  delay = 100,
  as: Component = "h1",
  gradient = "neon",
}: AnimeTextProps) {
  const containerRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const letters = containerRef.current.querySelectorAll(".anime-letter");

    anime({
      targets: letters,
      translateY: ["100%", "0%"],
      opacity: [0, 1],
      scale: [0.8, 1],
      rotateZ: () => anime.random(-8, 8),
      duration: 800,
      delay: anime.stagger(30, { start: delay }),
      easing: "easeOutElastic(1, .8)",
    });
  }, [text, delay]);

  const words = text.split(" ");

  const gradientClass =
    gradient === "neon"
      ? "neon-text-gradient"
      : gradient === "amber"
      ? "amber-neon-gradient"
      : gradient === "emerald"
      ? "emerald-neon-gradient"
      : "";

  return (
    <Component
      ref={containerRef as any}
      className={`inline-block overflow-hidden ${gradientClass} ${className}`}
    >
      {words.map((word, wordIdx) => (
        <span key={wordIdx} className="inline-block whitespace-nowrap mr-2">
          {word.split("").map((char, charIdx) => (
            <span
              key={charIdx}
              className="anime-letter inline-block opacity-0 transform"
            >
              {char}
            </span>
          ))}
        </span>
      ))}
    </Component>
  );
}
