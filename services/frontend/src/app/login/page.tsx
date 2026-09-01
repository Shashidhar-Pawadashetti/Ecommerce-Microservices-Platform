"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Mail, Lock, ArrowRight, Loader2, Package, Eye, EyeOff } from "lucide-react";
import { AnimeButton } from "@/components/anime/AnimeButton";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

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

      router.push("/");
      router.refresh();
    } catch (err: any) {
      setError(err.message || "An error occurred during login");
    } finally {
      setIsLoading(false);
    }
  };

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
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="block w-full pl-10 pr-4 py-3 bg-slate-800/90 border border-white/10 rounded-2xl text-white placeholder-slate-500 focus:ring-2 focus:ring-cyan-400/40 focus:border-cyan-400 transition-all text-xs outline-none font-medium"
                placeholder="shopper@domain.com"
                required
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
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="block w-full pl-10 pr-10 py-3 bg-slate-800/90 border border-white/10 rounded-2xl text-white placeholder-slate-500 focus:ring-2 focus:ring-cyan-400/40 focus:border-cyan-400 transition-all text-xs outline-none font-medium"
                placeholder="••••••••"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-white cursor-pointer"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <AnimeButton
            type="submit"
            disabled={isLoading}
            variant="primary"
            size="lg"
            className="w-full mt-4 shadow-cyan-500/20"
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
        </form>

        <p className="mt-8 text-center text-xs text-slate-400">
          Don&apos;t have an account?{" "}
          <Link href="/signup" className="font-bold text-cyan-400 hover:text-cyan-300 underline">
            Create account
          </Link>
        </p>
      </div>
    </div>
  );
}
