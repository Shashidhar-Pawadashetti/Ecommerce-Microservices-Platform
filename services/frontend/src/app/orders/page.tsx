"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { OrderSummary, OrderListResponse } from "@/types";
import { Package, ArrowLeft, Loader2, LogOut } from "lucide-react";

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
        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
        <p className="text-neutral-500">Loading order history...</p>
      </div>
    );
  }

  if (error && (error as Error).message === "UNAUTHORIZED") {
    return (
      <div className="container mx-auto p-8 max-w-md text-center min-h-[60vh] flex flex-col items-center justify-center">
        <div className="bg-neutral-100 dark:bg-neutral-800 p-4 rounded-full mb-4">
          <Package className="h-8 w-8 text-neutral-400" />
        </div>
        <h1 className="text-2xl font-bold mb-2">Order History</h1>
        <p className="text-neutral-500 mb-6">Please log in to view your orders.</p>
        <Link
          href="/login"
          className="bg-blue-600 text-white px-6 py-2.5 rounded-full font-medium hover:bg-blue-700 transition"
        >
          Login
        </Link>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto p-8 max-w-md text-center">
        <div className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 p-6 rounded-2xl border border-red-100 dark:border-red-900/30">
          <p className="font-semibold text-lg mb-1">Error Loading Orders</p>
          <p className="text-sm">{(error as Error).message}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 md:px-6 py-8 max-w-4xl min-h-[calc(100vh-4rem)]">
      <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
        <div>
          <Link href="/" className="inline-flex items-center text-sm text-neutral-500 hover:text-blue-600 mb-2 transition-colors">
            <ArrowLeft className="h-4 w-4 mr-1" /> Back to Catalog
          </Link>
          <h1 className="text-3xl font-extrabold tracking-tight">Your Orders</h1>
        </div>
        <button
          onClick={handleLogout}
          className="inline-flex items-center gap-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 px-4 py-2 rounded-full transition-colors"
        >
          <LogOut className="h-4 w-4" /> Log out
        </button>
      </header>

      {!orders || orders.length === 0 ? (
        <div className="text-center py-16 bg-neutral-50 dark:bg-neutral-900 rounded-3xl border border-dashed border-neutral-200 dark:border-neutral-800">
          <Package className="h-12 w-12 text-neutral-400 mx-auto mb-4" />
          <h2 className="text-xl font-bold mb-2">No orders placed yet</h2>
          <p className="text-neutral-500 mb-6">Explore our catalog and find items you love.</p>
          <Link
            href="/"
            className="inline-flex items-center justify-center rounded-full bg-blue-600 px-6 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-blue-700 transition-all"
          >
            Start Shopping
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {orders.map((order) => (
            <div
              key={order.orderId}
              className="border border-neutral-200 dark:border-neutral-800 p-6 rounded-2xl shadow-sm hover:shadow-md transition-all flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white dark:bg-neutral-900"
            >
              <div>
                <p className="font-semibold text-lg text-neutral-900 dark:text-white">
                  Order #{order.orderId}
                </p>
                <p className="text-neutral-500 text-sm mb-2">
                  {new Date(order.createdAt).toLocaleString()}
                </p>
                <span
                  className={`inline-block px-2.5 py-1 text-xs font-bold rounded-full uppercase tracking-wider ${
                    order.status === "PAID"
                      ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
                      : order.status === "PENDING_PAYMENT"
                      ? "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400"
                      : "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400"
                  }`}
                >
                  {order.status}
                </span>
              </div>
              <div className="sm:text-right w-full sm:w-auto flex sm:flex-col justify-between items-center sm:items-end gap-3">
                <p className="font-extrabold text-xl text-neutral-900 dark:text-white">
                  {((order.totalCents || 0) / 100).toLocaleString("en-US", {
                    style: "currency",
                    currency: order.currency || "USD",
                  })}
                </p>
                <Link
                  href={`/order/${order.orderId}`}
                  className="bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 px-4 py-2 rounded-full text-sm font-semibold hover:opacity-90 transition"
                >
                  View Details
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
