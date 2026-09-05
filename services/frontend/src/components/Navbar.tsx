"use client";

import Link from "next/link";
import { ShoppingCart, Package2, LogOut, Package, Sparkles } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import anime from "animejs";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Cart, User as UserType } from "@/types";

export function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const queryClient = useQueryClient();
  const cartBadgeRef = useRef<HTMLSpanElement>(null);

  // Query authenticated user profile
  const { data: user } = useQuery<UserType>({
    queryKey: ["auth-user"],
    queryFn: async () => {
      const res = await fetch("/api/gateway/auth/me");
      if (!res.ok) return null;
      return res.json();
    },
    retry: false,
  });

  // Query live cart to display accurate item count badge
  const { data: cart } = useQuery<Cart>({
    queryKey: ["cart"],
    queryFn: async () => {
      const res = await fetch("/api/gateway/cart");
      if (!res.ok) return null;
      return res.json();
    },
    retry: false,
  });

  const cartItemCount =
    cart?.items?.reduce((acc, item) => acc + (item.quantity || 1), 0) || 0;

  // Anime.js bounce animation on cart count update
  useEffect(() => {
    if (cartBadgeRef.current && cartItemCount > 0) {
      anime({
        targets: cartBadgeRef.current,
        scale: [
          { value: 0.5, duration: 0 },
          { value: 1.4, duration: 180, easing: "easeOutQuad" },
          { value: 1.0, duration: 300, easing: "easeOutElastic(1, .5)" },
        ],
      });
    }
  }, [cartItemCount]);

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    queryClient.setQueryData(["auth-user"], null);
    queryClient.setQueryData(["cart"], null);
    queryClient.invalidateQueries();
    router.push("/");
  };

  return (
    <header className="sticky top-0 z-50 w-full border-b border-white/[0.06] bg-[#090d16]/75 backdrop-blur-xl transition-all">
      <div className="container mx-auto flex h-16 items-center justify-between px-4 md:px-6">
        {/* Brand Logo with Neon Glow */}
        <Link href="/" className="group flex items-center gap-2.5 transition-transform hover:scale-105">
          <div className="p-2 rounded-xl bg-gradient-to-tr from-indigo-500 to-pink-500 shadow-md shadow-indigo-500/20 group-hover:shadow-indigo-500/40 transition-shadow">
            <Package2 className="h-5 w-5 text-white" />
          </div>
          <span className="text-xl font-black tracking-tight text-white flex items-center gap-1">
            Eco<span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-pink-500">Micro</span>
          </span>
        </Link>

        {/* Navigation Links with Glass Pill Styling */}
        <nav className="hidden md:flex items-center gap-1.5 p-1 rounded-full glass-panel border border-white/5 text-sm font-medium">
          <Link
            href="/"
            className={`px-4 py-1.5 rounded-full transition-all duration-200 ${
              pathname === "/"
                ? "bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-sm font-semibold"
                : "text-slate-300 hover:text-white hover:bg-white/5"
            }`}
          >
            Catalog
          </Link>

          {user && (
            <Link
              href="/orders"
              className={`px-4 py-1.5 rounded-full transition-all duration-200 ${
                pathname === "/orders"
                  ? "bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-sm font-semibold"
                  : "text-slate-300 hover:text-white hover:bg-white/5"
              }`}
            >
              My Orders
            </Link>
          )}
        </nav>

        {/* User Session & Cart */}
        <div className="flex items-center gap-3 md:gap-4">
          <Link
            href="/cart"
            className="relative p-2.5 text-slate-300 hover:text-white transition-colors rounded-full hover:bg-white/5 border border-white/5"
            title="Shopping Cart"
          >
            <ShoppingCart className="h-5 w-5" />
            {cartItemCount > 0 && (
              <span
                ref={cartBadgeRef}
                className="absolute -top-1 -right-1 flex h-5 min-w-[1.25rem] px-1.5 items-center justify-center rounded-full bg-gradient-to-r from-pink-500 to-rose-500 text-[11px] font-black text-white shadow-md shadow-pink-500/30"
              >
                {cartItemCount}
              </span>
            )}
          </Link>

          {user ? (
            <div className="flex items-center gap-3 border-l border-slate-800 pl-3 md:pl-4">
              <Link
                href="/profile"
                className="flex items-center gap-2 text-xs font-semibold px-3 py-1.5 rounded-full bg-slate-800/80 hover:bg-slate-800 text-slate-200 border border-slate-700/60 transition-colors"
              >
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span className="max-w-[120px] truncate">{user.email}</span>
              </Link>
              <Link
                href="/orders"
                className="hidden sm:inline text-xs font-bold text-slate-300 hover:text-white px-2 py-1 transition-colors"
              >
                Orders
              </Link>
              <button
                onClick={handleLogout}
                className="p-2 text-slate-400 hover:text-rose-400 transition-colors rounded-full hover:bg-rose-500/10 cursor-pointer"
                title="Log out"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2 border-l border-slate-800 pl-3 md:pl-4">
              <Link
                href="/login"
                className="text-xs font-bold text-slate-300 hover:text-white px-3 py-2 transition-colors"
              >
                Log in
              </Link>
              <Link
                href="/signup"
                className="glow-btn-primary px-4 py-2 rounded-full text-xs font-bold text-white shadow-lg shadow-indigo-600/20"
              >
                Sign up
              </Link>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
