"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";

interface Order {
  id: string;
  userId: string;
  status: string;
  totalAmount: number;
  currency: string;
  createdAt: string;
}

export default function OrdersPage() {
  const router = useRouter();

  const { data: orders, isLoading, error } = useQuery<Order[]>({
    queryKey: ["orders"],
    queryFn: async () => {
      const res = await fetch(`/api/gateway/orders`);
      if (res.status === 401) {
        throw new Error("UNAUTHORIZED");
      }
      if (!res.ok) {
        throw new Error("Failed to fetch orders");
      }
      return res.json();
    },
    retry: false,
  });

  const handleLogout = async () => {
    // Ideally this hits a logout endpoint that clears the cookie
    // For our simplified setup, clearing the cookie in the browser or via API
    await fetch("/api/gateway/auth/logout", { method: "POST" }).catch(() => {});
    // Client-side, we might just redirect or clear state.
    // In our case, httpOnly cookie must be cleared by the server. 
    // Assuming the auth-service handles it, or we have a route handler.
    // Let's call our own route handler to clear the cookie just in case.
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/");
  };

  if (isLoading) return <div className="p-8 text-center text-gray-500">Loading order history...</div>;

  if (error && (error as Error).message === "UNAUTHORIZED") {
    return (
      <div className="p-8 text-center">
        <h1 className="text-2xl font-bold mb-4">Order History</h1>
        <p className="text-gray-600 mb-4">Please login to view your orders.</p>
        <Link href="/login" className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600">
          Login
        </Link>
      </div>
    );
  }

  if (error) return <div className="p-8 text-center text-red-500">Error: {(error as Error).message}</div>;

  return (
    <div className="container mx-auto p-4 max-w-4xl">
      <header className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold">Your Orders</h1>
        <div className="flex gap-4 items-center">
          <Link href="/" className="text-blue-500 hover:underline">Catalog</Link>
          <button onClick={handleLogout} className="text-red-500 hover:underline">Logout</button>
        </div>
      </header>

      {!orders || orders.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded">
          <p className="text-gray-500 text-lg">You have no order history.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {orders.map((order) => (
            <div key={order.id} className="border p-6 rounded shadow flex justify-between items-center bg-white">
              <div>
                <p className="font-semibold text-lg mb-1">Order #{order.id.slice(0, 8)}...</p>
                <p className="text-gray-500 text-sm mb-2">{new Date(order.createdAt).toLocaleDateString()}</p>
                <span className={`inline-block px-2 py-1 text-xs font-bold rounded ${
                  order.status === "COMPLETED" || order.status === "PAID" ? "bg-green-100 text-green-800" :
                  order.status === "PENDING" ? "bg-yellow-100 text-yellow-800" :
                  "bg-red-100 text-red-800"
                }`}>
                  {order.status}
                </span>
              </div>
              <div className="text-right">
                <p className="font-bold text-xl mb-4">
                  {(order.totalAmount / 100).toLocaleString("en-US", {
                    style: "currency",
                    currency: order.currency,
                  })}
                </p>
                <Link
                  href={`/order/${order.id}`}
                  className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 transition"
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
