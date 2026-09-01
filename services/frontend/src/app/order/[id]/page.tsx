"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useEffect, useState } from "react";
import { OrderSnapshot } from "@/types";
import {
  ArrowLeft,
  CheckCircle2,
  Clock,
  XCircle,
  Loader2,
  Package,
  Radio,
  Printer,
  RotateCcw,
  ShoppingBag,
  Truck,
  MapPin,
  CreditCard,
} from "lucide-react";
import { PageWrapper } from "@/components/anime/PageWrapper";
import { AnimeButton } from "@/components/anime/AnimeButton";
import { OrderTrackingStepper } from "@/components/amazon/OrderTrackingStepper";
import { InvoiceModal } from "@/components/amazon/InvoiceModal";
import { useStore } from "@/providers/StoreContext";

export default function OrderStatusPage() {
  const { id } = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { showToast } = useStore();
  const [shouldPoll, setShouldPoll] = useState(true);
  const [isInvoiceOpen, setIsInvoiceOpen] = useState(false);

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

  // Stop polling once the order reaches a terminal state
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

  const buyAgainMutation = useMutation({
    mutationFn: async (productId: string) => {
      const res = await fetch(`/api/gateway/cart/items`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId, quantity: 1 }),
      });
      if (!res.ok) throw new Error("Failed to re-order item");
      return res.json();
    },
    onSuccess: (cartData, productId) => {
      queryClient.invalidateQueries({ queryKey: ["cart"] });
      const item = order?.items?.find((i) => i.productId === productId);
      showToast({
        title: "Added to Cart",
        productName: item?.nameSnapshot || item?.name || "Item",
        priceCents: item?.unitPriceCents || 0,
        quantity: 1,
        cartTotalCents: cartData?.grandTotalCents || 0,
        currency: order?.currency || "USD",
      });
      router.push("/cart");
    },
  });

  if (isLoading) {
    return (
      <div className="container mx-auto p-8 flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <Loader2 className="h-10 w-10 animate-spin text-amber-400" />
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
  const trackingNumber = order.trackingNumber || `ECM-${order.orderId.replace(/[^a-zA-Z0-9]/g, "").slice(0, 6).toUpperCase()}-US`;

  return (
    <PageWrapper className="max-w-4xl mx-auto px-4 md:px-6 py-8">
      {/* Header Actions */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <Link
          href="/orders"
          className="inline-flex items-center text-xs font-bold text-slate-400 hover:text-amber-400 transition-colors gap-1.5"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Your Orders
        </Link>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => setIsInvoiceOpen(true)}
            className="px-4 py-2 rounded-full bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold flex items-center gap-1.5 border border-white/10 transition-colors cursor-pointer"
          >
            <Printer className="h-3.5 w-3.5 text-amber-400" /> View / Print Invoice
          </button>
        </div>
      </div>

      {/* Main Order Card */}
      <div className="glass-panel rounded-3xl border border-white/[0.08] shadow-2xl p-6 sm:p-8">
        {/* Order Meta Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-6 border-b border-white/10 text-xs">
          <div>
            <span className="text-[10px] uppercase font-bold text-slate-400">Order Placed</span>
            <p className="font-bold text-white text-sm">
              {new Date(order.createdAt).toLocaleDateString("en-US", {
                month: "long",
                day: "numeric",
                year: "numeric",
              })}
            </p>
          </div>
          <div>
            <span className="text-[10px] uppercase font-bold text-slate-400">Total Charged</span>
            <p className="font-black text-amber-400 text-base">
              {((order.totalCents || 0) / 100).toLocaleString("en-US", {
                style: "currency",
                currency: order.currency || "USD",
              })}
            </p>
          </div>
          <div>
            <span className="text-[10px] uppercase font-bold text-slate-400">Ship To</span>
            <p className="font-bold text-white">Verified Customer</p>
          </div>
          <div>
            <span className="text-[10px] uppercase font-bold text-slate-400">Order #</span>
            <p className="font-mono text-slate-300 font-bold">{order.orderId}</p>
          </div>
        </div>

        {/* Shipment Tracking Progress Stepper */}
        <OrderTrackingStepper
          status={order.status}
          createdAt={order.createdAt}
          trackingNumber={trackingNumber}
        />

        {/* Kafka Saga Processing Banner */}
        {isPending && (
          <div className="my-6 p-4 rounded-2xl glass-card border border-amber-500/30 text-xs text-amber-300 flex items-center gap-3">
            <Radio className="h-5 w-5 animate-pulse text-amber-400 shrink-0" />
            <div>
              <p className="font-bold">Authorizing Payment via Kafka KRaft</p>
              <p className="text-slate-400 text-[11px] mt-0.5">
                The FastAPI payment worker is confirming transaction idempotency in Redis. This view will update automatically.
              </p>
            </div>
          </div>
        )}

        {/* Ordered Items List with "Buy Again" */}
        <div className="my-6 space-y-4">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
            <Package className="h-4 w-4" /> Package Contents
          </h3>

          <div className="divide-y divide-white/5 glass-card rounded-2xl p-4 sm:p-6 border border-white/5">
            {order.items?.map((item, idx) => (
              <div
                key={idx}
                className="py-4 first:pt-0 last:pb-0 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 text-xs"
              >
                <div className="flex items-start gap-3.5">
                  <div className="p-3 rounded-2xl bg-slate-800 text-amber-400 shrink-0">
                    <ShoppingBag className="h-6 w-6" />
                  </div>
                  <div>
                    <h4 className="font-bold text-white text-sm">
                      {item.nameSnapshot || item.name || `Product #${item.productId}`}
                    </h4>
                    <p className="text-slate-400 text-xs mt-0.5">
                      Qty: {item.quantity} • Unit Price:{" "}
                      {((item.unitPriceCents || 0) / 100).toLocaleString("en-US", {
                        style: "currency",
                        currency: order.currency || "USD",
                      })}
                    </p>
                    <p className="text-emerald-400 font-semibold text-[11px] mt-1">
                      Eligible for 30-Day Return / Replacement
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end">
                  <span className="font-black text-sm text-white">
                    {(((item.unitPriceCents || 0) * item.quantity) / 100).toLocaleString("en-US", {
                      style: "currency",
                      currency: order.currency || "USD",
                    })}
                  </span>

                  <button
                    onClick={() => buyAgainMutation.mutate(item.productId)}
                    disabled={buyAgainMutation.isPending}
                    className="px-3.5 py-1.5 rounded-full bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs flex items-center gap-1 transition-all shadow-sm cursor-pointer disabled:opacity-50"
                  >
                    <RotateCcw className="h-3 w-3" /> Buy Again
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Shipping & Payment Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs pt-4 border-t border-white/5">
          <div className="p-4 rounded-2xl bg-white/5 border border-white/5 space-y-1">
            <div className="flex items-center gap-1.5 font-bold text-white mb-2">
              <MapPin className="h-4 w-4 text-amber-400" /> Shipping Address
            </div>
            <p className="font-bold text-slate-200">Alex Johnson</p>
            <p className="text-slate-400">410 Terry Ave N, Suite 400</p>
            <p className="text-slate-400">Seattle, WA 98109, United States</p>
          </div>

          <div className="p-4 rounded-2xl bg-white/5 border border-white/5 space-y-1">
            <div className="flex items-center gap-1.5 font-bold text-white mb-2">
              <CreditCard className="h-4 w-4 text-cyan-400" /> Payment Method
            </div>
            <p className="font-bold text-slate-200">EcoPrime Visa Signature (•••• 4242)</p>
            <p className="text-slate-400">Kafka Outbox Transaction ID: <span className="font-mono text-slate-300">{order.orderId.slice(0, 12)}...</span></p>
            <p className="text-emerald-400 font-bold">Status: {order.status}</p>
          </div>
        </div>
      </div>

      {/* Printable Invoice Modal */}
      {isInvoiceOpen && <InvoiceModal order={order} onClose={() => setIsInvoiceOpen(false)} />}
    </PageWrapper>
  );
}
