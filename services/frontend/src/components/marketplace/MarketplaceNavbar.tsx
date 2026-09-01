"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Search,
  ShoppingCart,
  MapPin,
  ChevronDown,
  User,
  Menu,
  X,
  Package,
  Sparkles,
  Zap,
  Flame,
  Clock,
  LogOut,
} from "lucide-react";
import { Cart, User as UserType } from "@/types";
import { useStore } from "@/providers/StoreContext";

const DEPARTMENTS = [
  { id: "", label: "All Departments" },
  { id: "electronics", label: "Electronics" },
  { id: "clothing", label: "Apparel & Style" },
  { id: "books", label: "Books & Research" },
  { id: "accessories", label: "Audio & Hardware" },
];

export function MarketplaceNavbar() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const { location, setLocation, searchCategory, setSearchCategory, userProfile, setUserProfile } = useStore();

  const [searchQuery, setSearchQuery] = useState(searchParams.get("q") || "");
  const [selectedDept, setSelectedDept] = useState(searchParams.get("category") || searchCategory || "");
  const [isAccountOpen, setIsAccountOpen] = useState(false);
  const [isLocationModalOpen, setIsLocationModalOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Deliver To edit state
  const [tempCity, setTempCity] = useState(location.city);
  const [tempZip, setTempZip] = useState(location.zipCode);

  const accountRef = useRef<HTMLDivElement>(null);

  // Query authenticated user profile
  const { data: authUser } = useQuery<UserType | null>({
    queryKey: ["auth-user"],
    queryFn: async () => {
      const res = await fetch("/api/gateway/auth/me");
      if (!res.ok) return null;
      return res.json();
    },
    retry: false,
  });

  const isLoggedIn = !!authUser;

  // Fetch Cart for Live Badge Count
  const { data: cart } = useQuery<Cart>({
    queryKey: ["cart"],
    queryFn: async () => {
      const res = await fetch("/api/gateway/cart");
      if (!res.ok) return null;
      return res.json();
    },
    refetchInterval: 5000,
    retry: false,
  });

  const cartItemCount =
    cart?.items?.reduce((acc, item) => acc + (item.quantity || 1), 0) || 0;

  // Handle Search Submission
  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const params = new URLSearchParams();
    if (searchQuery.trim()) params.set("q", searchQuery.trim());
    if (selectedDept) params.set("category", selectedDept);
    router.push(`/?${params.toString()}`);
  };

  // Close account flyout on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (accountRef.current && !accountRef.current.contains(event.target as Node)) {
        setIsAccountOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSaveLocation = (e: React.FormEvent) => {
    e.preventDefault();
    setLocation({
      city: tempCity || "Seattle",
      zipCode: tempZip || "98101",
      country: "United States",
    });
    setIsLocationModalOpen(false);
  };

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    setUserProfile(null);
    queryClient.setQueryData(["auth-user"], null);
    queryClient.setQueryData(["cart"], null);
    queryClient.invalidateQueries();
    setIsAccountOpen(false);
    router.push("/login");
    router.refresh();
  };

  return (
    <header className="w-full bg-[#0b101b] border-b border-white/[0.08] sticky top-0 z-40 shadow-2xl backdrop-blur-md">
      {/* ── TOP UTILITY & SEARCH BAR ── */}
      <div className="container mx-auto px-4 py-2.5 flex items-center justify-between gap-3 md:gap-6">
        {/* Brand Logo */}
        <Link href="/" className="flex items-center gap-2 shrink-0 group">
          <div className="p-2 rounded-xl bg-gradient-to-tr from-cyan-500 via-indigo-500 to-pink-500 text-white shadow-lg shadow-cyan-500/20 group-hover:scale-105 transition-all">
            <Package className="h-5 w-5" />
          </div>
          <div className="flex flex-col">
            <span className="font-black text-xl tracking-tight text-white flex items-center">
              NEX<span className="text-cyan-400">ORA</span>
            </span>
            <span className="text-[9px] uppercase tracking-widest font-bold text-slate-400 -mt-1">
              Cloud Commerce
            </span>
          </div>
        </Link>

        {/* Deliver-To Location Trigger */}
        <button
          onClick={() => setIsLocationModalOpen(true)}
          className="hidden sm:flex items-center gap-2 p-1.5 rounded-xl border border-transparent hover:border-white/10 hover:bg-white/5 transition-all text-left cursor-pointer shrink-0"
        >
          <MapPin className="h-4 w-4 text-cyan-400 shrink-0" />
          <div className="flex flex-col">
            <span className="text-[10px] text-slate-400 font-medium leading-none">Deliver to</span>
            <span className="text-xs font-bold text-white leading-tight truncate max-w-[110px]">
              {location.city} {location.zipCode}
            </span>
          </div>
        </button>

        {/* Integrated Department Search Bar */}
        <form onSubmit={handleSearch} className="flex-1 max-w-3xl hidden md:flex items-center">
          <div className="relative flex w-full rounded-2xl overflow-hidden shadow-inner border border-white/10 focus-within:border-cyan-400 focus-within:ring-2 focus-within:ring-cyan-400/30 transition-all bg-slate-900/90">
            {/* Department Dropdown */}
            <select
              value={selectedDept}
              onChange={(e) => {
                setSelectedDept(e.target.value);
                setSearchCategory(e.target.value);
              }}
              className="bg-slate-800 text-slate-300 text-xs font-bold px-3 py-2 border-r border-white/10 focus:outline-none cursor-pointer hover:bg-slate-700"
            >
              {DEPARTMENTS.map((dept) => (
                <option key={dept.id} value={dept.id}>
                  {dept.label}
                </option>
              ))}
            </select>

            {/* Main Input */}
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search products, microservice hardware, telemetry..."
              className="w-full bg-transparent px-4 py-2 text-xs text-white placeholder-slate-400 focus:outline-none font-medium"
            />

            {/* Clear Button */}
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="px-2 text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}

            {/* Search Submit */}
            <button
              type="submit"
              className="bg-gradient-to-r from-cyan-500 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-slate-950 px-5 flex items-center justify-center transition-all cursor-pointer"
            >
              <Search className="h-4 w-4 text-slate-950 font-bold" />
            </button>
          </div>
        </form>

        {/* Right Navigation & Flyouts */}
        <div className="flex items-center gap-2 sm:gap-4 shrink-0">
          {/* Account & Lists Menu */}
          <div className="relative" ref={accountRef}>
            <button
              onClick={() => setIsAccountOpen(!isAccountOpen)}
              className="flex items-center gap-1.5 p-2 rounded-xl border border-transparent hover:border-white/10 hover:bg-white/5 transition-all text-left cursor-pointer"
            >
              <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-cyan-500 to-indigo-600 flex items-center justify-center text-slate-950 font-bold text-xs shadow-md">
                {isLoggedIn && userProfile?.fullName ? (
                  userProfile.fullName[0].toUpperCase()
                ) : (
                  <User className="h-4 w-4" />
                )}
              </div>
              <div className="hidden lg:flex flex-col">
                <span className="text-[10px] text-slate-400 leading-none">
                  {isLoggedIn
                    ? `Hello, ${userProfile?.fullName ? userProfile.fullName.split(" ")[0] : (authUser?.email?.split("@")[0] || "Shopper")}`
                    : "Hello, Sign in"}
                </span>
                <span className="text-xs font-bold text-white flex items-center gap-0.5 leading-tight">
                  Account & Lists <ChevronDown className="h-3 w-3" />
                </span>
              </div>
            </button>

            {/* Account Flyout Card */}
            {isAccountOpen && (
              <div className="absolute right-0 mt-2 w-64 glass-panel bg-slate-900 border border-white/10 rounded-2xl p-4 shadow-2xl z-50 text-xs animate-in fade-in zoom-in-95">
                {isLoggedIn ? (
                  // ── LOGGED IN FLYOUT ──
                  <>
                    <div className="pb-3 border-b border-white/10">
                      <div className="flex items-center justify-between">
                        <p className="font-bold text-white text-sm truncate max-w-[170px]">
                          {userProfile?.fullName || "Your Nexora Account"}
                        </p>
                        <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                          Active Session
                        </span>
                      </div>
                      <p className="text-slate-400 text-[11px] truncate">
                        {userProfile?.email || authUser?.email || "Authenticated JWT Session"}
                      </p>
                    </div>

                    <div className="py-2 space-y-1">
                      <Link
                        href="/orders"
                        onClick={() => setIsAccountOpen(false)}
                        className="flex items-center gap-2 p-2 rounded-xl hover:bg-white/5 text-slate-200 font-semibold transition-colors"
                      >
                        <Package className="h-4 w-4 text-cyan-400" />
                        <span>Your Orders & Shipments</span>
                      </Link>
                      <Link
                        href="/cart"
                        onClick={() => setIsAccountOpen(false)}
                        className="flex items-center gap-2 p-2 rounded-xl hover:bg-white/5 text-slate-200 font-semibold transition-colors"
                      >
                        <ShoppingCart className="h-4 w-4 text-emerald-400" />
                        <span>Saved for Later & Cart</span>
                      </Link>
                    </div>

                    {/* ONLY SHOW SIGN OUT WHEN LOGGED IN */}
                    <div className="pt-2 border-t border-white/10">
                      <button
                        onClick={handleLogout}
                        className="w-full flex items-center gap-2 p-2 rounded-xl hover:bg-rose-500/10 text-rose-400 font-bold transition-colors cursor-pointer"
                      >
                        <LogOut className="h-4 w-4" />
                        <span>Sign Out</span>
                      </button>
                    </div>
                  </>
                ) : (
                  // ── NOT LOGGED IN FLYOUT ──
                  <>
                    <div className="pb-3 border-b border-white/10 text-center">
                      <Link
                        href="/login"
                        onClick={() => setIsAccountOpen(false)}
                        className="block w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-cyan-500 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-slate-950 font-bold text-xs text-center shadow-lg transition-all"
                      >
                        Sign in to your account
                      </Link>
                      <p className="text-[11px] text-slate-400 mt-2">
                        New customer?{" "}
                        <Link
                          href="/signup"
                          onClick={() => setIsAccountOpen(false)}
                          className="text-cyan-400 font-bold underline hover:text-cyan-300"
                        >
                          Start here.
                        </Link>
                      </p>
                    </div>

                    <div className="py-2 space-y-1">
                      <Link
                        href="/orders"
                        onClick={() => setIsAccountOpen(false)}
                        className="flex items-center gap-2 p-2 rounded-xl hover:bg-white/5 text-slate-200 font-semibold transition-colors"
                      >
                        <Package className="h-4 w-4 text-cyan-400" />
                        <span>Your Orders & Shipments</span>
                      </Link>
                      <Link
                        href="/cart"
                        onClick={() => setIsAccountOpen(false)}
                        className="flex items-center gap-2 p-2 rounded-xl hover:bg-white/5 text-slate-200 font-semibold transition-colors"
                      >
                        <ShoppingCart className="h-4 w-4 text-emerald-400" />
                        <span>Saved for Later & Cart</span>
                      </Link>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>

          {/* Returns & Orders Shortcut */}
          <Link
            href="/orders"
            className="hidden sm:flex flex-col p-2 rounded-xl border border-transparent hover:border-white/10 hover:bg-white/5 transition-all text-left"
          >
            <span className="text-[10px] text-slate-400 leading-none">Returns</span>
            <span className="text-xs font-bold text-white leading-tight">& Orders</span>
          </Link>

          {/* Cart with Live Pulse Badge */}
          <Link
            href="/cart"
            className="flex items-center gap-2 p-2 rounded-xl bg-gradient-to-r from-cyan-500/10 to-indigo-500/10 border border-cyan-500/30 hover:border-cyan-400 transition-all group"
          >
            <div className="relative">
              <ShoppingCart className="h-5 w-5 text-cyan-400 group-hover:scale-110 transition-transform" />
              {cartItemCount > 0 && (
                <span className="absolute -top-2 -right-2 bg-gradient-to-r from-pink-500 to-rose-500 text-white font-black text-[10px] rounded-full h-5 min-w-[20px] px-1 flex items-center justify-center shadow-lg animate-pulse">
                  {cartItemCount}
                </span>
              )}
            </div>
            <span className="font-bold text-xs text-white hidden sm:inline">Cart</span>
          </Link>

          {/* Mobile Menu Toggle */}
          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="p-2 md:hidden rounded-xl border border-white/10 text-slate-300 hover:text-white cursor-pointer"
          >
            {isMobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {/* ── LOWER SUB-NAVBAR ── */}
      <div className="bg-[#0e1524] px-4 py-2 text-xs border-t border-white/5 overflow-x-auto scrollbar-none flex items-center justify-between gap-6">
        <div className="flex items-center gap-4 shrink-0 font-bold text-slate-300">
          <Link
            href="/?category="
            className="flex items-center gap-1.5 text-white hover:text-cyan-400 transition-colors"
          >
            <Menu className="h-4 w-4" /> All Categories
          </Link>

          <Link
            href="/?category=electronics"
            className="flex items-center gap-1 hover:text-cyan-400 transition-colors"
          >
            <Zap className="h-3.5 w-3.5 text-cyan-400" /> Electronics
          </Link>

          <Link
            href="/?category=clothing"
            className="flex items-center gap-1 hover:text-cyan-400 transition-colors"
          >
            <Flame className="h-3.5 w-3.5 text-orange-400" /> Apparel & Fashion
          </Link>

          <Link
            href="/?category=accessories"
            className="flex items-center gap-1 hover:text-cyan-400 transition-colors"
          >
            <Sparkles className="h-3.5 w-3.5 text-pink-400" /> Audio & Accessories
          </Link>

          <Link
            href="/orders"
            className="flex items-center gap-1 hover:text-cyan-400 transition-colors"
          >
            <Clock className="h-3.5 w-3.5 text-emerald-400" /> Track Shipments
          </Link>
        </div>

        {/* KRaft Event Bus Badge */}
        <div className="hidden lg:flex items-center gap-2 text-[11px] font-bold text-cyan-400/90 shrink-0">
          <span className="flex h-2 w-2 relative">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-cyan-500"></span>
          </span>
          <span>KRaft 4.2 Event Bus Active</span>
        </div>
      </div>

      {/* Deliver To Location Modal */}
      {isLocationModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="glass-panel bg-slate-900 border border-white/10 rounded-3xl p-6 max-w-md w-full shadow-2xl">
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-white/10">
              <div className="flex items-center gap-2">
                <MapPin className="h-5 w-5 text-cyan-400" />
                <h4 className="font-bold text-base text-white">Choose your delivery location</h4>
              </div>
              <button
                onClick={() => setIsLocationModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-full hover:bg-white/10 cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <p className="text-xs text-slate-300 mb-4 leading-relaxed">
              Delivery options and speeds will update dynamically based on your delivery destination.
            </p>

            <form onSubmit={handleSaveLocation} className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase text-slate-400 mb-1">
                  City / Metro Region
                </label>
                <input
                  type="text"
                  value={tempCity}
                  onChange={(e) => setTempCity(e.target.value)}
                  placeholder="e.g. Seattle, San Francisco, New York"
                  className="w-full px-4 py-2.5 rounded-2xl bg-slate-800 border border-white/10 text-white text-xs focus:ring-2 focus:ring-cyan-400 focus:outline-none"
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
                  className="w-full px-4 py-2.5 rounded-2xl bg-slate-800 border border-white/10 text-white text-xs focus:ring-2 focus:ring-cyan-400 focus:outline-none"
                  required
                />
              </div>

              <div className="flex gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setIsLocationModalOpen(false)}
                  className="flex-1 py-2.5 rounded-full bg-slate-800 text-slate-300 font-bold text-xs hover:bg-slate-700 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-full bg-gradient-to-r from-cyan-500 to-indigo-600 text-slate-950 font-bold text-xs hover:brightness-110 transition-all shadow-md shadow-cyan-500/20 cursor-pointer"
                >
                  Apply Destination
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </header>
  );
}
