"use client";

import { useEffect, useRef } from "react";
import anime from "animejs";
import Link from "next/link";
import { CheckCircle2, ShoppingCart, X, ArrowRight } from "lucide-react";
import { useStore } from "@/providers/StoreContext";

export function ToastNotification() {
  const { toast, hideToast } = useStore();
  const toastRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (toast && toastRef.current) {
      anime({
        targets: toastRef.current,
        translateY: [-40, 0],
        opacity: [0, 1],
        scale: [0.95, 1],
        duration: 350,
        easing: "easeOutCubic",
      });
    }
  }, [toast]);

  if (!toast) return null;

  return (
    <div className="fixed top-20 right-4 sm:right-8 z-50 max-w-md w-full pointer-events-auto">
      <div
        ref={toastRef}
        className="glass-panel bg-slate-900/95 border border-emerald-500/40 rounded-3xl p-5 shadow-2xl backdrop-blur-2xl text-white relative overflow-hidden"
      >
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-center gap-2 text-emerald-400 font-bold text-sm">
            <CheckCircle2 className="h-5 w-5 fill-emerald-500/20 text-emerald-400" />
            <span>Added to Cart</span>
          </div>
          <button
            onClick={hideToast}
            className="text-slate-400 hover:text-white p-1 rounded-full hover:bg-white/10 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex items-center gap-3.5 mb-4 p-3 rounded-2xl bg-white/5 border border-white/5">
          <div className="p-2.5 rounded-xl bg-indigo-500/20 text-indigo-400 shrink-0">
            <ShoppingCart className="h-6 w-6" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-xs sm:text-sm truncate text-white">
              {toast.productName}
            </p>
            <p className="text-[11px] text-slate-400">
              Qty: {toast.quantity} •{" "}
              {((toast.priceCents || 0) / 100).toLocaleString("en-US", {
                style: "currency",
                currency: toast.currency || "USD",
              })}
            </p>
          </div>
        </div>

        <div className="flex items-center justify-between text-xs mb-4 px-1">
          <span className="text-slate-400">Cart Subtotal:</span>
          <span className="font-black text-sm text-cyan-300">
            {((toast.cartTotalCents || 0) / 100).toLocaleString("en-US", {
              style: "currency",
              currency: toast.currency || "USD",
            })}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-2.5">
          <Link
            href="/cart"
            onClick={hideToast}
            className="px-4 py-2.5 rounded-full text-xs font-bold text-center bg-slate-800 hover:bg-slate-700 text-white border border-slate-700/80 transition-colors"
          >
            View Cart
          </Link>
          <Link
            href="/checkout"
            onClick={hideToast}
            className="px-4 py-2.5 rounded-full text-xs font-bold text-center glow-btn-primary text-white flex items-center justify-center gap-1 shadow-md shadow-indigo-600/30"
          >
            <span>Checkout</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>
    </div>
  );
}
