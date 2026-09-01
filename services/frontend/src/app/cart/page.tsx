"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Cart, CartItem } from "@/types";
import {
  ShoppingCart,
  ArrowLeft,
  Trash2,
  Plus,
  Minus,
  Loader2,
  ArrowRight,
  Sparkles,
  Heart,
  Gift,
  CheckCircle2,
  ShieldCheck,
  Zap,
} from "lucide-react";
import { PageWrapper } from "@/components/anime/PageWrapper";
import { AnimeButton } from "@/components/anime/AnimeButton";
import { AnimeStagger } from "@/components/anime/AnimeStagger";
import { useStore } from "@/providers/StoreContext";

export default function CartPage() {
  const queryClient = useQueryClient();
  const router = useRouter();
  const { savedForLater, saveForLater, removeFromSavedForLater, showToast } = useStore();
  const [error, setError] = useState("");
  const [isGift, setIsGift] = useState(false);

  const { data: cart, isLoading, isError } = useQuery<Cart>({
    queryKey: ["cart"],
    queryFn: async () => {
      const res = await fetch("/api/gateway/cart");
      if (res.status === 401) {
        throw new Error("UNAUTHORIZED");
      }
      if (!res.ok) {
        throw new Error("Failed to fetch cart");
      }
      return res.json();
    },
    retry: false,
  });

  const updateQuantityMutation = useMutation({
    mutationFn: async ({ productId, quantity }: { productId: string; quantity: number }) => {
      setError("");
      if (quantity <= 0) {
        const res = await fetch(`/api/gateway/cart/items/${productId}`, {
          method: "DELETE",
        });
        if (!res.ok) throw new Error("Failed to remove item");
        return;
      }

      const res = await fetch(`/api/gateway/cart/items/${productId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ quantity }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || "Failed to update quantity");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cart"] });
    },
    onError: (err: any) => {
      setError(err.message || "Failed to update item quantity");
    },
  });

  const removeItemMutation = useMutation({
    mutationFn: async (productId: string) => {
      setError("");
      const res = await fetch(`/api/gateway/cart/items/${productId}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to remove item");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cart"] });
    },
    onError: (err: any) => {
      setError(err.message || "Failed to remove item");
    },
  });

  const clearCartMutation = useMutation({
    mutationFn: async () => {
      setError("");
      const res = await fetch(`/api/gateway/cart`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to clear cart");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cart"] });
    },
    onError: (err: any) => {
      setError(err.message || "Failed to clear cart");
    },
  });

  const handleSaveForLater = (item: CartItem) => {
    saveForLater(item);
    removeItemMutation.mutate(item.productId);
  };

  const handleMoveToCart = async (item: CartItem) => {
    try {
      await fetch(`/api/gateway/cart/items`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId: item.productId, quantity: 1 }),
      });
      removeFromSavedForLater(item.productId);
      queryClient.invalidateQueries({ queryKey: ["cart"] });
      showToast({
        title: "Moved to Cart",
        productName: item.name,
        priceCents: item.unitPriceCents,
        quantity: 1,
        cartTotalCents: (cart?.grandTotalCents || 0) + item.unitPriceCents,
        currency: cart?.currency || "USD",
      });
    } catch (e) {}
  };

  if (isLoading) {
    return (
      <div className="container mx-auto p-8 flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <Loader2 className="h-10 w-10 animate-spin text-cyan-400" />
        <p className="text-slate-400 text-sm font-semibold">Loading Redis Cart...</p>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="container mx-auto p-8 max-w-md text-center min-h-[60vh] flex flex-col items-center justify-center">
        <div className="glass-panel border border-white/10 p-8 rounded-3xl w-full flex flex-col items-center">
          <div className="p-4 rounded-full bg-cyan-500/10 text-cyan-400 mb-4">
            <ShoppingCart className="h-8 w-8" />
          </div>
          <h1 className="text-2xl font-black text-white mb-2">Your Shopping Cart</h1>
          <p className="text-slate-400 text-xs mb-6">
            Please sign in to sync your in-memory Redis cart items.
          </p>
          <Link href="/login" className="w-full">
            <AnimeButton variant="primary" className="w-full">
              Sign In to Account
            </AnimeButton>
          </Link>
        </div>
      </div>
    );
  }

  const isPending =
    updateQuantityMutation.isPending ||
    removeItemMutation.isPending ||
    clearCartMutation.isPending;

  const totalItemsCount =
    cart?.items?.reduce((acc, item) => acc + (item.quantity || 1), 0) || 0;

  const freeShippingThresholdCents = 3500;
  const currentTotalCents = cart?.grandTotalCents || 0;
  const freeShippingProgress = Math.min(
    100,
    (currentTotalCents / freeShippingThresholdCents) * 100
  );
  const remainingForFreeShipping = Math.max(
    0,
    freeShippingThresholdCents - currentTotalCents
  );

  return (
    <PageWrapper className="max-w-6xl mx-auto px-4 md:px-6 py-8">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <Link
          href="/"
          className="inline-flex items-center text-xs font-bold text-slate-400 hover:text-cyan-400 transition-colors gap-1"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Continue Shopping
        </Link>

        {cart && cart.items && cart.items.length > 0 && (
          <button
            onClick={() => clearCartMutation.mutate()}
            disabled={isPending}
            className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-400 hover:text-rose-400 transition-colors disabled:opacity-50 cursor-pointer"
          >
            <Trash2 className="h-3.5 w-3.5" /> Deselect all items
          </button>
        )}
      </div>

      {error && (
        <div className="glass-panel border border-rose-500/30 bg-rose-950/20 text-rose-300 p-4 rounded-2xl mb-6 text-xs font-semibold">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Main Cart Items Section */}
        <div className="lg:col-span-8">
          <div className="glass-panel rounded-3xl p-6 sm:p-8 border border-white/[0.08] shadow-2xl">
            <h1 className="text-2xl font-black text-white mb-2">Shopping Cart</h1>

            {/* Free Shipping Progress Bar */}
            <div className="p-4 rounded-2xl bg-slate-800/80 border border-white/5 my-4">
              {remainingForFreeShipping === 0 ? (
                <p className="text-xs font-bold text-emerald-400 flex items-center gap-1.5 mb-2">
                  <CheckCircle2 className="h-4 w-4" /> Your order qualifies for FREE Nexora Express Delivery!
                </p>
              ) : (
                <p className="text-xs text-slate-300 mb-2">
                  Add <strong className="text-cyan-400">${(remainingForFreeShipping / 100).toFixed(2)}</strong> of eligible items to get <strong className="text-white">FREE Express Delivery</strong>.
                </p>
              )}
              <div className="w-full h-2 rounded-full bg-slate-900 overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-cyan-500 to-indigo-500 rounded-full transition-all duration-500"
                  style={{ width: `${freeShippingProgress}%` }}
                />
              </div>
            </div>

            {!cart || !cart.items || cart.items.length === 0 ? (
              <div className="text-center py-12 border-t border-white/5">
                <p className="text-base font-bold text-white mb-1">Your Nexora Cart is empty</p>
                <p className="text-xs text-slate-400 mb-6">
                  Check out today&apos;s recommendations or items you saved for later.
                </p>
                <Link href="/">
                  <AnimeButton variant="primary">Shop today&apos;s deals</AnimeButton>
                </Link>
              </div>
            ) : (
              <AnimeStagger className="divide-y divide-white/5 mt-4" delay={100} staggerDelay={50}>
                {cart.items.map((item) => (
                  <div
                    key={item.productId}
                    className="anime-stagger-item py-5 flex flex-col sm:flex-row justify-between items-start gap-4"
                  >
                    <div className="flex items-start gap-4 flex-1">
                      <div className="p-3.5 rounded-2xl bg-slate-800 border border-white/5 text-cyan-400 shrink-0">
                        <ShoppingCart className="h-7 w-7" />
                      </div>
                      <div>
                        <h3 className="font-bold text-sm text-white">{item.name || `Product #${item.productId}`}</h3>
                        <p className="text-xs text-emerald-400 font-semibold mt-0.5">In Stock</p>
                        <p className="text-[11px] text-slate-400 mt-1">Eligible for FREE Express Delivery</p>

                        {/* Actions Row */}
                        <div className="flex flex-wrap items-center gap-3 mt-3 text-xs text-slate-400">
                          {/* Quantity Dropdown */}
                          <div className="flex items-center border border-white/10 rounded-xl bg-slate-900 px-2 py-1">
                            <span className="text-[11px] text-slate-400 mr-1.5">Qty:</span>
                            <select
                              value={item.quantity}
                              onChange={(e) =>
                                updateQuantityMutation.mutate({
                                  productId: item.productId,
                                  quantity: parseInt(e.target.value),
                                })
                              }
                              className="bg-transparent text-white font-bold focus:outline-none cursor-pointer text-xs"
                            >
                              {[...Array(10)].map((_, idx) => (
                                <option key={idx + 1} value={idx + 1} className="bg-slate-900 text-white">
                                  {idx + 1}
                                </option>
                              ))}
                            </select>
                          </div>

                          <span className="text-slate-700">|</span>

                          <button
                            onClick={() => removeItemMutation.mutate(item.productId)}
                            className="hover:text-rose-400 transition-colors cursor-pointer"
                          >
                            Delete
                          </button>

                          <span className="text-slate-700">|</span>

                          <button
                            onClick={() => handleSaveForLater(item)}
                            className="hover:text-cyan-400 transition-colors cursor-pointer"
                          >
                            Save for later
                          </button>
                        </div>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <p className="font-black text-lg text-white">
                        {((item.lineTotalCents || item.unitPriceCents * item.quantity || 0) / 100).toLocaleString("en-US", {
                          style: "currency",
                          currency: cart.currency || "USD",
                        })}
                      </p>
                      <p className="text-[10px] text-slate-400">
                        {((item.unitPriceCents || 0) / 100).toLocaleString("en-US", {
                          style: "currency",
                          currency: cart.currency || "USD",
                        })}{" "}
                        each
                      </p>
                    </div>
                  </div>
                ))}
              </AnimeStagger>
            )}
          </div>

          {/* ── SAVED FOR LATER SECTION ── */}
          <div className="glass-panel rounded-3xl p-6 sm:p-8 border border-white/[0.08] shadow-2xl mt-8">
            <div className="flex items-center gap-2 mb-4">
              <Heart className="h-5 w-5 text-pink-400" />
              <h2 className="text-lg font-bold text-white">
                Saved for later ({savedForLater.length} items)
              </h2>
            </div>

            {savedForLater.length === 0 ? (
              <p className="text-xs text-slate-400">
                No items saved for later. Click &quot;Save for later&quot; on any item in your cart.
              </p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {savedForLater.map((item) => (
                  <div
                    key={item.productId}
                    className="p-4 rounded-2xl glass-card border border-white/5 flex flex-col justify-between"
                  >
                    <div>
                      <p className="font-bold text-xs text-white truncate">{item.name}</p>
                      <p className="text-xs font-black text-cyan-400 mt-1">
                        {((item.unitPriceCents || 0) / 100).toLocaleString("en-US", {
                          style: "currency",
                          currency: cart?.currency || "USD",
                        })}
                      </p>
                    </div>
                    <div className="flex gap-2 mt-4">
                      <button
                        onClick={() => handleMoveToCart(item)}
                        className="flex-1 py-1.5 rounded-full bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-[11px] transition-colors"
                      >
                        Move to cart
                      </button>
                      <button
                        onClick={() => removeFromSavedForLater(item.productId)}
                        className="px-3 py-1.5 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-400 text-[11px]"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Checkout Summary Box */}
        {cart && cart.items && cart.items.length > 0 && (
          <div className="lg:col-span-4">
            <div className="glass-panel bg-slate-900/90 rounded-3xl p-6 border border-white/[0.08] shadow-2xl space-y-5">
              <div className="pb-4 border-b border-white/10">
                <div className="flex items-center gap-1.5 text-xs text-emerald-400 font-bold mb-2">
                  <CheckCircle2 className="h-4 w-4" /> Part of your order qualifies for FREE Delivery.
                </div>
                <div className="flex items-baseline justify-between">
                  <span className="text-xs text-slate-300">
                    Subtotal ({totalItemsCount} item{totalItemsCount !== 1 ? "s" : ""}):
                  </span>
                  <span className="text-2xl font-black text-white">
                    {((cart.grandTotalCents || 0) / 100).toLocaleString("en-US", {
                      style: "currency",
                      currency: cart.currency || "USD",
                    })}
                  </span>
                </div>
              </div>

              {/* Gift Option Checkbox */}
              <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={isGift}
                  onChange={(e) => setIsGift(e.target.checked)}
                  className="rounded border-white/20 bg-slate-800 text-cyan-500 focus:ring-cyan-400"
                />
                <Gift className="h-3.5 w-3.5 text-pink-400" />
                <span>This order contains gift packaging</span>
              </label>

              <Link href="/checkout" className="block w-full">
                <AnimeButton size="lg" variant="primary" className="w-full shadow-cyan-500/20">
                  Proceed to Checkout <ArrowRight className="h-4 w-4" />
                </AnimeButton>
              </Link>

              <div className="pt-4 border-t border-white/10 flex items-center justify-center gap-2 text-[11px] text-slate-400">
                <ShieldCheck className="h-4 w-4 text-emerald-400" />
                <span>Nexora 256-Bit SSL Encrypted Checkout</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </PageWrapper>
  );
}
