"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  User,
  Mail,
  Phone,
  MapPin,
  Calendar,
  ShieldCheck,
  Package,
  ShoppingCart,
  LogOut,
  ArrowRight,
  CheckCircle2,
  Lock,
  Sparkles,
  Zap,
  Clock,
  Edit3,
  Save,
  Tag,
  Key,
} from "lucide-react";
import { PageWrapper } from "@/components/anime/PageWrapper";
import { AnimeButton } from "@/components/anime/AnimeButton";
import { useStore } from "@/providers/StoreContext";
import { User as UserType, OrderListResponse, Cart } from "@/types";

const REGIONAL_HUBS = [
  { id: "hub-us-west", label: "US West (Seattle / Silicon Valley Hub)", city: "Seattle", zipCode: "98101" },
  { id: "hub-us-east", label: "US East (New York / New Jersey Hub)", city: "New York", zipCode: "10001" },
  { id: "hub-us-central", label: "US Central (Chicago / Midwest Hub)", city: "Chicago", zipCode: "60601" },
  { id: "hub-us-south", label: "US South (Austin / Texas Tech Hub)", city: "Austin", zipCode: "78701" },
];

export default function ProfilePage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { userProfile, setUserProfile, location, setLocation, showToast } = useStore();

  const [isEditing, setIsEditing] = useState(false);
  const [fullName, setFullName] = useState(userProfile?.fullName || "");
  const [phoneNumber, setPhoneNumber] = useState(userProfile?.phoneNumber || "");
  const [selectedHub, setSelectedHub] = useState(userProfile?.preferredRegion || REGIONAL_HUBS[0].label);

  // Query authenticated user identity from Auth Service via Gateway
  const {
    data: authUser,
    isLoading: isAuthLoading,
    error: authError,
  } = useQuery<UserType | null>({
    queryKey: ["auth-user"],
    queryFn: async () => {
      const res = await fetch("/api/gateway/auth/me");
      if (!res.ok) throw new Error("Unauthorized");
      return res.json();
    },
    retry: false,
  });

  // Query user's orders count
  const { data: orderData } = useQuery<OrderListResponse>({
    queryKey: ["orders"],
    queryFn: async () => {
      const res = await fetch("/api/gateway/orders");
      if (!res.ok) return { items: [], total: 0 };
      return res.json();
    },
    enabled: !!authUser,
  });

  // Query user's cart count
  const { data: cartData } = useQuery<Cart>({
    queryKey: ["cart"],
    queryFn: async () => {
      const res = await fetch("/api/gateway/cart");
      if (!res.ok) return null;
      return res.json();
    },
    enabled: !!authUser,
  });

  useEffect(() => {
    if (userProfile?.fullName && !fullName) {
      setFullName(userProfile.fullName);
    }
    if (userProfile?.phoneNumber && !phoneNumber) {
      setPhoneNumber(userProfile.phoneNumber);
    }
  }, [userProfile, fullName, phoneNumber]);

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    setUserProfile(null);
    queryClient.setQueryData(["auth-user"], null);
    queryClient.setQueryData(["cart"], null);
    queryClient.invalidateQueries();
    router.push("/login");
    router.refresh();
  };

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    const chosenHub = REGIONAL_HUBS.find((h) => h.label === selectedHub) || REGIONAL_HUBS[0];

    setUserProfile({
      fullName: fullName.trim() || authUser?.email?.split("@")[0] || "Nexora Shopper",
      email: authUser?.email || userProfile?.email || "",
      phoneNumber: phoneNumber.trim() || undefined,
      preferredRegion: chosenHub.label,
    });

    setLocation({
      city: chosenHub.city,
      zipCode: chosenHub.zipCode,
      country: "United States",
    });

    setIsEditing(false);

    showToast({
      title: "Profile Updated",
      productName: "Your profile preferences and default logistics hub have been saved.",
      priceCents: 0,
      quantity: 1,
      cartTotalCents: 0,
      currency: "USD",
    });
  };

  if (isAuthLoading) {
    return (
      <div className="min-h-[80vh] flex flex-col items-center justify-center p-4">
        <div className="w-12 h-12 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-sm font-bold text-slate-400">Loading your Nexora profile...</p>
      </div>
    );
  }

  if (authError || !authUser) {
    return (
      <div className="min-h-[75vh] flex items-center justify-center p-4">
        <div className="glass-panel bg-slate-900/90 border border-white/10 rounded-3xl p-8 max-w-md w-full text-center shadow-2xl">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-cyan-500 to-indigo-600 flex items-center justify-center mx-auto mb-4 text-slate-950 shadow-lg shadow-cyan-500/30">
            <Lock className="h-8 w-8" />
          </div>
          <h2 className="text-2xl font-black text-white mb-2">Sign In Required</h2>
          <p className="text-xs text-slate-400 mb-6 leading-relaxed">
            You must be logged in to view your account profile, telemetry, and delivery preferences.
          </p>
          <div className="space-y-3">
            <Link href="/login" className="block w-full">
              <AnimeButton variant="primary" className="w-full">
                Sign In to Account <ArrowRight className="h-4 w-4 ml-1" />
              </AnimeButton>
            </Link>
            <Link href="/" className="block text-xs font-bold text-slate-400 hover:text-white transition-colors">
              Return to Marketplace Home
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const displayName =
    userProfile?.fullName || authUser.email.split("@")[0] || "Nexora Shopper";
  const initials = displayName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const formattedJoinDate = authUser.createdAt
    ? new Date(authUser.createdAt).toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : "Active Member";

  const totalOrdersCount = orderData?.items?.length || 0;
  const cartItemCount =
    cartData?.items?.reduce((acc, item) => acc + (item.quantity || 1), 0) || 0;

  return (
    <PageWrapper className="w-full max-w-5xl mx-auto px-4 sm:px-6 py-10 space-y-8">
      {/* ── PROFILE HEADER BANNER ── */}
      <div className="relative overflow-hidden rounded-3xl glass-panel bg-gradient-to-r from-slate-900 via-indigo-950/40 to-slate-900 border border-white/10 p-6 sm:p-8 shadow-2xl">
        <div className="absolute top-0 right-0 w-80 h-80 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-10 w-60 h-60 bg-pink-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row items-center md:items-start justify-between gap-6">
          <div className="flex flex-col sm:flex-row items-center gap-5 text-center sm:text-left">
            {/* User Avatar */}
            <div className="relative group">
              <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl bg-gradient-to-tr from-cyan-400 via-indigo-500 to-pink-500 p-1 shadow-xl shadow-cyan-500/20">
                <div className="w-full h-full rounded-xl bg-slate-950 flex items-center justify-center font-black text-2xl sm:text-3xl text-white">
                  {initials}
                </div>
              </div>
              <span className="absolute -bottom-1 -right-1 p-1 bg-emerald-500 text-slate-950 rounded-full border-2 border-slate-900 shadow-md">
                <CheckCircle2 className="h-4 w-4 stroke-[3]" />
              </span>
            </div>

            {/* Identity Info */}
            <div className="space-y-1.5">
              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
                <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
                  {displayName}
                </h1>
                <span className="text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/40">
                  Verified Member
                </span>
                <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  Active JWT
                </span>
              </div>

              <div className="flex items-center justify-center sm:justify-start gap-2 text-slate-400 text-xs">
                <Mail className="h-3.5 w-3.5 text-cyan-400" />
                <span>{authUser.email}</span>
              </div>

              <div className="flex items-center justify-center sm:justify-start gap-2 text-slate-400 text-[11px]">
                <Calendar className="h-3.5 w-3.5 text-indigo-400" />
                <span>Member since {formattedJoinDate}</span>
              </div>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="flex items-center gap-3 shrink-0">
            <button
              onClick={() => setIsEditing(!isEditing)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-white/10 hover:bg-white/15 text-white font-bold text-xs border border-white/10 transition-all cursor-pointer shadow-md"
            >
              <Edit3 className="h-4 w-4 text-cyan-400" />
              <span>{isEditing ? "Close Editor" : "Edit Profile"}</span>
            </button>
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 font-bold text-xs border border-rose-500/30 transition-all cursor-pointer shadow-md"
            >
              <LogOut className="h-4 w-4" />
              <span>Sign Out</span>
            </button>
          </div>
        </div>
      </div>

      {/* ── METRICS & STATS CARDS ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Link
          href="/orders"
          className="glass-panel p-5 rounded-3xl border border-white/[0.08] hover:border-cyan-500/40 transition-all group bg-slate-900/60 flex items-center justify-between shadow-lg"
        >
          <div>
            <p className="text-xs font-bold uppercase text-slate-400 mb-1">Total Orders</p>
            <p className="text-3xl font-black text-white group-hover:text-cyan-400 transition-colors">
              {totalOrdersCount}
            </p>
            <p className="text-[11px] text-cyan-400/80 mt-1 flex items-center gap-1 font-semibold">
              Track Shipments <ArrowRight className="h-3 w-3" />
            </p>
          </div>
          <div className="p-3.5 rounded-2xl bg-cyan-500/10 text-cyan-400 group-hover:scale-110 transition-transform">
            <Package className="h-6 w-6" />
          </div>
        </Link>

        <Link
          href="/cart"
          className="glass-panel p-5 rounded-3xl border border-white/[0.08] hover:border-emerald-500/40 transition-all group bg-slate-900/60 flex items-center justify-between shadow-lg"
        >
          <div>
            <p className="text-xs font-bold uppercase text-slate-400 mb-1">Active Cart</p>
            <p className="text-3xl font-black text-white group-hover:text-emerald-400 transition-colors">
              {cartItemCount}
            </p>
            <p className="text-[11px] text-emerald-400/80 mt-1 flex items-center gap-1 font-semibold">
              In-Memory Redis <ArrowRight className="h-3 w-3" />
            </p>
          </div>
          <div className="p-3.5 rounded-2xl bg-emerald-500/10 text-emerald-400 group-hover:scale-110 transition-transform">
            <ShoppingCart className="h-6 w-6" />
          </div>
        </Link>

        <div className="glass-panel p-5 rounded-3xl border border-white/[0.08] bg-slate-900/60 flex items-center justify-between shadow-lg">
          <div>
            <p className="text-xs font-bold uppercase text-slate-400 mb-1">Promo Tier</p>
            <p className="text-2xl font-black text-white">NEXORA20</p>
            <p className="text-[11px] text-pink-400 mt-1 flex items-center gap-1 font-semibold">
              <Sparkles className="h-3 w-3" /> 20% Off Checkout
            </p>
          </div>
          <div className="p-3.5 rounded-2xl bg-pink-500/10 text-pink-400">
            <Tag className="h-6 w-6" />
          </div>
        </div>

        <div className="glass-panel p-5 rounded-3xl border border-white/[0.08] bg-slate-900/60 flex items-center justify-between shadow-lg">
          <div>
            <p className="text-xs font-bold uppercase text-slate-400 mb-1">Security</p>
            <p className="text-lg font-black text-white">HS256 Bearer</p>
            <p className="text-[11px] text-indigo-400 mt-1 flex items-center gap-1 font-semibold">
              <ShieldCheck className="h-3 w-3" /> Bcrypt 12 Rounds
            </p>
          </div>
          <div className="p-3.5 rounded-2xl bg-indigo-500/10 text-indigo-400">
            <Key className="h-6 w-6" />
          </div>
        </div>
      </div>

      {/* ── EDIT PROFILE SECTION OR DISPLAY SECTION ── */}
      {isEditing ? (
        <div className="glass-panel bg-slate-900/90 border border-cyan-500/30 rounded-3xl p-6 sm:p-8 shadow-2xl animate-in fade-in">
          <div className="flex items-center justify-between mb-6 pb-4 border-b border-white/10">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-cyan-500/20 text-cyan-400">
                <Edit3 className="h-5 w-5" />
              </div>
              <h2 className="text-lg font-black text-white">Edit Your Account Details</h2>
            </div>
            <button
              onClick={() => setIsEditing(false)}
              className="text-xs font-bold text-slate-400 hover:text-white transition-colors cursor-pointer"
            >
              Cancel
            </button>
          </div>

          <form onSubmit={handleSaveProfile} className="space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                  Full Name
                </label>
                <div className="relative">
                  <User className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <input
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="e.g. Alex Morgan"
                    className="w-full pl-10 pr-4 py-2.5 rounded-2xl bg-slate-800/80 border border-white/10 text-white text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-cyan-400"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                  Phone Number (SMS Delivery Updates)
                </label>
                <div className="relative">
                  <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <input
                    type="tel"
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    placeholder="+1 (555) 000-0000"
                    className="w-full pl-10 pr-4 py-2.5 rounded-2xl bg-slate-800/80 border border-white/10 text-white text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-cyan-400"
                  />
                </div>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                Regional Logistics Hub & Fulfillment Center
              </label>
              <div className="relative">
                <MapPin className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <select
                  value={selectedHub}
                  onChange={(e) => setSelectedHub(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 rounded-2xl bg-slate-800 border border-white/10 text-white text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-cyan-400 cursor-pointer"
                >
                  {REGIONAL_HUBS.map((hub) => (
                    <option key={hub.id} value={hub.label}>
                      {hub.label} ({hub.city}, {hub.zipCode})
                    </option>
                  ))}
                </select>
              </div>
              <p className="text-[11px] text-slate-500 mt-1">
                Changing your logistics hub updates delivery estimates and routing in real time.
              </p>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-white/10">
              <button
                type="button"
                onClick={() => setIsEditing(false)}
                className="px-5 py-2.5 rounded-full bg-slate-800 text-slate-300 font-bold text-xs hover:bg-slate-700 transition-colors cursor-pointer"
              >
                Discard Changes
              </button>
              <AnimeButton variant="primary" size="md" className="shadow-cyan-500/20">
                <Save className="h-4 w-4 mr-1.5" /> Save Preferences
              </AnimeButton>
            </div>
          </form>
        </div>
      ) : (
        /* ── ACCOUNT DETAILS DISPLAY ── */
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Identity & Technical Specs */}
          <div className="glass-panel p-6 rounded-3xl border border-white/[0.08] bg-slate-900/60 shadow-xl space-y-4">
            <h3 className="text-sm font-bold uppercase tracking-wider text-cyan-400 flex items-center gap-2">
              <ShieldCheck className="h-4 w-4" /> Account & Security Identity
            </h3>

            <div className="space-y-3 divide-y divide-white/5 text-xs">
              <div className="flex justify-between items-center pt-2">
                <span className="text-slate-400">Account ID (UUID)</span>
                <span className="font-mono text-[11px] text-slate-300 bg-slate-800/80 px-2 py-1 rounded-lg truncate max-w-[200px]">
                  {authUser.id}
                </span>
              </div>

              <div className="flex justify-between items-center pt-3">
                <span className="text-slate-400">Email Address</span>
                <span className="font-bold text-white">{authUser.email}</span>
              </div>

              <div className="flex justify-between items-center pt-3">
                <span className="text-slate-400">Phone Verification</span>
                <span className="font-semibold text-slate-300">
                  {userProfile?.phoneNumber || "Not configured"}
                </span>
              </div>

              <div className="flex justify-between items-center pt-3">
                <span className="text-slate-400">User Roles</span>
                <span className="font-mono font-bold text-cyan-400">
                  {authUser.roles?.join(", ") || "ROLE_USER"}
                </span>
              </div>

              <div className="flex justify-between items-center pt-3">
                <span className="text-slate-400">Security Encryption</span>
                <span className="text-emerald-400 font-semibold flex items-center gap-1">
                  <CheckCircle2 className="h-3.5 w-3.5" /> SHA-256 Salted
                </span>
              </div>
            </div>
          </div>

          {/* Logistics & Shipping Hub Preferences */}
          <div className="glass-panel p-6 rounded-3xl border border-white/[0.08] bg-slate-900/60 shadow-xl space-y-4">
            <h3 className="text-sm font-bold uppercase tracking-wider text-indigo-400 flex items-center gap-2">
              <MapPin className="h-4 w-4" /> Default Fulfillment Destination
            </h3>

            <div className="space-y-3 divide-y divide-white/5 text-xs">
              <div className="flex justify-between items-center pt-2">
                <span className="text-slate-400">Default Metro City</span>
                <span className="font-bold text-white">{location.city}</span>
              </div>

              <div className="flex justify-between items-center pt-3">
                <span className="text-slate-400">Postal / ZIP Code</span>
                <span className="font-bold text-white">{location.zipCode}</span>
              </div>

              <div className="flex justify-between items-center pt-3">
                <span className="text-slate-400">Country</span>
                <span className="font-semibold text-slate-300">{location.country}</span>
              </div>

              <div className="flex justify-between items-center pt-3">
                <span className="text-slate-400">Regional Fulfillment Center</span>
                <span className="font-semibold text-cyan-300 truncate max-w-[220px]">
                  {userProfile?.preferredRegion || "US West (Seattle Hub)"}
                </span>
              </div>

              <div className="flex justify-between items-center pt-3">
                <span className="text-slate-400">Express Delivery Tier</span>
                <span className="text-emerald-400 font-semibold flex items-center gap-1">
                  <Zap className="h-3.5 w-3.5" /> Next-Day Available
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── MEMBER PERKS VAULT BANNER ── */}
      <div className="glass-panel rounded-3xl p-6 sm:p-8 bg-gradient-to-r from-cyan-950/30 via-indigo-950/20 to-purple-950/30 border border-white/10 shadow-xl flex flex-col sm:flex-row items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className="p-3.5 rounded-2xl bg-gradient-to-tr from-cyan-500 to-indigo-600 text-slate-950 font-black shadow-lg">
            <Sparkles className="h-6 w-6" />
          </div>
          <div>
            <h3 className="text-base sm:text-lg font-black text-white">Nexora Prime Rewards & Cloud Perks</h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Enjoy zero-commission order settlement, KRaft real-time notification dispatch, and 20% off hardware.
            </p>
          </div>
        </div>

        <Link href="/" className="shrink-0">
          <AnimeButton variant="secondary" size="md">
            Continue Shopping <ArrowRight className="h-4 w-4 ml-1.5" />
          </AnimeButton>
        </Link>
      </div>
    </PageWrapper>
  );
}
