"use client";

import Link from "next/link";
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
} from "lucide-react";
import { AnimeText } from "@/components/anime/AnimeText";
import { AnimeCounter } from "@/components/anime/AnimeCounter";
import { AnimeStagger } from "@/components/anime/AnimeStagger";
import { AnimeButton } from "@/components/anime/AnimeButton";
import { AnimeArchitectureVisualizer } from "@/components/anime/AnimeArchitectureVisualizer";

export function LandingPage() {
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
          <Link href="/signup">
            <AnimeButton size="lg" variant="primary" className="w-full sm:w-auto shadow-indigo-600/30">
              Create Account <ArrowRight className="h-5 w-5" />
            </AnimeButton>
          </Link>
          <Link href="/">
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
            <div className="flex items-center text-3xl sm:text-4xl font-black text-purple-400">
              <AnimeCounter target={99.9} decimals={1} suffix="%" duration={2000} />
            </div>
            <span className="text-xs font-semibold text-slate-400 mt-1 uppercase tracking-wider">
              Saga Reliability
            </span>
          </div>

          <div className="flex flex-col items-center p-3 border-r border-slate-800 last:border-0">
            <div className="flex items-center text-3xl sm:text-4xl font-black text-emerald-400">
              <span className="text-emerald-400 mr-0.5">&lt;</span>
              <AnimeCounter target={8} suffix="ms" duration={1800} />
            </div>
            <span className="text-xs font-semibold text-slate-400 mt-1 uppercase tracking-wider">
              Event Latency
            </span>
          </div>

          <div className="flex flex-col items-center p-3">
            <div className="flex items-center text-3xl sm:text-4xl font-black text-pink-400">
              <AnimeCounter target={100} suffix="%" duration={1600} />
            </div>
            <span className="text-xs font-semibold text-slate-400 mt-1 uppercase tracking-wider">
              KRaft Event Driven
            </span>
          </div>
        </div>

        {/* ── INTERACTIVE ARCHITECTURE VISUALIZER ── */}
        <div className="w-full mb-24">
          <AnimeArchitectureVisualizer />
        </div>

        {/* ── CORE CAPABILITIES ── */}
        <div className="w-full mb-24">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-black text-white mb-3">
              Engineered for Extreme Scalability
            </h2>
            <p className="text-slate-400 text-sm sm:text-base max-w-xl mx-auto">
              Every component is decoupled, containerized, and independently deployable.
            </p>
          </div>

          <AnimeStagger className="grid grid-cols-1 md:grid-cols-3 gap-6" delay={150}>
            <div className="anime-stagger-item glass-card p-8 rounded-3xl border border-slate-800 flex flex-col text-left">
              <div className="p-3.5 rounded-2xl bg-indigo-500/20 text-indigo-400 w-fit mb-5">
                <Zap className="h-6 w-6" />
              </div>
              <h3 className="text-xl font-bold text-white mb-2">Transactional Outbox</h3>
              <p className="text-slate-400 text-sm leading-relaxed mb-4">
                Guaranteed at-least-once message delivery via PostgreSQL outbox tables, preventing distributed transaction inconsistency.
              </p>
              <div className="mt-auto flex items-center gap-2 text-xs font-semibold text-indigo-400">
                <CheckCircle2 className="h-4 w-4" /> Spring Boot + Hibernate
              </div>
            </div>

            <div className="anime-stagger-item glass-card p-8 rounded-3xl border border-slate-800 flex flex-col text-left">
              <div className="p-3.5 rounded-2xl bg-purple-500/20 text-purple-400 w-fit mb-5">
                <Radio className="h-6 w-6" />
              </div>
              <h3 className="text-xl font-bold text-white mb-2">Kafka Event Saga</h3>
              <p className="text-slate-400 text-sm leading-relaxed mb-4">
                Asynchronous choreography between Order Service, FastAPI Payment Service, and Notification Workers with Redis SETNX idempotency.
              </p>
              <div className="mt-auto flex items-center gap-2 text-xs font-semibold text-purple-400">
                <CheckCircle2 className="h-4 w-4" /> Apache Kafka KRaft 4.2
              </div>
            </div>

            <div className="anime-stagger-item glass-card p-8 rounded-3xl border border-slate-800 flex flex-col text-left">
              <div className="p-3.5 rounded-2xl bg-emerald-500/20 text-emerald-400 w-fit mb-5">
                <Lock className="h-6 w-6" />
              </div>
              <h3 className="text-xl font-bold text-white mb-2">Stateless JWT Security</h3>
              <p className="text-slate-400 text-sm leading-relaxed mb-4">
                Spring Cloud Gateway verifies HS256 tokens and enforces Redis-backed rate limiting while routing transparently to microservices.
              </p>
              <div className="mt-auto flex items-center gap-2 text-xs font-semibold text-emerald-400">
                <CheckCircle2 className="h-4 w-4" /> OAuth2 Resource Server
              </div>
            </div>
          </AnimeStagger>
        </div>

        {/* ── CALL TO ACTION BANNER ── */}
        <div className="w-full glass-panel rounded-3xl p-8 sm:p-12 border border-indigo-500/30 bg-gradient-to-r from-indigo-950/60 via-purple-950/40 to-slate-900/80 shadow-2xl relative overflow-hidden flex flex-col items-center">
          <div className="absolute top-0 right-1/4 w-72 h-72 bg-pink-500/10 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute bottom-0 left-1/4 w-72 h-72 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />

          <Sparkles className="h-10 w-10 text-amber-400 mb-4 animate-bounce" />
          <h2 className="text-3xl sm:text-5xl font-black text-white mb-4">
            Ready to experience the platform?
          </h2>
          <p className="text-slate-300 text-sm sm:text-base max-w-lg mb-8">
            Create an account or start exploring the catalog immediately.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 w-full sm:w-auto">
            <Link href="/signup">
              <AnimeButton size="lg" variant="primary" className="w-full sm:w-auto">
                Get Started Now <ArrowRight className="h-4 w-4" />
              </AnimeButton>
            </Link>
            <Link href="/">
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
