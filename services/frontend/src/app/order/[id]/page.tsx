"use client";

import { useQuery } from "@tanstack/react-query";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useEffect, useState } from "react";
import { OrderSnapshot } from "@/types";
import { ArrowLeft, CheckCircle2, Clock, XCircle, Loader2, Package } from "lucide-react";

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
    refetchInterval: shouldPoll ? 2000 : false, // Poll every 2 seconds until terminal state
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
        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
        <p className="text-neutral-500">Loading order details...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto p-8 max-w-md text-center min-h-[60vh] flex flex-col items-center justify-center">
        <div className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 p-6 rounded-2xl border border-red-100 dark:border-red-900/30 mb-6">
          <p className="font-semibold text-lg mb-1">Error Loading Order</p>
          <p className="text-sm">{(error as Error).message}</p>
        </div>
        <Link
          href="/"
          className="bg-blue-600 text-white px-6 py-2.5 rounded-full font-medium hover:bg-blue-700 transition"
        >
          Return to Catalog
        </Link>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="container mx-auto p-8 max-w-md text-center min-h-[60vh] flex flex-col items-center justify-center">
        <p className="text-neutral-500 mb-6">Order not found.</p>
        <Link href="/" className="text-blue-600 hover:underline">
          Return to Catalog
        </Link>
      </div>
    );
  }

  const isPending = order.status === "PENDING_PAYMENT";
  const isPaid = order.status === "PAID";
  const isFailed = order.status === "PAYMENT_FAILED" || order.status === "FAILED" || order.status === "CANCELLED";

  return (
    <div className="container mx-auto px-4 md:px-6 py-8 max-w-2xl min-h-[calc(100vh-4rem)]">
      <Link
        href="/orders"
        className="inline-flex items-center text-sm text-neutral-500 hover:text-blue-600 mb-6 transition-colors"
      >
        <ArrowLeft className="h-4 w-4 mr-1" /> View All Orders
      </Link>

      <div className="bg-white dark:bg-neutral-900 rounded-3xl shadow-sm border border-neutral-200 dark:border-neutral-800 p-6 md:p-8">
        <div className="text-center pb-6 border-b border-neutral-100 dark:border-neutral-800">
          <div className="flex justify-center mb-4">
            {isPaid ? (
              <div className="bg-green-100 dark:bg-green-900/30 p-4 rounded-full text-green-600 dark:text-green-400">
                <CheckCircle2 className="h-12 w-12" />
              </div>
            ) : isPending ? (
              <div className="bg-yellow-100 dark:bg-yellow-900/30 p-4 rounded-full text-yellow-600 dark:text-yellow-400 animate-pulse">
                <Clock className="h-12 w-12" />
              </div>
            ) : (
              <div className="bg-red-100 dark:bg-red-900/30 p-4 rounded-full text-red-600 dark:text-red-400">
                <XCircle className="h-12 w-12" />
              </div>
            )}
          </div>

          <h1 className="text-2xl font-extrabold tracking-tight mb-1">
            {isPaid
              ? "Payment Successful!"
              : isPending
              ? "Processing Payment..."
              : "Payment Failed"}
          </h1>
          <p className="text-sm text-neutral-500">Order ID: {order.orderId}</p>

          <div className="mt-3">
            <span
              className={`inline-block px-3 py-1 text-xs font-bold rounded-full uppercase tracking-wider ${
                isPaid
                  ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
                  : isPending
                  ? "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400"
                  : "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400"
              }`}
            >
              {order.status}
            </span>
          </div>
        </div>

        {isPending && (
          <div className="my-6 p-4 rounded-2xl bg-blue-50 dark:bg-blue-950/30 border border-blue-100 dark:border-blue-900/40 text-sm text-blue-900 dark:text-blue-300 flex items-center gap-3">
            <Loader2 className="h-5 w-5 animate-spin flex-shrink-0 text-blue-600" />
            <div>
              <p className="font-semibold">Simulating transaction via Kafka</p>
              <p className="text-xs text-blue-800/80 dark:text-blue-400/80">
                The payment service is currently processing this order. This page updates automatically.
              </p>
            </div>
          </div>
        )}

        {/* Ordered items snapshot */}
        {order.items && order.items.length > 0 && (
          <div className="my-6">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-neutral-500 mb-3 flex items-center gap-1.5">
              <Package className="h-4 w-4" /> Purchased Items
            </h3>
            <div className="divide-y divide-neutral-100 dark:divide-neutral-800 bg-neutral-50 dark:bg-neutral-800/50 rounded-2xl p-4 border border-neutral-100 dark:border-neutral-800">
              {order.items.map((item, idx) => (
                <div key={idx} className="py-2.5 first:pt-0 last:pb-0 flex justify-between items-center text-sm">
                  <div>
                    <span className="font-medium text-neutral-900 dark:text-white">
                      {item.nameSnapshot || item.name || `Product #${item.productId}`}
                    </span>
                    <span className="text-neutral-500 ml-2">× {item.quantity}</span>
                  </div>
                  <span className="font-semibold text-neutral-900 dark:text-white">
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
        <div className="space-y-3 py-4 border-t border-neutral-100 dark:border-neutral-800 text-sm">
          <div className="flex justify-between">
            <span className="text-neutral-500">Order Placed</span>
            <span className="font-medium text-neutral-900 dark:text-white">
              {new Date(order.createdAt).toLocaleString()}
            </span>
          </div>
          <div className="flex justify-between items-center text-base font-extrabold pt-2 border-t border-neutral-100 dark:border-neutral-800">
            <span>Total Paid</span>
            <span className="text-blue-600 dark:text-blue-400 text-xl">
              {((order.totalCents || 0) / 100).toLocaleString("en-US", {
                style: "currency",
                currency: order.currency || "USD",
              })}
            </span>
          </div>
        </div>

        <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            href="/"
            className="inline-flex items-center justify-center rounded-full bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 px-6 py-2.5 text-sm font-semibold hover:opacity-90 transition-all text-center"
          >
            Continue Shopping
          </Link>
          <Link
            href="/orders"
            className="inline-flex items-center justify-center rounded-full border border-neutral-200 dark:border-neutral-700 px-6 py-2.5 text-sm font-semibold hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-all text-center"
          >
            All Orders
          </Link>
        </div>
      </div>
    </div>
  );
}
