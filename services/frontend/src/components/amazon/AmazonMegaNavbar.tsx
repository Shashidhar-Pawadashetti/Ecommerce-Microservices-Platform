"use client";

import Link from "next/link";
import { useState, useRef, useEffect } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import {
  MapPin,
  Search,
  ShoppingCart,
  User,
  LogOut,
  Package,
  Menu,
  ChevronDown,
  Sparkles,
  X,
  Clock,
  Heart,
  HelpCircle,
  Flame,
  Gift,
  Check,
  Package2,
} from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Cart, User as UserType } from "@/types";
import { useStore } from "@/providers/StoreContext";
import anime from "animejs";

const SEARCH_CATEGORIES = [
  { id: "", label: "All Departments" },
  { id: "electronics", label: "Electronics" },
  { id: "clothing", label: "Apparel & Fashion" },
  { id: "books", label: "Books & Audible" },
  { id: "accessories", label: "Audio & Accessories" },
];

export function AmazonMegaNavbar() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const { location, setLocation, savedForLater, searchCategory, setSearchCategory } = useStore();

  const [searchTerm, setSearchTerm] = useState(searchParams.get("q") || "");
  const [selectedCat, setSelectedCat] = useState(searchCategory || "");
  const [isLocationModalOpen, setIsLocationModalOpen] = useState(false);
  const [tempZip, setTempZip] = useState(location.zipCode);
  const [tempCity, setTempCity] = useState(location.city);
  const [isAccountOpen, setIsAccountOpen] = useState(false);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isSearchFocused, setIsSearchFocused] = useState(false);

  const cartBadgeRef = useRef<HTMLSpanElement>(null);
  const accountRef = useRef<HTMLDivElement>(null);

  // Query authenticated user
  const { data: user } = useQuery<UserType>({
    queryKey: ["auth-user"],
    queryFn: async () => {
      const res = await fetch("/api/gateway/auth/me");
      if (!res.ok) return null;
      return res.json();
    },
    retry: false,
  });

  // Query live cart
  const { data: cart } = useQuery<Cart>({
    queryKey: ["cart"],
    queryFn: async () => {
      const res = await fetch("/api/gateway/cart");
      if (!res.ok) return null;
      return res.json();
    },
    retry: false,
  });

  const cartCount =
    cart?.items?.reduce((acc, item) => acc + (item.quantity || 1), 0) || 0;

  // Cart badge bounce animation
  useEffect(() => {
    if (cartBadgeRef.current && cartCount > 0) {
      anime({
        targets: cartBadgeRef.current,
        scale: [
          { value: 0.5, duration: 0 },
          { value: 1.4, duration: 180, easing: "easeOutQuad" },
          { value: 1.0, duration: 300, easing: "easeOutElastic(1, .5)" },
        ],
      });
    }
  }, [cartCount]);

  // Click outside listener for Account dropdown
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (accountRef.current && !accountRef.current.contains(e.target as Node)) {
        setIsAccountOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const params = new URLSearchParams();
    if (searchTerm.trim()) params.set("q", searchTerm.trim());
    if (selectedCat) params.set("category", selectedCat);
    setSearchCategory(selectedCat);
    router.push(`/?${params.toString()}`);
  };

  const handleSaveLocation = (e: React.FormEvent) => {
    e.preventDefault();
    setLocation({
      city: tempCity || "Seattle",
      zipCode: tempZip || "98101",
      country: "US",
    });
    setIsLocationModalOpen(false);
  };

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    queryClient.setQueryData(["auth-user"], null);
    queryClient.setQueryData(["cart"], null);
    queryClient.invalidateQueries();
    setIsAccountOpen(false);
    router.push("/");
  };

  return (
    <header className="sticky top-0 z-40 w-full bg-[#0d131f] text-white border-b border-white/[0.08] shadow-xl">
      {/* ── TOP MAIN BAR ── */}
      <div className="container mx-auto px-3 sm:px-4 py-2.5 flex items-center justify-between gap-2 md:gap-4">
        {/* Logo */}
        <Link
          href="/"
          className="group flex items-center gap-2 px-2 py-1 rounded-xl hover:ring-1 hover:ring-white/20 transition-all shrink-0"
        >
          <div className="p-1.5 rounded-lg bg-gradient-to-tr from-amber-500 via-orange-500 to-pink-500 shadow-md">
            <Package2 className="h-5 w-5 text-white" />
          </div>
          <div className="flex flex-col">
            <span className="text-xl font-black tracking-tight leading-none text-white">
              Eco<span className="text-amber-400">Prime</span>
            </span>
            <span className="text-[9px] font-mono tracking-wider text-slate-400 font-bold">
              .microservices
            </span>
          </div>
        </Link>

        {/* Deliver to Location selector */}
        <button
          onClick={() => setIsLocationModalOpen(true)}
          className="hidden lg:flex items-center gap-2 px-2.5 py-1.5 rounded-xl hover:ring-1 hover:ring-white/20 transition-all text-left cursor-pointer shrink-0"
        >
          <MapPin className="h-4 w-4 text-slate-400 shrink-0" />
          <div className="flex flex-col leading-tight">
            <span className="text-[11px] text-slate-400">Deliver to {location.city}</span>
            <span className="text-xs font-bold text-white tracking-tight flex items-center gap-1">
              {location.zipCode} <ChevronDown className="h-3 w-3 text-slate-400" />
            </span>
          </div>
        </button>

        {/* Amazon-Style Integrated Search Bar */}
        <form
          onSubmit={handleSearchSubmit}
          className={`flex-1 max-w-2xl flex items-center rounded-2xl overflow-hidden transition-all duration-200 border ${
            isSearchFocused
              ? "ring-2 ring-amber-400 border-amber-400 shadow-lg shadow-amber-500/10"
              : "border-white/10 bg-slate-900/90"
          }`}
        >
          {/* Category Dropdown */}
          <select
            value={selectedCat}
            onChange={(e) => setSelectedCat(e.target.value)}
            className="bg-slate-800 text-slate-300 text-xs font-semibold px-3 py-2.5 border-r border-white/10 focus:outline-none cursor-pointer hidden sm:block max-w-[130px] truncate"
          >
            {SEARCH_CATEGORIES.map((cat) => (
              <option key={cat.id} value={cat.id} className="bg-slate-900 text-white">
                {cat.label}
              </option>
            ))}
          </select>

          {/* Search Input */}
          <input
            type="text"
            placeholder="Search EcoPrime or microservices..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onFocus={() => setIsSearchFocused(true)}
            onBlur={() => setIsSearchFocused(false)}
            className="flex-1 px-3 py-2.5 bg-transparent text-white placeholder-slate-400 text-xs sm:text-sm focus:outline-none min-w-0"
          />

          {searchTerm && (
            <button
              type="button"
              onClick={() => setSearchTerm("")}
              className="p-1 text-slate-400 hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>
          )}

          {/* Search Submit Button */}
          <button
            type="submit"
            className="bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-bold px-4 py-2.5 transition-colors cursor-pointer flex items-center justify-center shrink-0"
            title="Search"
          >
            <Search className="h-4 w-4 stroke-[2.5]" />
          </button>
        </form>

        {/* Right Section: Account, Orders, Cart */}
        <div className="flex items-center gap-1 sm:gap-2 shrink-0">
          {/* Account & Lists Menu */}
          <div ref={accountRef} className="relative">
            <button
              onClick={() => setIsAccountOpen(!isAccountOpen)}
              className="flex flex-col px-2.5 py-1.5 rounded-xl hover:ring-1 hover:ring-white/20 transition-all text-left cursor-pointer"
            >
              <span className="text-[11px] text-slate-400 leading-tight">
                Hello, {user ? user.email.split("@")[0] : "Sign in"}
              </span>
              <span className="text-xs font-bold text-white tracking-tight flex items-center gap-1">
                Account & Lists <ChevronDown className="h-3 w-3 text-slate-400" />
              </span>
            </button>

            {/* Account Flyout Dropdown */}
            {isAccountOpen && (
              <div className="absolute right-0 top-full mt-2 w-72 glass-panel bg-slate-900/98 border border-white/10 rounded-3xl p-5 shadow-2xl z-50 backdrop-blur-2xl">
                {!user ? (
                  <div className="text-center pb-4 border-b border-white/10">
                    <Link
                      href="/login"
                      onClick={() => setIsAccountOpen(false)}
                      className="block w-full py-2.5 rounded-full bg-gradient-to-r from-amber-500 to-orange-500 text-slate-950 font-bold text-xs shadow-md hover:brightness-110 mb-2.5"
                    >
                      Sign In
                    </Link>
                    <p className="text-[11px] text-slate-400">
                      New customer?{" "}
                      <Link
                        href="/signup"
                        onClick={() => setIsAccountOpen(false)}
                        className="text-amber-400 font-bold hover:underline"
                      >
                        Start here.
                      </Link>
                    </p>
                  </div>
                ) : (
                  <div className="pb-3 border-b border-white/10">
                    <p className="text-xs font-bold text-white truncate">{user.email}</p>
                    <p className="text-[10px] text-emerald-400 font-semibold flex items-center gap-1 mt-0.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                      Active Session Verified
                    </p>
                  </div>
                )}

                <div className="py-3 space-y-1 text-xs">
                  <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider px-2 mb-1">
                    Your Account
                  </p>
                  <Link
                    href="/orders"
                    onClick={() => setIsAccountOpen(false)}
                    className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-slate-200 hover:text-white hover:bg-white/5 transition-colors font-medium"
                  >
                    <Package className="h-4 w-4 text-amber-400" />
                    <span>Your Orders & Purchases</span>
                  </Link>
                  <Link
                    href="/cart"
                    onClick={() => setIsAccountOpen(false)}
                    className="flex items-center justify-between px-3 py-2 rounded-xl text-slate-200 hover:text-white hover:bg-white/5 transition-colors font-medium"
                  >
                    <div className="flex items-center gap-2.5">
                      <Heart className="h-4 w-4 text-pink-400" />
                      <span>Saved for Later</span>
                    </div>
                    {savedForLater.length > 0 && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-slate-800 text-slate-300 font-bold">
                        {savedForLater.length}
                      </span>
                    )}
                  </Link>
                </div>

                {user && (
                  <div className="pt-2 border-t border-white/10">
                    <button
                      onClick={handleLogout}
                      className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-rose-400 hover:bg-rose-500/10 text-xs font-bold transition-colors cursor-pointer"
                    >
                      <LogOut className="h-4 w-4" />
                      <span>Sign Out</span>
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Returns & Orders Shortcut */}
          <Link
            href="/orders"
            className="hidden sm:flex flex-col px-2.5 py-1.5 rounded-xl hover:ring-1 hover:ring-white/20 transition-all text-left"
          >
            <span className="text-[11px] text-slate-400 leading-tight">Returns</span>
            <span className="text-xs font-bold text-white tracking-tight">& Orders</span>
          </Link>

          {/* Shopping Cart with dynamic counter */}
          <Link
            href="/cart"
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl hover:ring-1 hover:ring-white/20 transition-all relative cursor-pointer"
          >
            <div className="relative">
              <ShoppingCart className="h-6 w-6 text-white" />
              <span
                ref={cartBadgeRef}
                className="absolute -top-1.5 -right-2 flex h-5 min-w-[1.25rem] px-1 items-center justify-center rounded-full bg-amber-500 text-slate-950 text-[11px] font-black shadow-md"
              >
                {cartCount}
              </span>
            </div>
            <span className="hidden md:inline font-bold text-xs text-white">Cart</span>
          </Link>
        </div>
      </div>

      {/* ── LOWER SUB-NAVBAR (Amazon Style) ── */}
      <div className="bg-[#131a28] px-3 sm:px-4 py-1.5 text-xs font-medium text-slate-300 border-t border-white/5 flex items-center gap-2 sm:gap-4 overflow-x-auto no-scrollbar">
        <button
          onClick={() => {
            const el = document.getElementById("catalog-section");
            if (el) el.scrollIntoView({ behavior: "smooth" });
          }}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg hover:bg-white/10 text-white font-bold shrink-0 cursor-pointer"
        >
          <Menu className="h-4 w-4" /> All Categories
        </button>

        <Link
          href="/?deal=true"
          className="flex items-center gap-1 px-2.5 py-1 rounded-lg hover:bg-white/10 hover:text-amber-400 transition-colors shrink-0 text-amber-300 font-semibold"
        >
          <Flame className="h-3.5 w-3.5 fill-amber-400/20 text-amber-400" /> Today&apos;s Deals
        </Link>

        <Link
          href="/"
          className="px-2.5 py-1 rounded-lg hover:bg-white/10 hover:text-white transition-colors shrink-0"
        >
          Best Sellers
        </Link>

        <Link
          href="/orders"
          className="px-2.5 py-1 rounded-lg hover:bg-white/10 hover:text-white transition-colors shrink-0"
        >
          Track Shipments
        </Link>

        <Link
          href="/cart"
          className="px-2.5 py-1 rounded-lg hover:bg-white/10 hover:text-white transition-colors shrink-0"
        >
          Saved Items ({savedForLater.length})
        </Link>

        <div className="ml-auto hidden lg:flex items-center gap-2 text-slate-400 text-[11px]">
          <span className="w-2 h-2 rounded-full bg-emerald-400" />
          <span>KRaft Microservices Cluster Active</span>
        </div>
      </div>

      {/* ── LOCATION SELECTOR MODAL ── */}
      {isLocationModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="glass-panel bg-slate-900 border border-white/10 rounded-3xl p-6 max-w-md w-full shadow-2xl">
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-white/10">
              <div className="flex items-center gap-2">
                <MapPin className="h-5 w-5 text-amber-400" />
                <h3 className="font-bold text-base text-white">Choose your location</h3>
              </div>
              <button
                onClick={() => setIsLocationModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-full hover:bg-white/10"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <p className="text-xs text-slate-400 mb-5">
              Delivery options and speeds vary based on destination. Enter your city and postal code for real-time Prime estimates.
            </p>

            <form onSubmit={handleSaveLocation} className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase text-slate-400 mb-1">
                  City / Destination
                </label>
                <input
                  type="text"
                  value={tempCity}
                  onChange={(e) => setTempCity(e.target.value)}
                  placeholder="e.g. Seattle, San Francisco, New York"
                  className="w-full px-4 py-2.5 rounded-2xl bg-slate-800 border border-white/10 text-white text-sm focus:ring-2 focus:ring-amber-400 focus:outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-slate-400 mb-1">
                  ZIP / Postal Code
                </label>
                <input
                  type="text"
                  value={tempZip}
                  onChange={(e) => setTempZip(e.target.value)}
                  placeholder="e.g. 98101"
                  className="w-full px-4 py-2.5 rounded-2xl bg-slate-800 border border-white/10 text-white text-sm focus:ring-2 focus:ring-amber-400 focus:outline-none"
                  required
                />
              </div>

              <div className="flex gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setIsLocationModalOpen(false)}
                  className="flex-1 py-2.5 rounded-full bg-slate-800 text-slate-300 font-bold text-xs hover:bg-slate-700 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-full bg-gradient-to-r from-amber-500 to-orange-500 text-slate-950 font-bold text-xs hover:brightness-110 transition-all shadow-md shadow-amber-500/20"
                >
                  Apply Location
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </header>
  );
}
