"use client";

import { useState } from "react";
import { X, Bell, CheckCircle2, DollarSign, Sparkles, Send, ShieldCheck } from "lucide-react";
import { Product } from "@/types";

interface PriceWatcherModalProps {
  product: Product;
  onClose: () => void;
}

export function PriceWatcherModal({ product, onClose }: PriceWatcherModalProps) {
  const currentPriceDollars = (product.priceCents || 0) / 100;
  const [targetPrice, setTargetPrice] = useState((currentPriceDollars * 0.85).toFixed(2));
  const [email, setEmail] = useState("");
  const [isSubmitted, setIsSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitted(true);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-white/10 rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl text-white relative">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-white/10 mb-4">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-cyan-500/20 text-cyan-400 border border-cyan-500/30">
              <Bell className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-black text-base text-white">Nexora Price Drop Watcher</h3>
              <p className="text-[11px] text-slate-400">Automated Mailpit Notification Alert</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-full text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {isSubmitted ? (
          <div className="py-8 text-center space-y-3">
            <div className="w-12 h-12 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto">
              <CheckCircle2 className="h-6 w-6" />
            </div>
            <h4 className="font-bold text-base text-white">Price Alert Configured!</h4>
            <p className="text-xs text-slate-300">
              We will notify <strong className="text-cyan-400">{email}</strong> via the Notification Service when <strong>{product.name}</strong> drops to <strong>${targetPrice}</strong> or lower.
            </p>
            <button
              onClick={onClose}
              className="mt-4 px-6 py-2.5 rounded-full bg-cyan-500 text-slate-950 font-bold text-xs hover:bg-cyan-400 transition-colors"
            >
              Got it, thanks!
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4 text-xs">
            <div className="p-3 rounded-2xl bg-white/5 border border-white/5 space-y-1">
              <p className="font-bold text-white text-xs truncate">{product.name}</p>
              <div className="flex justify-between text-slate-400">
                <span>Current Price:</span>
                <span className="font-black text-white">${currentPriceDollars.toFixed(2)}</span>
              </div>
            </div>

            <div>
              <label className="block text-slate-400 font-semibold mb-1">
                Notify me when price drops below ($ USD):
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 font-bold">
                  $
                </span>
                <input
                  type="number"
                  step="0.01"
                  value={targetPrice}
                  onChange={(e) => setTargetPrice(e.target.value)}
                  className="w-full pl-8 pr-4 py-2.5 rounded-xl bg-slate-800 border border-white/10 text-white font-bold focus:outline-none focus:ring-2 focus:ring-cyan-400"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-slate-400 font-semibold mb-1">
                Your Email Address:
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="e.g. shopper@domain.com"
                className="w-full px-4 py-2.5 rounded-xl bg-slate-800 border border-white/10 text-white focus:outline-none focus:ring-2 focus:ring-cyan-400"
                required
              />
            </div>

            <div className="pt-2 flex gap-3">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-2.5 rounded-full bg-slate-800 text-slate-300 font-bold hover:bg-slate-700 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="flex-1 py-2.5 rounded-full bg-gradient-to-r from-cyan-500 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-slate-950 font-bold shadow-md shadow-cyan-500/20 flex items-center justify-center gap-1.5 transition-all"
              >
                <Send className="h-3.5 w-3.5" /> Activate Alert
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
