"use client";

import { useRef, ReactNode, ButtonHTMLAttributes } from "react";
import anime from "animejs";

interface AnimeButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  variant?: "primary" | "secondary" | "danger" | "emerald" | "ghost";
  size?: "sm" | "md" | "lg";
  className?: string;
  glow?: boolean;
}

export function AnimeButton({
  children,
  variant = "primary",
  size = "md",
  className = "",
  glow = true,
  onClick,
  disabled,
  ...props
}: AnimeButtonProps) {
  const btnRef = useRef<HTMLButtonElement>(null);

  const handleMouseEnter = () => {
    if (disabled || !btnRef.current) return;
    anime({
      targets: btnRef.current,
      scale: 1.04,
      duration: 250,
      easing: "easeOutQuad",
    });
  };

  const handleMouseLeave = () => {
    if (disabled || !btnRef.current) return;
    anime({
      targets: btnRef.current,
      scale: 1.0,
      duration: 300,
      easing: "easeOutElastic(1, .6)",
    });
  };

  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (disabled || !btnRef.current) return;

    // Elastic tap rebound
    anime({
      targets: btnRef.current,
      scale: [
        { value: 0.94, duration: 80, easing: "easeOutQuad" },
        { value: 1.04, duration: 200, easing: "easeOutElastic(1, .5)" },
      ],
    });

    if (onClick) onClick(e);
  };

  const baseStyles =
    "relative inline-flex items-center justify-center font-bold tracking-tight transition-all duration-200 rounded-full cursor-pointer select-none overflow-hidden disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none";

  const sizeStyles =
    size === "sm"
      ? "px-4 py-2 text-xs gap-1.5"
      : size === "lg"
      ? "px-8 py-4 text-base gap-2.5 shadow-xl"
      : "px-6 py-3 text-sm gap-2 shadow-md";

  const variantStyles =
    variant === "primary"
      ? glow
        ? "glow-btn-primary text-white"
        : "bg-indigo-600 hover:bg-indigo-700 text-white"
      : variant === "secondary"
      ? "bg-slate-800/80 hover:bg-slate-700 text-slate-100 border border-slate-700/60 backdrop-blur-md"
      : variant === "danger"
      ? "bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-700 hover:to-rose-700 text-white shadow-rose-900/30"
      : variant === "emerald"
      ? "bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white shadow-emerald-900/30"
      : "bg-transparent hover:bg-white/10 text-slate-200";

  return (
    <button
      ref={btnRef}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onClick={handleClick}
      disabled={disabled}
      className={`${baseStyles} ${sizeStyles} ${variantStyles} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
