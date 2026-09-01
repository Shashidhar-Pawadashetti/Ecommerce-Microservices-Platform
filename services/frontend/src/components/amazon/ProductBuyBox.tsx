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
} from "lucide-react";
import { Product } from "@/types";
import { useStore } from "@/providers/StoreContext";
import { AnimeButton } from "@/components/anime/AnimeButton";

interface ProductBuyBoxProps {
  product: Product;
}

export function ProductBuyBox({ product }: ProductBuyBoxProps) {
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

  // Calculate simulated Amazon list price (15% higher)
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
          <p className="text-xs text-emerald-400 font-semibold mt-0.5">
            Save {formattedSavings} (15% off) with Prime
          </p>
        </div>

        {/* Prime & Delivery Estimator */}
        <div className="space-y-2 mb-5 pb-5 border-b border-white/10 text-xs">
          <div className="flex items-center gap-1.5 font-bold text-cyan-400">
            <Zap className="h-4 w-4 fill-cyan-400 text-cyan-400" />
            <span>FREE Prime Next-Day Delivery</span>
          </div>
          <p className="text-slate-300">
            Order within <span className="font-bold text-amber-400">4 hrs 18 mins</span> for delivery tomorrow to{" "}
            <span className="font-bold text-white">{location.city} {location.zipCode}</span>.
          </p>
          <div className="flex items-center gap-1 text-[11px] text-slate-400">
            <Truck className="h-3.5 w-3.5 text-slate-400" />
            <span>Ships directly from EcoPrime Fulfillment Center</span>
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
                <CheckCircle2 className="h-4 w-4" /> In Stock & Ready to Ship
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
              className="bg-slate-800 border border-white/10 text-white rounded-xl px-3 py-1.5 text-xs font-bold focus:ring-2 focus:ring-amber-400 cursor-pointer"
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
            className="w-full py-3 px-4 rounded-full bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-bold text-xs shadow-lg shadow-amber-500/20 flex items-center justify-center gap-2 transition-all disabled:opacity-50 cursor-pointer"
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
            className="w-full py-3 px-4 rounded-full bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-500 hover:to-amber-500 text-white font-bold text-xs shadow-lg shadow-orange-600/20 flex items-center justify-center gap-2 transition-all disabled:opacity-50 cursor-pointer"
          >
            <Zap className="h-4 w-4 fill-white" /> Buy Now (1-Click)
          </button>
        </div>

        {/* Gift Checkbox */}
        <label className="flex items-center gap-2 text-xs text-slate-300 mb-5 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={isGift}
            onChange={(e) => setIsGift(e.target.checked)}
            className="rounded border-white/20 bg-slate-800 text-amber-500 focus:ring-amber-400"
          />
          <Gift className="h-3.5 w-3.5 text-amber-400" />
          <span>Add gift options at checkout</span>
        </label>
      </div>

      {/* Trust & Guarantee Badges */}
      <div className="pt-4 border-t border-white/10 space-y-2 text-[11px] text-slate-400">
        <div className="flex justify-between">
          <span>Ships from</span>
          <span className="font-semibold text-slate-200">EcoPrime Logistics</span>
        </div>
        <div className="flex justify-between">
          <span>Sold by</span>
          <span className="font-semibold text-slate-200">EcoMicro Direct</span>
        </div>
        <div className="flex items-center gap-1.5 text-slate-300 pt-1">
          <RotateCcw className="h-3.5 w-3.5 text-indigo-400" />
          <span>30-Day Return / Replacement Guarantee</span>
        </div>
        <div className="flex items-center gap-1.5 text-slate-300">
          <Lock className="h-3.5 w-3.5 text-emerald-400" />
          <span>Secure Transaction Encrypted</span>
        </div>
      </div>
    </div>
  );
}
