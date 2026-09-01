"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CheckCircle2, ShoppingCart, ArrowRight, X, Sparkles } from "lucide-react";
import { useStore } from "@/providers/StoreContext";

export function ToastNotification() {
  const { toast, hideToast } = useStore();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (toast) {
      setVisible(true);
      const timer = setTimeout(() => {
        setVisible(false);
        setTimeout(hideToast, 300);
      }, 6000);
      return () => clearTimeout(timer);
    } else {
      setVisible(false);
    }
  }, [toast, hideToast]);

  if (!toast) return null;

  const formattedItemPrice = ((toast.priceCents || 0) / 100).toLocaleString("en-US", {
    style: "currency",
    currency: toast.currency || "USD",
  });

  const formattedCartTotal = ((toast.cartTotalCents || 0) / 100).toLocaleString("en-US", {
    style: "currency",
    currency: toast.currency || "USD",
  });

  return (
    <div
      className={`fixed top-20 right-4 sm:right-8 z-50 transition-all duration-300 transform ${
        visible ? "translate-y-0 opacity-100 scale-100" : "-translate-y-4 opacity-0 scale-95 pointer-events-none"
      }`}
    >
      <div className="glass-panel bg-slate-900/95 border border-cyan-500/30 rounded-3xl p-5 shadow-2xl shadow-cyan-500/10 max-w-sm w-full backdrop-blur-xl">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-center gap-2">
            <div className="p-1 rounded-full bg-emerald-500/20 text-emerald-400">
              <CheckCircle2 className="h-4 w-4" />
            </div>
            <h4 className="font-bold text-xs text-white uppercase tracking-wider">
              {toast.title || "Added to Cart"}
            </h4>
          </div>
          <button
            onClick={() => {
              setVisible(false);
              setTimeout(hideToast, 300);
            }}
            className="text-slate-400 hover:text-white p-1 rounded-full hover:bg-white/10"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Item Preview */}
        <div className="flex items-center gap-3 p-3 rounded-2xl bg-white/5 border border-white/5 mb-4">
          <div className="p-2 rounded-xl bg-slate-800 text-cyan-400">
            <ShoppingCart className="h-5 w-5" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-xs text-white truncate">{toast.productName}</p>
            <p className="text-[11px] text-slate-400">
              Qty: {toast.quantity} • <span className="text-cyan-400 font-semibold">{formattedItemPrice}</span>
            </p>
          </div>
        </div>

        {/* Subtotal & Action Buttons */}
        <div className="space-y-3">
          <div className="flex justify-between items-center text-xs px-1">
            <span className="text-slate-400">Cart Subtotal:</span>
            <span className="font-black text-white text-sm">{formattedCartTotal}</span>
          </div>

          <div className="flex gap-2">
            <Link
              href="/cart"
              onClick={() => hideToast()}
              className="flex-1 py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs text-center border border-white/10 transition-colors"
            >
              View Cart
            </Link>
            <Link
              href="/checkout"
              onClick={() => hideToast()}
              className="flex-1 py-2 px-3 rounded-xl bg-gradient-to-r from-cyan-500 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-slate-950 font-bold text-xs text-center flex items-center justify-center gap-1 transition-all shadow-md shadow-cyan-500/20"
            >
              Checkout <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
