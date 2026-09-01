"use client";

import Link from "next/link";
import { ChevronUp, Globe, DollarSign, Package2, ShieldCheck, Radio } from "lucide-react";

export function AmazonFooter() {
  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <footer className="w-full bg-[#0d131f] text-slate-400 text-xs border-t border-white/[0.08] mt-24">
      {/* Back to top button */}
      <button
        onClick={scrollToTop}
        className="w-full py-4 bg-[#1a2333] hover:bg-[#232f45] text-slate-300 font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer text-xs"
      >
        <ChevronUp className="h-4 w-4" /> Back to top
      </button>

      {/* 4 Multi-Column Sections */}
      <div className="container mx-auto px-4 md:px-6 py-12 grid grid-cols-2 md:grid-cols-4 gap-8 max-w-6xl">
        <div>
          <h4 className="font-bold text-white text-sm mb-3.5">Get to Know Us</h4>
          <ul className="space-y-2">
            <li><Link href="/" className="hover:text-white transition-colors">About EcoPrime</Link></li>
            <li><Link href="/" className="hover:text-white transition-colors">Microservices Architecture</Link></li>
            <li><Link href="/" className="hover:text-white transition-colors">Kafka KRaft Reliability</Link></li>
            <li><Link href="/" className="hover:text-white transition-colors">Investor Relations</Link></li>
            <li><Link href="/" className="hover:text-white transition-colors">EcoPrime Devices</Link></li>
          </ul>
        </div>

        <div>
          <h4 className="font-bold text-white text-sm mb-3.5">Make Money with Us</h4>
          <ul className="space-y-2">
            <li><Link href="/" className="hover:text-white transition-colors">Sell products on EcoPrime</Link></li>
            <li><Link href="/" className="hover:text-white transition-colors">Sell on EcoPrime Business</Link></li>
            <li><Link href="/" className="hover:text-white transition-colors">Become an Affiliate</Link></li>
            <li><Link href="/" className="hover:text-white transition-colors">Advertise Your Products</Link></li>
            <li><Link href="/" className="hover:text-white transition-colors">Self-Publish with Us</Link></li>
          </ul>
        </div>

        <div>
          <h4 className="font-bold text-white text-sm mb-3.5">EcoPrime Payment Products</h4>
          <ul className="space-y-2">
            <li><Link href="/" className="hover:text-white transition-colors">EcoPrime Rewards Card</Link></li>
            <li><Link href="/" className="hover:text-white transition-colors">Shop with Points</Link></li>
            <li><Link href="/" className="hover:text-white transition-colors">Reload Your Balance</Link></li>
            <li><Link href="/" className="hover:text-white transition-colors">Currency Converter</Link></li>
            <li><Link href="/" className="hover:text-white transition-colors">Instant Debit Sandbox</Link></li>
          </ul>
        </div>

        <div>
          <h4 className="font-bold text-white text-sm mb-3.5">Let Us Help You</h4>
          <ul className="space-y-2">
            <li><Link href="/orders" className="hover:text-white transition-colors">Your Account & Orders</Link></li>
            <li><Link href="/cart" className="hover:text-white transition-colors">Shipping Rates & Policies</Link></li>
            <li><Link href="/orders" className="hover:text-white transition-colors">Returns & Replacements</Link></li>
            <li><Link href="/" className="hover:text-white transition-colors">Manage Your Content</Link></li>
            <li><Link href="/" className="hover:text-white transition-colors">Help & Customer Service</Link></li>
          </ul>
        </div>
      </div>

      {/* Brand & International Pill Bar */}
      <div className="border-t border-white/5 py-8 bg-[#090e17]">
        <div className="container mx-auto px-4 flex flex-col sm:flex-row items-center justify-center gap-4 text-xs">
          <div className="flex items-center gap-2">
            <div className="p-1 rounded-md bg-amber-500 text-slate-950">
              <Package2 className="h-4 w-4" />
            </div>
            <span className="font-black text-white text-sm">
              Eco<span className="text-amber-400">Prime</span>
            </span>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1 px-3 py-1.5 rounded-full border border-white/10 bg-slate-800/80 text-slate-300">
              <Globe className="h-3.5 w-3.5 text-amber-400" />
              <span>English</span>
            </div>
            <div className="flex items-center gap-1 px-3 py-1.5 rounded-full border border-white/10 bg-slate-800/80 text-slate-300">
              <DollarSign className="h-3.5 w-3.5 text-emerald-400" />
              <span>USD - U.S. Dollar</span>
            </div>
            <div className="flex items-center gap-1 px-3 py-1.5 rounded-full border border-white/10 bg-slate-800/80 text-slate-300">
              <Radio className="h-3.5 w-3.5 text-indigo-400 animate-pulse" />
              <span>KRaft Sagas Active</span>
            </div>
          </div>
        </div>

        <div className="mt-6 text-center text-[11px] text-slate-500">
          <p>© 2026 EcoPrime Microservices Platform, Inc. or its affiliates. All rights reserved.</p>
          <p className="mt-1">Spring Cloud Gateway • FastAPI • Express 5 • Spring Boot 3.5 • Kafka 4.2 KRaft • Next.js 16</p>
        </div>
      </div>
    </footer>
  );
}
