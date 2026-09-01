"use client";

import { useEffect, useRef, ReactNode } from "react";
import anime from "animejs";

interface PageWrapperProps {
  children: ReactNode;
  className?: string;
  title?: string;
  badge?: string;
  description?: string;
}

export function PageWrapper({
  children,
  className = "",
  title,
  badge,
  description,
}: PageWrapperProps) {
  const pageRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!pageRef.current) return;

    // Page entrance animation with anime.js
    anime({
      targets: pageRef.current,
      opacity: [0, 1],
      translateY: [20, 0],
      duration: 600,
      easing: "easeOutCubic",
    });

    const header = pageRef.current.querySelector(".anime-page-header");
    if (header) {
      anime({
        targets: header,
        opacity: [0, 1],
        translateY: [-15, 0],
        duration: 500,
        easing: "easeOutQuad",
      });
    }
  }, []);

  return (
    <div ref={pageRef} className={`relative z-10 opacity-0 ${className}`}>
      {(badge || title || description) && (
        <div className="anime-page-header mb-8 opacity-0">
          {badge && (
            <span className="inline-block px-3 py-1 text-xs font-bold tracking-wider uppercase rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 mb-3">
              {badge}
            </span>
          )}
          {title && (
            <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-white mb-2">
              {title}
            </h1>
          )}
          {description && (
            <p className="text-slate-400 text-sm sm:text-base max-w-2xl">
              {description}
            </p>
          )}
        </div>
      )}
      {children}
    </div>
  );
}
