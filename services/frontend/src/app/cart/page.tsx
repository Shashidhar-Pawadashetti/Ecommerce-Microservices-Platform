"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Cart } from "@/types";
import { ShoppingCart, ArrowLeft, Trash2, Plus, Minus, Loader2 } from "lucide-react";

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
        // Use DELETE when quantity drops to 0
        const res = await fetch(`/api/gateway/cart/items/${productId}`, {
          method: "DELETE",
        });
        if (!res.ok) throw new Error("Failed to remove item");
        return;
      }

      // Use PATCH for updating absolute quantity
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
        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
        <p className="text-neutral-500">Loading your cart...</p>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="container mx-auto p-8 max-w-md text-center min-h-[60vh] flex flex-col items-center justify-center">
        <div className="bg-neutral-100 dark:bg-neutral-800 p-4 rounded-full mb-4">
          <ShoppingCart className="h-8 w-8 text-neutral-400" />
        </div>
        <h1 className="text-2xl font-bold mb-2">Your Cart</h1>
        <p className="text-neutral-500 mb-6">Please log in to view and manage your cart.</p>
        <Link
          href="/login"
          className="bg-blue-600 text-white px-6 py-2.5 rounded-full font-medium hover:bg-blue-700 transition"
        >
          Login to Account
        </Link>
      </div>
    );
  }

  const isPending =
    updateQuantityMutation.isPending ||
    removeItemMutation.isPending ||
    clearCartMutation.isPending;

  return (
    <div className="container mx-auto px-4 md:px-6 py-8 max-w-4xl min-h-[calc(100vh-4rem)]">
      <header className="flex justify-between items-center mb-8">
        <div>
          <Link
            href="/"
            className="inline-flex items-center text-sm text-neutral-500 hover:text-blue-600 mb-2 transition-colors"
          >
            <ArrowLeft className="h-4 w-4 mr-1" /> Continue Shopping
          </Link>
          <h1 className="text-3xl font-extrabold tracking-tight">Shopping Cart</h1>
        </div>

        {cart && cart.items && cart.items.length > 0 && (
          <button
            onClick={() => clearCartMutation.mutate()}
            disabled={isPending}
            className="inline-flex items-center gap-1 text-sm text-neutral-500 hover:text-red-600 transition-colors disabled:opacity-50"
          >
            <Trash2 className="h-4 w-4" /> Clear Cart
          </button>
        )}
      </header>

      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 p-4 rounded-xl border border-red-200 dark:border-red-800 mb-6 text-sm">
          {error}
        </div>
      )}

      {!cart || !cart.items || cart.items.length === 0 ? (
        <div className="text-center py-16 bg-neutral-50 dark:bg-neutral-900 rounded-3xl border border-dashed border-neutral-200 dark:border-neutral-800">
          <ShoppingCart className="h-12 w-12 text-neutral-400 mx-auto mb-4" />
          <h2 className="text-xl font-bold mb-2">Your cart is empty</h2>
          <p className="text-neutral-500 mb-6">Looks like you haven't added anything to your cart yet.</p>
          <Link
            href="/"
            className="inline-flex items-center justify-center rounded-full bg-blue-600 px-6 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-blue-700 transition-all"
          >
            Browse Products
          </Link>
        </div>
      ) : (
        <div className="bg-white dark:bg-neutral-900 rounded-3xl border border-neutral-200 dark:border-neutral-800 shadow-sm overflow-hidden p-6 md:p-8">
          <div className="divide-y divide-neutral-100 dark:divide-neutral-800">
            {cart.items.map((item) => (
              <div
                key={item.productId}
                className="py-5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4"
              >
                <div className="flex-1">
                  <h3 className="font-bold text-lg text-neutral-900 dark:text-white">
                    {item.name || `Product #${item.productId}`}
                  </h3>
                  <p className="text-sm text-neutral-500 mt-0.5">
                    {((item.unitPriceCents || 0) / 100).toLocaleString("en-US", {
                      style: "currency",
                      currency: cart.currency || "USD",
                    })}{" "}
                    each
                  </p>
                </div>

                <div className="flex items-center justify-between w-full sm:w-auto gap-6">
                  {/* Quantity Counter */}
                  <div className="flex items-center border border-neutral-200 dark:border-neutral-700 rounded-full bg-neutral-50 dark:bg-neutral-800 p-1">
                    <button
                      disabled={isPending}
                      onClick={() =>
                        updateQuantityMutation.mutate({
                          productId: item.productId,
                          quantity: item.quantity - 1,
                        })
                      }
                      className="p-1.5 rounded-full hover:bg-white dark:hover:bg-neutral-700 transition disabled:opacity-40"
                    >
                      <Minus className="h-3.5 w-3.5" />
                    </button>
                    <span className="w-8 text-center text-sm font-semibold">{item.quantity}</span>
                    <button
                      disabled={isPending}
                      onClick={() =>
                        updateQuantityMutation.mutate({
                          productId: item.productId,
                          quantity: item.quantity + 1,
                        })
                      }
                      className="p-1.5 rounded-full hover:bg-white dark:hover:bg-neutral-700 transition disabled:opacity-40"
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </button>
                  </div>

                  {/* Line Total */}
                  <span className="font-bold text-lg min-w-[5rem] text-right text-neutral-900 dark:text-white">
                    {((item.lineTotalCents || item.unitPriceCents * item.quantity || 0) / 100).toLocaleString("en-US", {
                      style: "currency",
                      currency: cart.currency || "USD",
                    })}
                  </span>

                  {/* Remove Button */}
                  <button
                    disabled={isPending}
                    onClick={() => removeItemMutation.mutate(item.productId)}
                    className="text-neutral-400 hover:text-red-600 transition p-1 disabled:opacity-40"
                    title="Remove item"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-8 pt-6 border-t border-neutral-200 dark:border-neutral-800 flex flex-col sm:flex-row justify-between items-center gap-6">
            <div>
              <p className="text-sm text-neutral-500">Estimated Total</p>
              <p className="text-3xl font-extrabold text-neutral-900 dark:text-white">
                {((cart.grandTotalCents || 0) / 100).toLocaleString("en-US", {
                  style: "currency",
                  currency: cart.currency || "USD",
                })}
              </p>
            </div>

            <Link
              href="/checkout"
              className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white px-8 py-3.5 rounded-full font-bold text-center shadow-lg shadow-blue-600/30 transition active:scale-95"
            >
              Proceed to Checkout
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
