"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useState } from "react";
import Link from "next/link";
import { Cart } from "@/types";
import { ArrowLeft, ShieldCheck, Loader2, Zap, Radio, CheckCircle2 } from "lucide-react";
import { PageWrapper } from "@/components/anime/PageWrapper";
import { AnimeButton } from "@/components/anime/AnimeButton";

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
      router.push(`/order/${data.orderId}`);
    },
    onError: (err: any) => {
      setError(err.message || "Checkout failed. Please try again.");
    },
  });

  if (isLoading) {
    return (
      <div className="container mx-auto p-8 flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <Loader2 className="h-10 w-10 animate-spin text-cyan-400" />
        <p className="text-slate-400 text-sm font-semibold">Preparing transactional checkout...</p>
      </div>
    );
  }

  if (!cart || !cart.items || cart.items.length === 0) {
    return (
      <div className="container mx-auto p-8 max-w-md text-center min-h-[60vh] flex flex-col items-center justify-center">
        <div className="glass-panel p-8 rounded-3xl w-full border border-white/10">
          <h2 className="text-xl font-bold text-white mb-2">Your cart is empty</h2>
          <p className="text-slate-400 text-xs mb-6">Add products before proceeding to checkout.</p>
          <Link href="/">
            <AnimeButton variant="primary">Return to Catalog</AnimeButton>
          </Link>
        </div>
      </div>
    );
  }

  const formattedTotal = ((cart.grandTotalCents || 0) / 100).toLocaleString("en-US", {
    style: "currency",
    currency: cart.currency || "USD",
  });

  return (
    <PageWrapper
      title="Complete Your Order"
      badge="Transactional Outbox Saga"
      description="Your order creates a dual-write PostgreSQL record and initiates asynchronous payment choreography."
      className="max-w-2xl mx-auto px-4 md:px-6 py-8"
    >
      <Link
        href="/cart"
        className="inline-flex items-center text-xs font-bold text-slate-400 hover:text-cyan-400 mb-6 transition-colors gap-1.5"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Return to Cart
      </Link>

      {error && (
        <div className="glass-panel border border-rose-500/30 bg-rose-950/20 text-rose-300 p-4 rounded-2xl mb-6 text-xs font-semibold">
          {error}
        </div>
      )}

      {/* Order Summary Card */}
      <div className="glass-panel rounded-3xl p-6 sm:p-8 border border-white/[0.08] shadow-2xl mb-6">
        <div className="flex items-center gap-2 mb-6">
          <div className="p-2 rounded-xl bg-indigo-500/20 text-indigo-400">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <h2 className="text-lg font-bold text-white">Order Summary</h2>
        </div>

        <div className="divide-y divide-white/5 mb-6">
          {cart.items.map((item) => (
            <div key={item.productId} className="py-4 flex justify-between items-center gap-4">
              <div>
                <p className="font-bold text-sm text-white">
                  {item.name || `Product #${item.productId}`}
                </p>
                <p className="text-xs text-slate-400 mt-0.5">
                  Qty: {item.quantity} × {((item.unitPriceCents || 0) / 100).toLocaleString("en-US", {
                    style: "currency",
                    currency: cart.currency || "USD",
                  })}
                </p>
              </div>
              <span className="font-bold text-sm text-slate-200">
                {((item.lineTotalCents || (item.unitPriceCents * item.quantity) || 0) / 100).toLocaleString("en-US", {
                  style: "currency",
                  currency: cart.currency || "USD",
                })}
              </span>
            </div>
          ))}
        </div>

        <div className="flex justify-between items-center pt-6 border-t border-white/10">
          <span className="text-sm font-semibold text-slate-300">Total Payable</span>
          <span className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-cyan-300 via-indigo-200 to-pink-300">
            {formattedTotal}
          </span>
        </div>
      </div>

      {/* Event Saga Demo Notice */}
      <div className="glass-card p-4 rounded-2xl border border-indigo-500/30 mb-8 flex items-start gap-3">
        <Radio className="h-5 w-5 text-indigo-400 shrink-0 mt-0.5 animate-pulse" />
        <div>
          <p className="text-xs font-bold text-indigo-300 mb-1">
            Asynchronous Kafka Choreography
          </p>
          <p className="text-[11px] text-slate-400 leading-relaxed">
            Placing this order emits an <code>order.created</code> Kafka event. The FastAPI Payment Service idempotently authorizes payment and transitions the state to <code>PAID</code>.
          </p>
        </div>
      </div>

      {/* Action Footer */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        <Link
          href="/cart"
          className="text-xs font-bold text-slate-400 hover:text-white transition-colors"
        >
          Edit Cart
        </Link>
        <AnimeButton
          onClick={() => checkoutMutation.mutate()}
          disabled={checkoutMutation.isPending}
          variant="primary"
          size="lg"
          className="w-full sm:w-auto min-w-[200px]"
        >
          {checkoutMutation.isPending ? (
            <>
              <Loader2 className="h-5 w-5 animate-spin" /> Processing Saga...
            </>
          ) : (
            `Place Order • ${formattedTotal}`
          )}
        </AnimeButton>
      </div>
    </PageWrapper>
  );
}
