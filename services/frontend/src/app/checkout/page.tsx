"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useState } from "react";
import Link from "next/link";
import { Cart } from "@/types";
import { ArrowLeft, CheckCircle, ShieldCheck, Loader2 } from "lucide-react";

export default function CheckoutPage() {
  const queryClient = useQueryClient();
  const router = useRouter();
  const [error, setError] = useState("");

  const { data: cart, isLoading } = useQuery<Cart>({
    queryKey: ["cart"],
    queryFn: async () => {
      const res = await fetch("/api/gateway/cart");
      if (!res.ok) throw new Error("Failed to fetch cart");
      return res.json();
    },
  });

  const checkoutMutation = useMutation({
    mutationFn: async () => {
      const idempotencyKey = crypto.randomUUID();

      const res = await fetch(`/api/gateway/orders`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": idempotencyKey,
        },
        body: JSON.stringify({}),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.message || errorData.error || "Failed to create order");
      }
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["cart"] });
      // Redirect to the created order detail page using orderId
      router.push(`/order/${data.orderId}`);
    },
    onError: (err: any) => {
      setError(err.message || "Checkout failed. Please try again.");
    },
  });

  if (isLoading) {
    return (
      <div className="container mx-auto p-8 flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
        <p className="text-neutral-500">Preparing checkout...</p>
      </div>
    );
  }

  if (!cart || !cart.items || cart.items.length === 0) {
    return (
      <div className="container mx-auto p-8 max-w-md text-center min-h-[60vh] flex flex-col items-center justify-center">
        <h2 className="text-2xl font-bold mb-2">Your cart is empty</h2>
        <p className="text-neutral-500 mb-6">Add some products before proceeding to checkout.</p>
        <Link
          href="/"
          className="bg-blue-600 text-white px-6 py-2.5 rounded-full font-medium hover:bg-blue-700 transition"
        >
          Return to Catalog
        </Link>
      </div>
    );
  }

  const formattedTotal = ((cart.grandTotalCents || 0) / 100).toLocaleString("en-US", {
    style: "currency",
    currency: cart.currency || "USD",
  });

  return (
    <div className="container mx-auto px-4 md:px-6 py-8 max-w-2xl min-h-[calc(100vh-4rem)]">
      <Link
        href="/cart"
        className="inline-flex items-center text-sm text-neutral-500 hover:text-blue-600 mb-6 transition-colors"
      >
        <ArrowLeft className="h-4 w-4 mr-1" /> Return to Cart
      </Link>

      <h1 className="text-3xl font-extrabold tracking-tight mb-8">Checkout</h1>

      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 p-4 rounded-xl border border-red-200 dark:border-red-800 mb-6 text-sm">
          {error}
        </div>
      )}

      <div className="bg-white dark:bg-neutral-900 rounded-3xl p-6 md:p-8 shadow-sm border border-neutral-200 dark:border-neutral-800 mb-8">
        <div className="flex items-center gap-2 mb-6">
          <ShieldCheck className="h-5 w-5 text-blue-600 dark:text-blue-400" />
          <h2 className="text-xl font-bold">Order Summary</h2>
        </div>

        <div className="divide-y divide-neutral-100 dark:divide-neutral-800 mb-6">
          {cart.items.map((item) => (
            <div key={item.productId} className="py-4 flex justify-between items-center gap-4">
              <div>
                <p className="font-semibold text-neutral-900 dark:text-white">
                  {item.name || `Product #${item.productId}`}
                </p>
                <p className="text-sm text-neutral-500">
                  Qty: {item.quantity} × {((item.unitPriceCents || 0) / 100).toLocaleString("en-US", {
                    style: "currency",
                    currency: cart.currency || "USD",
                  })}
                </p>
              </div>
              <span className="font-bold text-neutral-900 dark:text-white">
                {((item.lineTotalCents || (item.unitPriceCents * item.quantity) || 0) / 100).toLocaleString("en-US", {
                  style: "currency",
                  currency: cart.currency || "USD",
                })}
              </span>
            </div>
          ))}
        </div>

        <div className="flex justify-between items-center pt-6 border-t border-neutral-200 dark:border-neutral-800 text-xl font-extrabold">
          <span>Total Amount</span>
          <span className="text-blue-600 dark:text-blue-400">{formattedTotal}</span>
        </div>
      </div>

      <div className="bg-blue-50 dark:bg-blue-950/30 p-4 rounded-2xl border border-blue-100 dark:border-blue-900/40 mb-8 text-sm text-blue-900 dark:text-blue-300">
        <p className="flex items-center gap-2 font-semibold mb-1">
          <CheckCircle className="h-4 w-4 text-blue-600 dark:text-blue-400" /> Demo Payment Integration
        </p>
        <p className="text-xs text-blue-800/80 dark:text-blue-400/80">
          When placing the order, payment processing will be simulated automatically via Kafka event bus and order status will update asynchronously.
        </p>
      </div>

      <div className="flex items-center justify-between gap-4">
        <Link
          href="/cart"
          className="text-sm font-medium text-neutral-500 hover:text-neutral-900 dark:hover:text-white transition-colors"
        >
          Edit Cart
        </Link>
        <button
          onClick={() => checkoutMutation.mutate()}
          disabled={checkoutMutation.isPending}
          className="flex-1 max-w-xs bg-blue-600 hover:bg-blue-700 text-white py-3.5 px-6 rounded-full font-bold shadow-lg shadow-blue-600/30 transition-all active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {checkoutMutation.isPending ? (
            <>
              <Loader2 className="h-5 w-5 animate-spin" /> Processing...
            </>
          ) : (
            `Pay ${formattedTotal}`
          )}
        </button>
      </div>
    </div>
  );
}
