"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { OrderSummary, OrderListResponse } from "@/types";
import {
  Package,
  ArrowLeft,
  Loader2,
  LogOut,
  ArrowUpRight,
  CheckCircle2,
  Clock,
  XCircle,
  Search,
  RotateCcw,
  Printer,
  ShoppingBag,
  Truck,
} from "lucide-react";
import { PageWrapper } from "@/components/anime/PageWrapper";
import { AnimeButton } from "@/components/anime/AnimeButton";
import { AnimeStagger } from "@/components/anime/AnimeStagger";
import { useStore } from "@/providers/StoreContext";

export default function OrdersPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { showToast } = useStore();
  const [searchFilter, setSearchFilter] = useState("");
  const [timeFilter, setTimeFilter] = useState("all");

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

  const filteredOrders = orders?.filter((order) => {
    if (!searchFilter) return true;
    return (
      order.orderId.toLowerCase().includes(searchFilter.toLowerCase()) ||
      order.status.toLowerCase().includes(searchFilter.toLowerCase())
    );
  });

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
          <div className="p-4 rounded-full bg-cyan-500/10 text-cyan-400 mb-4">
            <Package className="h-8 w-8" />
          </div>
          <h1 className="text-2xl font-black text-white mb-2">Your Orders</h1>
          <p className="text-slate-400 text-xs mb-6">Please sign in to view your order history.</p>
          <Link href="/login" className="w-full">
            <AnimeButton variant="primary" className="w-full">
              Sign In to Account
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
    <PageWrapper className="max-w-5xl mx-auto px-4 md:px-6 py-8">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-black text-white">Your Purchase History</h1>
          <p className="text-xs text-slate-400 mt-1">
            Track shipments, return items, or buy again from your past transactions.
          </p>
        </div>

        {/* Search within Orders */}
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
          <input
            type="text"
            placeholder="Search all orders..."
            value={searchFilter}
            onChange={(e) => setSearchFilter(e.target.value)}
            className="w-full pl-9 pr-4 py-2 rounded-xl bg-slate-900 border border-white/10 text-white text-xs placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-400"
          />
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-4 border-b border-white/10 pb-3 mb-6 text-xs font-bold text-slate-400">
        <button
          onClick={() => setTimeFilter("all")}
          className={`pb-3 -mb-3 border-b-2 transition-colors cursor-pointer ${
            timeFilter === "all"
              ? "border-cyan-400 text-cyan-400"
              : "border-transparent hover:text-white"
          }`}
        >
          Orders ({orders?.length || 0})
        </button>
        <button
          onClick={() => setTimeFilter("buy-again")}
          className={`pb-3 -mb-3 border-b-2 transition-colors cursor-pointer ${
            timeFilter === "buy-again"
              ? "border-cyan-400 text-cyan-400"
              : "border-transparent hover:text-white"
          }`}
        >
          Buy Again
        </button>
        <button
          onClick={() => setTimeFilter("not-shipped")}
          className={`pb-3 -mb-3 border-b-2 transition-colors cursor-pointer ${
            timeFilter === "not-shipped"
              ? "border-cyan-400 text-cyan-400"
              : "border-transparent hover:text-white"
          }`}
        >
          In Transit
        </button>
      </div>

      {!filteredOrders || filteredOrders.length === 0 ? (
        <div className="text-center py-16 glass-panel rounded-3xl border border-dashed border-slate-800">
          <div className="p-4 rounded-full bg-slate-800/80 text-slate-400 w-fit mx-auto mb-4">
            <Package className="h-8 w-8" />
          </div>
          <h2 className="text-xl font-bold text-white mb-2">No orders found</h2>
          <p className="text-slate-400 text-xs mb-6 max-w-sm mx-auto">
            Explore our curated catalog and place your first order with Nexora Express delivery.
          </p>
          <Link href="/">
            <AnimeButton variant="primary">Explore Deals</AnimeButton>
          </Link>
        </div>
      ) : (
        <AnimeStagger className="space-y-6" delay={100} staggerDelay={60}>
          {filteredOrders.map((order) => (
            <div
              key={order.orderId}
              className="anime-stagger-item glass-card rounded-3xl border border-white/[0.08] overflow-hidden shadow-xl hover:border-cyan-500/40 transition-all"
            >
              {/* Order Card Header */}
              <div className="bg-slate-900/90 px-6 py-4 border-b border-white/5 flex flex-wrap justify-between items-center gap-4 text-xs">
                <div className="flex flex-wrap items-center gap-6">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-400">Order Placed</span>
                    <p className="font-bold text-white">
                      {new Date(order.createdAt).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </p>
                  </div>

                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-400">Total</span>
                    <p className="font-bold text-white">
                      {((order.totalCents || 0) / 100).toLocaleString("en-US", {
                        style: "currency",
                        currency: order.currency || "USD",
                      })}
                    </p>
                  </div>

                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-400">Ship To</span>
                    <p className="font-bold text-cyan-400">Alex Johnson</p>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-400">Order #</span>
                    <p className="font-mono text-slate-300 font-bold">{order.orderId}</p>
                  </div>
                  <Link
                    href={`/order/${order.orderId}`}
                    className="text-cyan-400 hover:text-cyan-300 font-bold underline"
                  >
                    View details
                  </Link>
                </div>
              </div>

              {/* Order Card Body */}
              <div className="p-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6">
                <div className="flex items-start gap-4">
                  <div className="p-4 rounded-2xl bg-slate-800 text-cyan-400 shrink-0">
                    <ShoppingBag className="h-8 w-8" />
                  </div>

                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${
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

                    <h3 className="font-bold text-white text-base">
                      {order.status === "PAID"
                        ? "Delivering Tomorrow by 8:00 PM"
                        : "Authorizing payment via Kafka..."}
                    </h3>

                    <p className="text-xs text-slate-400">
                      Dispatched via Nexora Priority Tracking #NEX-
                      {order.orderId.slice(0, 6).toUpperCase()}
                    </p>
                  </div>
                </div>

                {/* Right Action Buttons */}
                <div className="flex flex-col sm:w-48 gap-2 w-full">
                  <Link
                    href={`/order/${order.orderId}`}
                    className="w-full py-2 rounded-full bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs text-center shadow-md transition-all"
                  >
                    Track Package
                  </Link>
                  <Link
                    href={`/order/${order.orderId}`}
                    className="w-full py-2 rounded-full bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs text-center border border-white/10 transition-colors"
                  >
                    View or Print Invoice
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </AnimeStagger>
      )}
    </PageWrapper>
  );
}
