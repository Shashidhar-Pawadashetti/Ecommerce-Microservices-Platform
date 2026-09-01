"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { OrderSummary, OrderListResponse } from "@/types";
import { Package, ArrowLeft, Loader2, LogOut, ArrowUpRight, CheckCircle2, Clock, XCircle } from "lucide-react";
import { PageWrapper } from "@/components/anime/PageWrapper";
import { AnimeButton } from "@/components/anime/AnimeButton";
import { AnimeStagger } from "@/components/anime/AnimeStagger";

export default function OrdersPage() {
  const router = useRouter();

  const { data: orders, isLoading, error } = useQuery<OrderSummary[]>({
    queryKey: ["orders"],
    queryFn: async () => {
      const res = await fetch(`/api/gateway/orders`);
      if (res.status === 401) {
        throw new Error("UNAUTHORIZED");
      }
      if (!res.ok) {
        throw new Error("Failed to fetch orders");
      }
      const data: OrderListResponse = await res.json();
      return data.items || [];
    },
    retry: false,
  });

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/");
  };

  if (isLoading) {
    return (
      <div className="container mx-auto p-8 flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <Loader2 className="h-10 w-10 animate-spin text-cyan-400" />
        <p className="text-slate-400 text-sm font-semibold">Loading orders from PostgreSQL database...</p>
      </div>
    );
  }

  if (error && (error as Error).message === "UNAUTHORIZED") {
    return (
      <div className="container mx-auto p-8 max-w-md text-center min-h-[60vh] flex flex-col items-center justify-center">
        <div className="glass-panel p-8 rounded-3xl border border-white/10 w-full flex flex-col items-center">
          <div className="p-4 rounded-full bg-indigo-500/10 text-indigo-400 mb-4">
            <Package className="h-8 w-8" />
          </div>
          <h1 className="text-2xl font-black text-white mb-2">Order History</h1>
          <p className="text-slate-400 text-xs mb-6">Please log in to view your order history.</p>
          <Link href="/login" className="w-full">
            <AnimeButton variant="primary" className="w-full">
              Login to Account
            </AnimeButton>
          </Link>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto p-8 max-w-md text-center">
        <div className="glass-panel border border-rose-500/30 bg-rose-950/20 text-rose-300 p-6 rounded-3xl">
          <p className="font-bold text-base mb-1">Error Loading Orders</p>
          <p className="text-xs text-rose-400">{(error as Error).message}</p>
        </div>
      </div>
    );
  }

  return (
    <PageWrapper
      title="Your Purchase History"
      badge="Spring Boot 3.5 & PostgreSQL"
      description="All orders tracked with distributed outbox events and Kafka payment processing."
      className="max-w-4xl mx-auto px-4 md:px-6 py-8"
    >
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
        <Link
          href="/"
          className="inline-flex items-center text-xs font-bold text-slate-400 hover:text-cyan-400 transition-colors gap-1.5"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Back to Catalog
        </Link>
        <button
          onClick={handleLogout}
          className="inline-flex items-center gap-1.5 text-xs font-bold text-rose-400 hover:bg-rose-500/10 px-3 py-1.5 rounded-full transition-colors cursor-pointer"
        >
          <LogOut className="h-3.5 w-3.5" /> Log out
        </button>
      </div>

      {!orders || orders.length === 0 ? (
        <div className="text-center py-16 glass-panel rounded-3xl border border-dashed border-slate-800">
          <div className="p-4 rounded-full bg-slate-800/80 text-slate-400 w-fit mx-auto mb-4">
            <Package className="h-8 w-8" />
          </div>
          <h2 className="text-xl font-bold text-white mb-2">No orders placed yet</h2>
          <p className="text-slate-400 text-xs mb-6 max-w-sm mx-auto">
            Discover curated items in the catalog and complete your first checkout.
          </p>
          <Link href="/">
            <AnimeButton variant="primary">Start Shopping</AnimeButton>
          </Link>
        </div>
      ) : (
        <AnimeStagger className="grid grid-cols-1 gap-4" delay={100} staggerDelay={60}>
          {orders.map((order) => (
            <div
              key={order.orderId}
              className="anime-stagger-item glass-card p-6 rounded-3xl border border-white/[0.08] hover:border-indigo-500/40 transition-all flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4"
            >
              <div>
                <p className="font-bold text-base text-white">
                  Order #{order.orderId}
                </p>
                <p className="text-slate-400 text-xs mt-0.5 mb-3">
                  {new Date(order.createdAt).toLocaleString()}
                </p>
                <span
                  className={`inline-flex items-center gap-1.5 px-3 py-1 text-xs font-bold rounded-full uppercase tracking-wider border ${
                    order.status === "PAID"
                      ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                      : order.status === "PENDING_PAYMENT"
                      ? "bg-amber-500/10 text-amber-400 border-amber-500/30 animate-pulse"
                      : "bg-rose-500/10 text-rose-400 border-rose-500/30"
                  }`}
                >
                  {order.status === "PAID" ? (
                    <CheckCircle2 className="h-3 w-3" />
                  ) : order.status === "PENDING_PAYMENT" ? (
                    <Clock className="h-3 w-3" />
                  ) : (
                    <XCircle className="h-3 w-3" />
                  )}
                  {order.status}
                </span>
              </div>

              <div className="sm:text-right w-full sm:w-auto flex sm:flex-col justify-between items-center sm:items-end gap-3 pt-3 sm:pt-0 border-t sm:border-0 border-white/5">
                <p className="font-black text-2xl text-transparent bg-clip-text bg-gradient-to-r from-white via-cyan-200 to-indigo-300">
                  {((order.totalCents || 0) / 100).toLocaleString("en-US", {
                    style: "currency",
                    currency: order.currency || "USD",
                  })}
                </p>
                <Link
                  href={`/order/${order.orderId}`}
                  className="inline-flex items-center gap-1 px-4 py-2 rounded-full text-xs font-bold bg-white/10 hover:bg-gradient-to-r hover:from-indigo-600 hover:to-pink-600 text-white border border-white/10 hover:border-transparent transition-all"
                >
                  <span>Details</span>
                  <ArrowUpRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            </div>
          ))}
        </AnimeStagger>
      )}
    </PageWrapper>
  );
}
