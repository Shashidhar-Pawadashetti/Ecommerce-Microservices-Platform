"use client";

import Link from "next/link";
import { ChevronUp, Globe, DollarSign, Package, ShieldCheck, Radio, Sparkles, Cpu } from "lucide-react";

export function MarketplaceFooter() {
  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <footer className="w-full bg-[#0b101b] text-slate-400 text-xs border-t border-white/[0.08] mt-24">
      {/* Back to top button */}
      <button
        onClick={scrollToTop}
        className="w-full py-4 bg-[#141d2e] hover:bg-[#1b263b] text-slate-300 font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer text-xs"
      >
        <ChevronUp className="h-4 w-4 text-cyan-400" /> Back to top
      </button>

      {/* Multi-Column Sections */}
      <div className="container mx-auto px-4 md:px-6 py-12 grid grid-cols-2 md:grid-cols-4 gap-8 max-w-6xl">
        <div>
          <h4 className="font-bold text-white text-sm mb-3.5 flex items-center gap-1.5">
            <Cpu className="h-4 w-4 text-cyan-400" /> Nexora Platform
          </h4>
          <ul className="space-y-2">
            <li><Link href="/" className="hover:text-cyan-400 transition-colors">Microservices Topology</Link></li>
            <li><Link href="/" className="hover:text-cyan-400 transition-colors">Kafka KRaft Saga Bus</Link></li>
            <li><Link href="/" className="hover:text-cyan-400 transition-colors">FastAPI & PyMongo Engine</Link></li>
            <li><Link href="/" className="hover:text-cyan-400 transition-colors">Spring Cloud Gateway</Link></li>
            <li><Link href="/" className="hover:text-cyan-400 transition-colors">Redis Caching Subsystem</Link></li>
          </ul>
        </div>

        <div>
          <h4 className="font-bold text-white text-sm mb-3.5 flex items-center gap-1.5">
            <Sparkles className="h-4 w-4 text-pink-400" /> Commerce & Rewards
          </h4>
          <ul className="space-y-2">
            <li><Link href="/" className="hover:text-cyan-400 transition-colors">Nexora Prime Membership</Link></li>
            <li><Link href="/" className="hover:text-cyan-400 transition-colors">Global Priority Logistics</Link></li>
            <li><Link href="/" className="hover:text-cyan-400 transition-colors">Developer Perk Vault</Link></li>
            <li><Link href="/" className="hover:text-cyan-400 transition-colors">Affiliate & Creator Hub</Link></li>
            <li><Link href="/" className="hover:text-cyan-400 transition-colors">Merchant Marketplace</Link></li>
          </ul>
        </div>

        <div>
          <h4 className="font-bold text-white text-sm mb-3.5 flex items-center gap-1.5">
            <DollarSign className="h-4 w-4 text-emerald-400" /> Payments & Wallets
          </h4>
          <ul className="space-y-2">
            <li><Link href="/" className="hover:text-cyan-400 transition-colors">Nexora Visa Signature</Link></li>
            <li><Link href="/" className="hover:text-cyan-400 transition-colors">Instant Debit Sandbox</Link></li>
            <li><Link href="/" className="hover:text-cyan-400 transition-colors">Saga Transaction Protocol</Link></li>
            <li><Link href="/" className="hover:text-cyan-400 transition-colors">Multi-Currency Exchange</Link></li>
            <li><Link href="/" className="hover:text-cyan-400 transition-colors">Idempotent Settlement</Link></li>
          </ul>
        </div>

        <div>
          <h4 className="font-bold text-white text-sm mb-3.5 flex items-center gap-1.5">
            <ShieldCheck className="h-4 w-4 text-amber-400" /> Customer Assurance
          </h4>
          <ul className="space-y-2">
            <li><Link href="/orders" className="hover:text-cyan-400 transition-colors">Shipment Tracking</Link></li>
            <li><Link href="/cart" className="hover:text-cyan-400 transition-colors">30-Day Hassle-Free Returns</Link></li>
            <li><Link href="/orders" className="hover:text-cyan-400 transition-colors">Commercial Invoicing</Link></li>
            <li><Link href="/" className="hover:text-cyan-400 transition-colors">Security & Data Privacy</Link></li>
            <li><Link href="/" className="hover:text-cyan-400 transition-colors">24/7 Priority Support</Link></li>
          </ul>
        </div>
      </div>

      {/* Brand & International Pill Bar */}
      <div className="border-t border-white/5 py-8 bg-[#070b13]">
        <div className="container mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs max-w-6xl">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-gradient-to-tr from-cyan-500 to-indigo-600 text-slate-950 font-black">
              <Package className="h-4 w-4" />
            </div>
            <span className="font-black text-white text-base">
              NEX<span className="text-cyan-400">ORA</span> <span className="text-slate-400 text-xs font-normal">Cloud Commerce</span>
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-white/10 bg-slate-900 text-slate-300">
              <Globe className="h-3.5 w-3.5 text-cyan-400" />
              <span>English (US)</span>
            </div>
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-white/10 bg-slate-900 text-slate-300">
              <DollarSign className="h-3.5 w-3.5 text-emerald-400" />
              <span>USD ($)</span>
            </div>
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-white/10 bg-slate-900 text-slate-300">
              <Radio className="h-3.5 w-3.5 text-pink-400 animate-pulse" />
              <span>KRaft Sagas Active</span>
            </div>
          </div>
        </div>

        <div className="mt-6 text-center text-[11px] text-slate-500">
          <p>© 2026 Nexora Cloud Commerce Technologies, Inc. All rights reserved.</p>
          <p className="mt-1 text-slate-600 font-mono">
            Powered by 7 Microservices • Spring Boot 3.5 • FastAPI 0.141 • Express 5 • Kafka 4.2 KRaft • Next.js 16
          </p>
        </div>
      </div>
    </footer>
  );
}
