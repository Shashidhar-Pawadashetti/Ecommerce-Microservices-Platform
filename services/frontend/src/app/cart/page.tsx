"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Cart } from "@/types";
import { ShoppingCart, ArrowLeft, Trash2, Plus, Minus, Loader2, ArrowRight, Sparkles } from "lucide-react";
import { PageWrapper } from "@/components/anime/PageWrapper";
import { AnimeButton } from "@/components/anime/AnimeButton";
import { AnimeStagger } from "@/components/anime/AnimeStagger";

export default function CartPage() {
  const queryClient = useQueryClient();
  const router = useRouter();
  const [error, setError] = useState("");

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
          <div className="p-4 rounded-full bg-indigo-500/10 text-indigo-400 mb-4">
            <ShoppingCart className="h-8 w-8" />
          </div>
          <h1 className="text-2xl font-black text-white mb-2">Your Shopping Cart</h1>
          <p className="text-slate-400 text-xs mb-6">
            Please log in to your account to view and synchronize your cart items.
          </p>
          <Link href="/login" className="w-full">
            <AnimeButton variant="primary" className="w-full">
              Login to Account
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

  return (
    <PageWrapper
      title="Your Shopping Cart"
      badge="Express & Redis 8 In-Memory"
      description="Live prices validated against the Catalog microservice with real-time TTL expiration."
      className="max-w-4xl mx-auto px-4 md:px-6 py-8"
    >
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
            <Trash2 className="h-3.5 w-3.5" /> Clear Cart
          </button>
        )}
      </div>

      {error && (
        <div className="glass-panel border border-rose-500/30 bg-rose-950/20 text-rose-300 p-4 rounded-2xl mb-6 text-xs font-semibold">
          {error}
        </div>
      )}

      {!cart || !cart.items || cart.items.length === 0 ? (
        <div className="text-center py-16 glass-panel rounded-3xl border border-dashed border-slate-800">
          <div className="p-4 rounded-full bg-slate-800/80 text-slate-400 w-fit mx-auto mb-4">
            <ShoppingCart className="h-8 w-8" />
          </div>
          <h2 className="text-xl font-bold text-white mb-2">Your cart is empty</h2>
          <p className="text-slate-400 text-xs mb-6 max-w-sm mx-auto">
            Discover products in the catalog and add them to your cart.
          </p>
          <Link href="/">
            <AnimeButton variant="primary">Browse Catalog</AnimeButton>
          </Link>
        </div>
      ) : (
        <div className="glass-panel rounded-3xl border border-white/[0.08] shadow-2xl p-6 sm:p-8">
          <AnimeStagger className="divide-y divide-white/5" delay={100} staggerDelay={50}>
            {cart.items.map((item) => (
              <div
                key={item.productId}
                className="anime-stagger-item py-5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4"
              >
                <div className="flex-1">
                  <h3 className="font-bold text-base text-white">
                    {item.name || `Product #${item.productId}`}
                  </h3>
                  <p className="text-xs text-slate-400 mt-1">
                    {((item.unitPriceCents || 0) / 100).toLocaleString("en-US", {
                      style: "currency",
                      currency: cart.currency || "USD",
                    })}{" "}
                    each
                  </p>
                </div>

                <div className="flex items-center justify-between w-full sm:w-auto gap-6">
                  {/* Quantity Control Pill */}
                  <div className="flex items-center border border-white/10 rounded-full bg-slate-900/80 p-1">
                    <button
                      disabled={isPending}
                      onClick={() =>
                        updateQuantityMutation.mutate({
                          productId: item.productId,
                          quantity: item.quantity - 1,
                        })
                      }
                      className="p-1.5 rounded-full hover:bg-white/10 text-slate-300 transition disabled:opacity-40 cursor-pointer"
                    >
                      <Minus className="h-3.5 w-3.5" />
                    </button>
                    <span className="w-8 text-center text-xs font-bold text-white">
                      {item.quantity}
                    </span>
                    <button
                      disabled={isPending}
                      onClick={() =>
                        updateQuantityMutation.mutate({
                          productId: item.productId,
                          quantity: item.quantity + 1,
                        })
                      }
                      className="p-1.5 rounded-full hover:bg-white/10 text-slate-300 transition disabled:opacity-40 cursor-pointer"
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </button>
                  </div>

                  {/* Line Total */}
                  <span className="font-black text-base min-w-[5rem] text-right text-transparent bg-clip-text bg-gradient-to-r from-white via-cyan-200 to-indigo-300">
                    {((item.lineTotalCents || item.unitPriceCents * item.quantity || 0) / 100).toLocaleString("en-US", {
                      style: "currency",
                      currency: cart.currency || "USD",
                    })}
                  </span>

                  {/* Delete Button */}
                  <button
                    disabled={isPending}
                    onClick={() => removeItemMutation.mutate(item.productId)}
                    className="text-slate-500 hover:text-rose-400 transition p-1.5 rounded-full hover:bg-rose-500/10 disabled:opacity-40 cursor-pointer"
                    title="Remove item"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </AnimeStagger>

          {/* Cart Grand Total & Checkout */}
          <div className="mt-8 pt-6 border-t border-white/10 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6">
            <div>
              <span className="text-xs uppercase font-bold tracking-wider text-slate-400">
                Cart Total
              </span>
              <p className="text-3xl font-black text-white mt-0.5">
                {((cart.grandTotalCents || 0) / 100).toLocaleString("en-US", {
                  style: "currency",
                  currency: cart.currency || "USD",
                })}
              </p>
            </div>

            <Link href="/checkout" className="w-full sm:w-auto">
              <AnimeButton size="lg" variant="primary" className="w-full sm:w-auto">
                Proceed to Checkout <ArrowRight className="h-4 w-4" />
              </AnimeButton>
            </Link>
          </div>
        </div>
      )}
    </PageWrapper>
  );
}
