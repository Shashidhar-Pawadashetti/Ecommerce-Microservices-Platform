"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Mail,
  Lock,
  ArrowRight,
  Loader2,
  Package,
  Eye,
  EyeOff,
  CheckCircle2,
  LogOut,
  User,
} from "lucide-react";
import { AnimeButton } from "@/components/anime/AnimeButton";
import { useStore } from "@/providers/StoreContext";
import { User as UserType } from "@/types";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();
  const queryClient = useQueryClient();
  const { setUserProfile, showToast } = useStore();

  // Check if user is already authenticated
  const { data: authUser } = useQuery<UserType | null>({
    queryKey: ["auth-user"],
    queryFn: async () => {
      const res = await fetch("/api/gateway/auth/me");
      if (!res.ok) return null;
      return res.json();
    },
    retry: false,
  });

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    setUserProfile(null);
    queryClient.setQueryData(["auth-user"], null);
    queryClient.setQueryData(["cart"], null);
    queryClient.invalidateQueries();
    router.refresh();
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, password }),
      });

      if (!res.ok) {
        throw new Error("Invalid email or password");
      }

      // Invalidate auth query and pull user profile
      queryClient.invalidateQueries({ queryKey: ["auth-user"] });
      queryClient.invalidateQueries({ queryKey: ["cart"] });

      // Save user email to StoreContext if not present
      setUserProfile({
        fullName: email.split("@")[0],
        email,
      });

      showToast({
        title: "Welcome Back",
        productName: `Signed in as ${email}`,
        priceCents: 0,
        quantity: 1,
        cartTotalCents: 0,
        currency: "USD",
      });

      router.push("/");
      router.refresh();
    } catch (err: any) {
      setError(err.message || "An error occurred during login");
    } finally {
      setIsLoading(false);
    }
  };

  if (authUser) {
    return (
      <div className="relative min-h-[calc(100vh-4rem)] flex items-center justify-center p-4 py-12">
        <div className="relative z-10 w-full max-w-md p-8 sm:p-10 glass-panel bg-slate-900/95 rounded-3xl shadow-2xl border border-white/[0.08] text-center animate-in fade-in">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-emerald-500 to-cyan-500 flex items-center justify-center mx-auto mb-4 text-slate-950 shadow-lg shadow-cyan-500/30">
            <CheckCircle2 className="h-8 w-8" />
          </div>
          <h1 className="text-2xl font-black text-white mb-2">Already Signed In</h1>
          <p className="text-xs text-slate-400 mb-2">
            You are currently authenticated as:
          </p>
          <p className="font-bold text-cyan-300 text-sm mb-6 bg-slate-800/80 py-2.5 px-4 rounded-xl border border-cyan-500/20 truncate">
            {authUser.email}
          </p>
          <div className="space-y-3">
            <Link href="/profile" className="block w-full">
              <AnimeButton variant="primary" className="w-full">
                Go to My Profile <ArrowRight className="h-4 w-4 ml-1" />
              </AnimeButton>
            </Link>
            <Link href="/" className="block w-full">
              <AnimeButton variant="secondary" className="w-full">
                Continue Shopping
              </AnimeButton>
            </Link>
            <button
              onClick={handleLogout}
              className="w-full py-2.5 px-4 text-xs font-bold text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 rounded-2xl border border-rose-500/20 transition-all cursor-pointer flex items-center justify-center gap-1.5"
            >
              <LogOut className="h-3.5 w-3.5" /> Sign Out to Switch Account
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-[calc(100vh-4rem)] flex items-center justify-center p-4 py-12">
      <div className="relative z-10 w-full max-w-md p-8 sm:p-10 glass-panel bg-slate-900/95 rounded-3xl shadow-2xl border border-white/[0.08]">
        {/* Brand header */}
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-2 mb-3 group">
            <div className="p-2 rounded-xl bg-gradient-to-tr from-cyan-500 via-indigo-500 to-pink-500 shadow-lg shadow-cyan-500/20 group-hover:scale-105 transition-transform">
              <Package className="h-6 w-6 text-white" />
            </div>
            <span className="text-2xl font-black text-white tracking-tight">
              NEX<span className="text-cyan-400">ORA</span>
            </span>
          </Link>

          <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight mb-2">
            Welcome{" "}
            <span className="bg-gradient-to-r from-cyan-400 via-indigo-300 to-pink-400 bg-clip-text text-transparent">
              Back
            </span>
          </h1>
          <p className="text-xs text-slate-400">
            Sign in to access your cart, telemetry, and order history
          </p>
        </div>

        {error && (
          <div className="mb-6 p-3.5 bg-rose-950/40 border border-rose-500/40 rounded-2xl text-rose-300 text-xs text-center font-semibold animate-in fade-in">
            {error}
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5 ml-1">
              Email Address
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                <Mail className="h-4 w-4 text-slate-400" />
              </div>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@example.com"
                className="w-full pl-10 pr-4 py-2.5 rounded-2xl bg-slate-800/80 border border-white/10 text-white text-xs placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-400 focus:border-transparent transition-all"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5 ml-1">
              Password
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                <Lock className="h-4 w-4 text-slate-400" />
              </div>
              <input
                type={showPassword ? "text" : "password"}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full pl-10 pr-10 py-2.5 rounded-2xl bg-slate-800/80 border border-white/10 text-white text-xs placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-400 focus:border-transparent transition-all"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-200"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <div className="pt-2">
            <AnimeButton
              type="submit"
              disabled={isLoading}
              className="w-full justify-center shadow-lg shadow-cyan-500/20"
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Signing In...
                </>
              ) : (
                <>
                  Sign In <ArrowRight className="h-4 w-4" />
                </>
              )}
            </AnimeButton>
          </div>
        </form>

        <div className="mt-8 text-center text-xs text-slate-400">
          Don&apos;t have an account?{" "}
          <Link href="/signup" className="font-bold text-cyan-400 hover:text-cyan-300 underline">
            Sign up
          </Link>
        </div>
      </div>
    </div>
  );
}
