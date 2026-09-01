"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Mail, Lock, ArrowRight, Loader2, Sparkles, Package2 } from "lucide-react";
import { AnimeButton } from "@/components/anime/AnimeButton";
import { AnimeText } from "@/components/anime/AnimeText";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
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
    } catch (err: any) {
      setError(err.message || "An error occurred during login");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="relative min-h-[calc(100vh-4rem)] flex items-center justify-center p-4">
      <div className="relative z-10 w-full max-w-md p-8 sm:p-10 glass-panel rounded-3xl shadow-2xl border border-white/[0.08]">
        {/* Brand header */}
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-2 mb-4 group">
            <div className="p-2 rounded-xl bg-gradient-to-tr from-indigo-500 to-pink-500 shadow-md">
              <Package2 className="h-5 w-5 text-white" />
            </div>
            <span className="text-xl font-black text-white">EcoMicro</span>
          </Link>
          <h1 className="text-2xl sm:text-3xl font-black text-white mb-1.5">
            Welcome <AnimeText text="Back" gradient="neon" delay={100} />
          </h1>
          <p className="text-xs text-slate-400">
            Sign in to access your persistent cart and order history
          </p>
        </div>

        {error && (
          <div className="mb-6 p-3.5 bg-rose-950/30 border border-rose-500/40 rounded-2xl text-rose-300 text-xs text-center font-semibold">
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
                className="block w-full pl-10 pr-4 py-3 bg-slate-900/80 border border-white/10 rounded-2xl text-white placeholder-slate-500 focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500 transition-all text-sm outline-none"
                placeholder="shopper@example.com"
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
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="block w-full pl-10 pr-4 py-3 bg-slate-900/80 border border-white/10 rounded-2xl text-white placeholder-slate-500 focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500 transition-all text-sm outline-none"
                placeholder="••••••••"
                required
              />
            </div>
          </div>

          <AnimeButton
            type="submit"
            disabled={isLoading}
            variant="primary"
            size="lg"
            className="w-full mt-4"
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
          <Link href="/signup" className="font-bold text-indigo-400 hover:text-indigo-300 underline">
            Create account
          </Link>
        </p>
      </div>
    </div>
  );
}
