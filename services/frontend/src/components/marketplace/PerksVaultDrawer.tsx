"use client";

import { useState } from "react";
import { Gift, Sparkles, Copy, Check, X, Tag, Zap, Award } from "lucide-react";

interface Perk {
  code: string;
  discount: string;
  description: string;
  badge: string;
  expires: string;
}

const AVAILABLE_PERKS: Perk[] = [
  {
    code: "NEXORA20",
    discount: "20% OFF",
    description: "Instant 20% savings across your entire cart on all microservices hardware.",
    badge: "Most Popular",
    expires: "Valid through 2026",
  },
  {
    code: "KAFKAPOWER",
    discount: "$25.00 OFF",
    description: "Special event discount for Kafka KRaft architecture early adopters.",
    badge: "Special Event",
    expires: "Ends in 2 days",
  },
  {
    code: "FREESHIP",
    discount: "PRIORITY EXPRESS",
    description: "Complimentary upgrade to Next-Morning Priority Delivery.",
    badge: "Logistics",
    expires: "Always Active",
  },
];

export function PerksVaultDrawer() {
  const [isOpen, setIsOpen] = useState(false);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  const handleCopy = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 3000);
  };

  return (
    <>
      {/* Trigger Button in Sub-Bar or Floating */}
      <button
        onClick={() => setIsOpen(true)}
        className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-gradient-to-r from-pink-500/20 to-purple-500/20 border border-pink-500/30 text-pink-300 font-bold hover:border-pink-400 hover:text-white transition-all text-[11px] cursor-pointer"
      >
        <Gift className="h-3.5 w-3.5 text-pink-400" />
        <span>Perks Vault</span>
        <span className="px-1.5 py-0.2 rounded-full bg-pink-500 text-[9px] text-white font-black">
          3 NEW
        </span>
      </button>

      {/* Modal / Drawer */}
      {isOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="glass-panel bg-slate-900 border border-white/10 rounded-3xl p-6 sm:p-8 max-w-lg w-full shadow-2xl text-white relative animate-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="flex items-center justify-between pb-4 border-b border-white/10 mb-6">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-pink-500/20 text-pink-400 border border-pink-500/30">
                  <Gift className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-black text-base text-white">Nexora Rewards & Perks Vault</h3>
                  <p className="text-[11px] text-slate-400">Exclusive coupon codes ready for 1-click checkout</p>
                </div>
              </div>

              <button
                onClick={() => setIsOpen(false)}
                className="p-1.5 rounded-full text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Perks Cards List */}
            <div className="space-y-3.5">
              {AVAILABLE_PERKS.map((perk) => (
                <div
                  key={perk.code}
                  className="p-4 rounded-2xl bg-slate-800/80 border border-white/5 flex flex-col justify-between gap-3 hover:border-pink-500/30 transition-all"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-black text-sm text-pink-400">
                          {perk.code}
                        </span>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-pink-500/20 text-pink-300 border border-pink-500/30">
                          {perk.badge}
                        </span>
                      </div>
                      <p className="font-black text-white text-base mt-1">{perk.discount}</p>
                    </div>

                    <button
                      onClick={() => handleCopy(perk.code)}
                      className="px-3.5 py-1.5 rounded-full bg-slate-700 hover:bg-slate-600 text-white font-bold text-xs flex items-center gap-1.5 transition-colors border border-white/10"
                    >
                      {copiedCode === perk.code ? (
                        <>
                          <Check className="h-3.5 w-3.5 text-emerald-400" /> Copied!
                        </>
                      ) : (
                        <>
                          <Copy className="h-3.5 w-3.5 text-slate-300" /> Copy Code
                        </>
                      )}
                    </button>
                  </div>

                  <p className="text-xs text-slate-300">{perk.description}</p>
                  <span className="text-[10px] text-slate-500 font-medium">{perk.expires}</span>
                </div>
              ))}
            </div>

            <div className="pt-6 border-t border-white/10 flex justify-end">
              <button
                onClick={() => setIsOpen(false)}
                className="px-5 py-2 rounded-full bg-slate-800 text-white font-bold text-xs hover:bg-slate-700 transition-colors"
              >
                Close Vault
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
