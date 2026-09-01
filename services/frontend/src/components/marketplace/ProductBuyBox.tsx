"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ShieldCheck,
  Truck,
  RotateCcw,
  Lock,
  Loader2,
  ShoppingCart,
  Zap,
  Gift,
  CheckCircle2,
  Sparkles,
  Bell,
  Scale,
} from "lucide-react";
import { Product } from "@/types";
import { useStore } from "@/providers/StoreContext";

interface ProductBuyBoxProps {
  product: Product;
  onOpenPriceWatcher?: () => void;
  onOpenComparison?: () => void;
}

export function ProductBuyBox({ product, onOpenPriceWatcher, onOpenComparison }: ProductBuyBoxProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { location, showToast } = useStore();
  const [quantity, setQuantity] = useState(1);
  const [isGift, setIsGift] = useState(false);
  const [error, setError] = useState("");

  const formattedPrice = ((product.priceCents || 0) / 100).toLocaleString("en-US", {
    style: "currency",
    currency: product.currency || "USD",
  });

  // Calculate simulated Nexora Prime list price (15% higher)
  const listPriceCents = Math.round((product.priceCents || 0) * 1.15);
  const formattedListPrice = (listPriceCents / 100).toLocaleString("en-US", {
    style: "currency",
    currency: product.currency || "USD",
  });
  const savingsCents = listPriceCents - (product.priceCents || 0);
  const formattedSavings = (savingsCents / 100).toLocaleString("en-US", {
    style: "currency",
    currency: product.currency || "USD",
  });

  const addToCartMutation = useMutation({
    mutationFn: async (redirectAfter: boolean = false) => {
      setError("");
      const res = await fetch(`/api/gateway/cart/items`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId: product.id,
          quantity,
        }),
      });

      if (!res.ok) {
        if (res.status === 401) {
          throw new Error("Please log in to add items to your cart.");
        }
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || "Failed to add item to cart");
      }
      const cartData = await res.json();
      return { cartData, redirectAfter };
    },
    onSuccess: ({ cartData, redirectAfter }) => {
      queryClient.invalidateQueries({ queryKey: ["cart"] });
      showToast({
        title: "Added to Cart",
        productName: product.name,
        priceCents: product.priceCents,
        quantity,
        cartTotalCents: cartData?.grandTotalCents || product.priceCents * quantity,
        currency: product.currency || "USD",
      });

      if (redirectAfter) {
        router.push("/checkout");
      }
    },
    onError: (err: any) => {
      setError(err.message || "Could not add to cart");
    },
  });

  const inStock = product.stock === undefined || product.stock > 0;
  const isLowStock = product.stock !== undefined && product.stock > 0 && product.stock <= 4;

  return (
    <div className="glass-panel bg-slate-900/90 rounded-3xl p-6 border border-white/[0.08] shadow-2xl flex flex-col justify-between">
      <div>
        {/* Price & Savings */}
        <div className="mb-4">
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-black text-white">{formattedPrice}</span>
            <span className="text-xs text-slate-400 line-through">{formattedListPrice}</span>
          </div>
          <p className="text-xs text-cyan-400 font-semibold mt-0.5 flex items-center gap-1">
            <Sparkles className="h-3 w-3" /> Save {formattedSavings} (15% off) with Nexora Prime
          </p>
        </div>

        {/* Nexora Prime & Delivery Estimator */}
        <div className="space-y-2 mb-5 pb-5 border-b border-white/10 text-xs">
          <div className="flex items-center gap-1.5 font-bold text-cyan-400">
            <Zap className="h-4 w-4 fill-cyan-400 text-cyan-400" />
            <span>FREE Nexora Express Delivery</span>
          </div>
          <p className="text-slate-300">
            Order within <span className="font-bold text-cyan-400">4 hrs 18 mins</span> for delivery tomorrow to{" "}
            <span className="font-bold text-white">{location.city} {location.zipCode}</span>.
          </p>
          <div className="flex items-center gap-1 text-[11px] text-slate-400">
            <Truck className="h-3.5 w-3.5 text-slate-400" />
            <span>Ships directly from Nexora Regional Hub</span>
          </div>
        </div>

        {/* Stock Urgency Status */}
        <div className="mb-5">
          {inStock ? (
            isLowStock ? (
              <p className="text-xs font-bold text-amber-400 flex items-center gap-1.5 animate-pulse">
                ⚡ Only {product.stock} left in stock - order soon.
              </p>
            ) : (
              <p className="text-xs font-bold text-emerald-400 flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4" /> In Stock & Ready to Dispatch
              </p>
            )
          ) : (
            <p className="text-xs font-bold text-rose-400">Temporarily out of stock.</p>
          )}
        </div>

        {error && (
          <div className="mb-4 p-3 bg-rose-950/40 border border-rose-500/40 text-rose-300 rounded-xl text-xs font-semibold">
            {error}
          </div>
        )}

        {/* Quantity Dropdown */}
        {inStock && (
          <div className="mb-5 flex items-center justify-between">
            <label htmlFor="buybox-quantity" className="text-xs font-bold uppercase text-slate-400">
              Quantity:
            </label>
            <select
              id="buybox-quantity"
              value={quantity}
              onChange={(e) => setQuantity(parseInt(e.target.value))}
              className="bg-slate-800 border border-white/10 text-white rounded-xl px-3 py-1.5 text-xs font-bold focus:ring-2 focus:ring-cyan-400 cursor-pointer"
            >
              {[...Array(Math.min(10, product.stock || 10))].map((_, i) => (
                <option key={i + 1} value={i + 1}>
                  {i + 1}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Action Buttons */}
        <div className="space-y-3 mb-6">
          <button
            onClick={() => addToCartMutation.mutate(false)}
            disabled={!inStock || addToCartMutation.isPending}
            className="w-full py-3 px-4 rounded-full bg-gradient-to-r from-cyan-500 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-slate-950 font-bold text-xs shadow-lg shadow-cyan-500/20 flex items-center justify-center gap-2 transition-all disabled:opacity-50 cursor-pointer"
          >
            {addToCartMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                <ShoppingCart className="h-4 w-4" /> Add to Cart
              </>
            )}
          </button>

          <button
            onClick={() => addToCartMutation.mutate(true)}
            disabled={!inStock || addToCartMutation.isPending}
            className="w-full py-3 px-4 rounded-full bg-gradient-to-r from-pink-500 to-rose-600 hover:from-pink-400 hover:to-rose-500 text-white font-bold text-xs shadow-lg shadow-pink-500/20 flex items-center justify-center gap-2 transition-all disabled:opacity-50 cursor-pointer"
          >
            <Zap className="h-4 w-4 fill-white" /> 1-Click Instant Checkout
          </button>
        </div>

        {/* Unique Feature Action Buttons: Price Watcher & AI Spec Compare */}
        <div className="grid grid-cols-2 gap-2 mb-5">
          {onOpenPriceWatcher && (
            <button
              onClick={onOpenPriceWatcher}
              type="button"
              className="py-2 px-2.5 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-cyan-400 border border-cyan-500/20 text-[11px] font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
            >
              <Bell className="h-3.5 w-3.5" /> Price Alert
            </button>
          )}

          {onOpenComparison && (
            <button
              onClick={onOpenComparison}
              type="button"
              className="py-2 px-2.5 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-indigo-400 border border-indigo-500/20 text-[11px] font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
            >
              <Scale className="h-3.5 w-3.5" /> Compare Specs
            </button>
          )}
        </div>

        {/* Gift Checkbox */}
        <label className="flex items-center gap-2 text-xs text-slate-300 mb-5 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={isGift}
            onChange={(e) => setIsGift(e.target.checked)}
            className="rounded border-white/20 bg-slate-800 text-cyan-500 focus:ring-cyan-400"
          />
          <Gift className="h-3.5 w-3.5 text-pink-400" />
          <span>Add premium gift packaging</span>
        </label>
      </div>

      {/* Trust & Guarantee Badges */}
      <div className="pt-4 border-t border-white/10 space-y-2 text-[11px] text-slate-400">
        <div className="flex justify-between">
          <span>Dispatched from</span>
          <span className="font-semibold text-slate-200">Nexora Global Logistics</span>
        </div>
        <div className="flex justify-between">
          <span>Merchant</span>
          <span className="font-semibold text-slate-200">Nexora Verified Direct</span>
        </div>
        <div className="flex items-center gap-1.5 text-slate-300 pt-1">
          <RotateCcw className="h-3.5 w-3.5 text-indigo-400" />
          <span>30-Day Hassle-Free Return Guarantee</span>
        </div>
        <div className="flex items-center gap-1.5 text-slate-300">
          <Lock className="h-3.5 w-3.5 text-emerald-400" />
          <span>AES-256 Encrypted Transaction</span>
        </div>
      </div>
    </div>
  );
}
