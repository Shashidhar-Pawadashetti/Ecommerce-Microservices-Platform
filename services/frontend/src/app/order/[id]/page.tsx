"use client";

import { useQuery } from "@tanstack/react-query";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useEffect, useState } from "react";
import { OrderSnapshot } from "@/types";
import { ArrowLeft, CheckCircle2, Clock, XCircle, Loader2, Package, Radio, Sparkles } from "lucide-react";
import { PageWrapper } from "@/components/anime/PageWrapper";
import { AnimeButton } from "@/components/anime/AnimeButton";

export default function OrderStatusPage() {
  const { id } = useParams();
  const [shouldPoll, setShouldPoll] = useState(true);

  const { data: order, isLoading, error } = useQuery<OrderSnapshot>({
    queryKey: ["order", id],
    queryFn: async () => {
      const res = await fetch(`/api/gateway/orders/${id}`);
      if (!res.ok) {
        throw new Error("Order not found or unauthorized");
      }
      return res.json();
    },
    enabled: !!id,
    refetchInterval: shouldPoll ? 2000 : false,
  });

  // Stop polling once the order reaches a terminal state (PAID or PAYMENT_FAILED)
  useEffect(() => {
    if (
      order &&
      (order.status === "PAID" ||
        order.status === "PAYMENT_FAILED" ||
        order.status === "CANCELLED" ||
        order.status === "FAILED")
    ) {
      setShouldPoll(false);
    }
  }, [order]);

  if (isLoading) {
    return (
      <div className="container mx-auto p-8 flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <Loader2 className="h-10 w-10 animate-spin text-cyan-400" />
        <p className="text-slate-400 text-sm font-semibold">Retrieving order details from PostgreSQL...</p>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="container mx-auto p-8 max-w-md text-center min-h-[60vh] flex flex-col items-center justify-center">
        <div className="glass-panel border border-rose-500/30 bg-rose-950/20 text-rose-300 p-8 rounded-3xl mb-6">
          <p className="font-bold text-lg mb-1">Error Loading Order</p>
          <p className="text-xs text-rose-400">{(error as Error)?.message || "Order not found"}</p>
        </div>
        <Link href="/">
          <AnimeButton variant="secondary">Return to Catalog</AnimeButton>
        </Link>
      </div>
    );
  }

  const isPending = order.status === "PENDING_PAYMENT";
  const isPaid = order.status === "PAID";
  const isFailed = order.status === "PAYMENT_FAILED" || order.status === "FAILED" || order.status === "CANCELLED";

  return (
    <PageWrapper
      title="Order Details"
      badge={`Status: ${order.status}`}
      description="Live order lifecycle tracking powered by Kafka KRaft event stream."
      className="max-w-2xl mx-auto px-4 md:px-6 py-8"
    >
      <Link
        href="/orders"
        className="inline-flex items-center text-xs font-bold text-slate-400 hover:text-cyan-400 mb-6 transition-colors gap-1.5"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> View All Orders
      </Link>

      <div className="glass-panel rounded-3xl border border-white/[0.08] shadow-2xl p-6 sm:p-8">
        {/* Status Header */}
        <div className="text-center pb-6 border-b border-white/5">
          <div className="flex justify-center mb-4">
            {isPaid ? (
              <div className="p-4 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 shadow-lg shadow-emerald-500/20">
                <CheckCircle2 className="h-12 w-12" />
              </div>
            ) : isPending ? (
              <div className="p-4 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30 shadow-lg shadow-amber-500/20 animate-pulse">
                <Clock className="h-12 w-12" />
              </div>
            ) : (
              <div className="p-4 rounded-full bg-rose-500/20 text-rose-400 border border-rose-500/30 shadow-lg shadow-rose-500/20">
                <XCircle className="h-12 w-12" />
              </div>
            )}
          </div>

          <h2 className="text-2xl font-black text-white mb-1">
            {isPaid
              ? "Payment Approved & Settled!"
              : isPending
              ? "Authorizing Payment..."
              : "Payment Failed"}
          </h2>
          <p className="text-xs font-mono text-slate-400">ID: {order.orderId}</p>

          <div className="mt-3">
            <span
              className={`inline-block px-3 py-1 text-xs font-bold rounded-full uppercase tracking-wider border ${
                isPaid
                  ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30 shadow-sm shadow-emerald-500/20"
                  : isPending
                  ? "bg-amber-500/10 text-amber-400 border-amber-500/30 shadow-sm shadow-amber-500/20 animate-pulse"
                  : "bg-rose-500/10 text-rose-400 border-rose-500/30"
              }`}
            >
              {order.status}
            </span>
          </div>
        </div>

        {/* Kafka Processing Notice */}
        {isPending && (
          <div className="my-6 p-4 rounded-2xl glass-card border border-amber-500/30 text-xs text-amber-300 flex items-center gap-3">
            <Radio className="h-5 w-5 animate-pulse text-amber-400 shrink-0" />
            <div>
              <p className="font-bold">Kafka Payment Saga In Progress</p>
              <p className="text-slate-400 text-[11px] mt-0.5">
                The FastAPI payment worker is processing authorization via Kafka KRaft. This view auto-refreshes.
              </p>
            </div>
          </div>
        )}

        {/* Ordered items snapshot */}
        {order.items && order.items.length > 0 && (
          <div className="my-6">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-1.5">
              <Package className="h-4 w-4" /> Purchased Items
            </h3>
            <div className="divide-y divide-white/5 glass-card rounded-2xl p-4 border border-white/5">
              {order.items.map((item, idx) => (
                <div key={idx} className="py-2.5 first:pt-0 last:pb-0 flex justify-between items-center text-xs">
                  <div>
                    <span className="font-bold text-white">
                      {item.nameSnapshot || item.name || `Product #${item.productId}`}
                    </span>
                    <span className="text-slate-400 ml-2">× {item.quantity}</span>
                  </div>
                  <span className="font-bold text-slate-200">
                    {(((item.unitPriceCents || 0) * (item.quantity || 1)) / 100).toLocaleString("en-US", {
                      style: "currency",
                      currency: order.currency || "USD",
                    })}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Summary Details */}
        <div className="space-y-3 py-4 border-t border-white/5 text-xs">
          <div className="flex justify-between">
            <span className="text-slate-400">Order Timestamp</span>
            <span className="font-bold text-white">
              {new Date(order.createdAt).toLocaleString()}
            </span>
          </div>
          <div className="flex justify-between items-center text-sm font-bold pt-3 border-t border-white/5">
            <span className="text-slate-300">Total Charged</span>
            <span className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-cyan-300 via-indigo-200 to-pink-300">
              {((order.totalCents || 0) / 100).toLocaleString("en-US", {
                style: "currency",
                currency: order.currency || "USD",
              })}
            </span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
          <Link href="/">
            <AnimeButton variant="primary" className="w-full sm:w-auto">
              Continue Shopping
            </AnimeButton>
          </Link>
          <Link href="/orders">
            <AnimeButton variant="secondary" className="w-full sm:w-auto">
              View All Orders
            </AnimeButton>
          </Link>
        </div>
      </div>
    </PageWrapper>
  );
}
