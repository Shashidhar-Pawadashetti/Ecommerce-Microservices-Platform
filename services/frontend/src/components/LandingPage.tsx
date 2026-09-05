"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowRight,
  ShoppingBag,
  ShieldCheck,
  Zap,
  Radio,
  Server,
  Sparkles,
  Lock,
  Layers,
  CheckCircle2,
  User,
} from "lucide-react";
import { AnimeText } from "@/components/anime/AnimeText";
import { AnimeCounter } from "@/components/anime/AnimeCounter";
import { AnimeStagger } from "@/components/anime/AnimeStagger";
import { AnimeButton } from "@/components/anime/AnimeButton";
import { AnimeArchitectureVisualizer } from "@/components/anime/AnimeArchitectureVisualizer";
import { User as UserType } from "@/types";

export function LandingPage() {
  // Query authenticated user to determine whether to show profile or signup CTA
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

  return (
    <div className="relative min-h-screen flex flex-col items-center overflow-hidden">
      {/* ── HERO SECTION ── */}
      <section className="relative z-10 w-full max-w-6xl mx-auto px-4 md:px-6 pt-16 md:pt-24 pb-16 flex flex-col items-center text-center">
        {/* Animated Badge */}
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full glass-panel border border-indigo-500/30 text-xs sm:text-sm font-semibold text-indigo-300 mb-8 shadow-lg shadow-indigo-500/10">
          <span className="flex h-2 w-2 rounded-full bg-cyan-400 animate-ping" />
          <span>⚡ High-Performance Polyglot Architecture</span>
        </div>

        {/* Dynamic Title with Anime.js text reveal */}
        <div className="max-w-4xl mb-6">
          <h1 className="text-4xl sm:text-6xl lg:text-7xl font-black tracking-tight leading-[1.1] text-white">
            Next-Gen Commerce, <br />
            <AnimeText text="Powered by Microservices" gradient="neon" delay={200} />
          </h1>
        </div>

        <p className="text-base sm:text-xl text-slate-300 max-w-2xl leading-relaxed mb-10">
          Experience ultra-responsive shopping powered by Spring Boot, FastAPI, Node.js, and Apache Kafka KRaft with transactional outbox sagas and in-memory Redis carts.
        </p>

        {/* CTA Actions */}
        <div className="flex flex-col sm:flex-row gap-4 w-full sm:w-auto mb-16">
          {isLoggedIn ? (
            <Link href="/profile">
              <AnimeButton size="lg" variant="primary" className="w-full sm:w-auto shadow-indigo-600/30">
                <User className="h-5 w-5 mr-1.5" /> View My Profile <ArrowRight className="h-5 w-5 ml-1" />
              </AnimeButton>
            </Link>
          ) : (
            <Link href="/signup">
              <AnimeButton size="lg" variant="primary" className="w-full sm:w-auto shadow-indigo-600/30">
                Create Account <ArrowRight className="h-5 w-5 ml-1" />
              </AnimeButton>
            </Link>
          )}
          <Link href="/#catalog-section">
            <AnimeButton size="lg" variant="secondary" className="w-full sm:w-auto">
              Browse Catalog
            </AnimeButton>
          </Link>
        </div>

        {/* Live Metrics Counter Bar */}
        <div className="w-full grid grid-cols-2 md:grid-cols-4 gap-4 glass-panel rounded-3xl p-6 border border-slate-700/50 shadow-2xl mb-20">
          <div className="flex flex-col items-center p-3 border-r border-slate-800 last:border-0">
            <div className="flex items-center text-3xl sm:text-4xl font-black text-cyan-400">
              <AnimeCounter target={7} duration={1500} />
              <span className="text-cyan-400 ml-0.5">+</span>
            </div>
            <span className="text-xs font-semibold text-slate-400 mt-1 uppercase tracking-wider">
              Microservices
            </span>
          </div>

          <div className="flex flex-col items-center p-3 border-r border-slate-800 last:border-0">
            <div className="flex items-center text-3xl sm:text-4xl font-black text-indigo-400">
              <AnimeCounter target={3} duration={1500} />
              <span className="text-indigo-400 ml-0.5">x</span>
            </div>
            <span className="text-xs font-semibold text-slate-400 mt-1 uppercase tracking-wider">
              Datastores (PG/Mongo/Redis)
            </span>
          </div>

          <div className="flex flex-col items-center p-3 border-r border-slate-800 last:border-0">
            <div className="flex items-center text-3xl sm:text-4xl font-black text-pink-400">
              <AnimeCounter target={100} duration={1800} />
              <span className="text-pink-400 ml-0.5">%</span>
            </div>
            <span className="text-xs font-semibold text-slate-400 mt-1 uppercase tracking-wider">
              Kafka KRaft Sagas
            </span>
          </div>

          <div className="flex flex-col items-center p-3 last:border-0">
            <div className="flex items-center text-3xl sm:text-4xl font-black text-emerald-400">
              <AnimeCounter target={24} duration={1200} />
              <span className="text-emerald-400 ml-0.5">h</span>
            </div>
            <span className="text-xs font-semibold text-slate-400 mt-1 uppercase tracking-wider">
              Redis TTL Carts
            </span>
          </div>
        </div>

        {/* ── INTERACTIVE ANIME ARCHITECTURE VISUALIZER ── */}
        <div className="w-full mb-16">
          <AnimeArchitectureVisualizer />
        </div>

        {/* ── CORE MICROSERVICES CAROUSEL / GRID ── */}
        <div className="w-full mb-20 text-left">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-black text-white mb-3">
              Built on Enterprise Foundations
            </h2>
            <p className="text-slate-400 text-sm sm:text-base max-w-xl mx-auto">
              Every request is orchestrated across dedicated containerized services with resilience and observability.
            </p>
          </div>

          <AnimeStagger className="grid grid-cols-1 md:grid-cols-3 gap-6" staggerDelay={120}>
            {/* Card 1 */}
            <div className="anime-stagger-item glass-panel p-6 rounded-3xl border border-white/10 hover:border-cyan-500/50 transition-all group bg-slate-900/60 shadow-xl">
              <div className="w-12 h-12 rounded-2xl bg-cyan-500/10 text-cyan-400 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <Server className="h-6 w-6" />
              </div>
              <h3 className="text-xl font-bold text-white mb-2 group-hover:text-cyan-400 transition-colors">
                Spring Cloud Gateway
              </h3>
              <p className="text-slate-400 text-xs leading-relaxed">
                Central entry point enforcing JWT verification, route rate-limiting via Redis, and zero-trust perimeter security.
              </p>
            </div>

            {/* Card 2 */}
            <div className="anime-stagger-item glass-panel p-6 rounded-3xl border border-white/10 hover:border-indigo-500/50 transition-all group bg-slate-900/60 shadow-xl">
              <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <Radio className="h-6 w-6" />
              </div>
              <h3 className="text-xl font-bold text-white mb-2 group-hover:text-indigo-400 transition-colors">
                Kafka KRaft Event Bus
              </h3>
              <p className="text-slate-400 text-xs leading-relaxed">
                Asynchronous saga orchestration between order, payment, and notification services without ZooKeeper bottlenecks.
              </p>
            </div>

            {/* Card 3 */}
            <div className="anime-stagger-item glass-panel p-6 rounded-3xl border border-white/10 hover:border-pink-500/50 transition-all group bg-slate-900/60 shadow-xl">
              <div className="w-12 h-12 rounded-2xl bg-pink-500/10 text-pink-400 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <Layers className="h-6 w-6" />
              </div>
              <h3 className="text-xl font-bold text-white mb-2 group-hover:text-pink-400 transition-colors">
                Polyglot Persistence
              </h3>
              <p className="text-slate-400 text-xs leading-relaxed">
                ACID user and order records in PostgreSQL 18, dynamic catalog trees in MongoDB 8.0, and sub-millisecond carts in Redis 8.
              </p>
            </div>
          </AnimeStagger>
        </div>

        {/* ── BOTTOM CTA SECTION ── */}
        <div className="w-full relative overflow-hidden rounded-3xl glass-panel border border-white/10 p-8 sm:p-12 text-center flex flex-col items-center shadow-2xl bg-gradient-to-b from-slate-900 via-indigo-950/20 to-slate-900">
          <div className="absolute top-0 right-1/4 w-72 h-72 bg-pink-500/10 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute bottom-0 left-1/4 w-72 h-72 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />

          <Sparkles className="h-10 w-10 text-amber-400 mb-4 animate-bounce" />
          <h2 className="text-3xl sm:text-5xl font-black text-white mb-4">
            {isLoggedIn ? "Explore Your Nexora Experience" : "Ready to experience the platform?"}
          </h2>
          <p className="text-slate-300 text-sm sm:text-base max-w-lg mb-8">
            {isLoggedIn
              ? "Access your profile, telemetry, order status, and real-time Kafka event stream."
              : "Create an account or start exploring the catalog immediately."}
          </p>

          <div className="flex flex-col sm:flex-row gap-4 w-full sm:w-auto">
            {isLoggedIn ? (
              <Link href="/profile">
                <AnimeButton size="lg" variant="primary" className="w-full sm:w-auto">
                  <User className="h-4 w-4 mr-1.5" /> View My Profile <ArrowRight className="h-4 w-4 ml-1" />
                </AnimeButton>
              </Link>
            ) : (
              <Link href="/signup">
                <AnimeButton size="lg" variant="primary" className="w-full sm:w-auto">
                  Get Started Now <ArrowRight className="h-4 w-4 ml-1" />
                </AnimeButton>
              </Link>
            )}
            <Link href="/#catalog-section">
              <AnimeButton size="lg" variant="secondary" className="w-full sm:w-auto">
                Explore Catalog
              </AnimeButton>
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
