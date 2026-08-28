"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

interface CartItem {
  productId: string;
  quantity: number;
}

interface Cart {
  userId: string;
  items: CartItem[];
  grandTotalCents: number;
  currency: string;
}

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
      // In cart-service, setting quantity to 0 removes the item
      const res = await fetch(`/api/gateway/cart/items`, {
        method: "POST", // The gateway routes this to POST /items for updating/adding
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId, quantity }),
      });
      if (!res.ok) throw new Error("Failed to update cart");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cart"] });
    },
    onError: (err: any) => {
      setError(err.message || "Failed to update item quantity");
    }
  });

  if (isLoading) return <div className="p-8 text-center text-gray-500">Loading cart...</div>;

  if (isError) {
    return (
      <div className="p-8 text-center">
        <h1 className="text-2xl font-bold mb-4">Your Cart</h1>
        <p className="text-gray-600 mb-4">Please login to view your cart.</p>
        <Link href="/login" className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600">
          Login
        </Link>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 max-w-4xl">
      <header className="mb-8">
        <Link href="/" className="text-blue-500 hover:underline">← Continue Shopping</Link>
        <h1 className="text-3xl font-bold mt-4">Your Cart</h1>
      </header>

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}

      {(!cart || !cart.items || cart.items.length === 0) ? (
        <div className="text-center py-12 bg-gray-50 rounded">
          <p className="text-gray-500 text-lg">Your cart is empty.</p>
        </div>
      ) : (
        <div className="bg-white rounded shadow p-6">
          <div className="divide-y">
            {cart.items.map((item) => (
              <div key={item.productId} className="py-4 flex justify-between items-center">
                <div>
                  <h3 className="font-semibold">Product {item.productId}</h3>
                  <p className="text-sm text-gray-500">Qty: {item.quantity}</p>
                </div>
                <div className="flex items-center gap-4">
                  <button
                    disabled={updateQuantityMutation.isPending}
                    onClick={() => updateQuantityMutation.mutate({ productId: item.productId, quantity: item.quantity - 1 })}
                    className="px-3 py-1 bg-gray-200 rounded hover:bg-gray-300 disabled:opacity-50"
                  >
                    -
                  </button>
                  <span className="w-8 text-center">{item.quantity}</span>
                  <button
                    disabled={updateQuantityMutation.isPending}
                    onClick={() => updateQuantityMutation.mutate({ productId: item.productId, quantity: item.quantity + 1 })}
                    className="px-3 py-1 bg-gray-200 rounded hover:bg-gray-300 disabled:opacity-50"
                  >
                    +
                  </button>
                  <button
                    disabled={updateQuantityMutation.isPending}
                    onClick={() => updateQuantityMutation.mutate({ productId: item.productId, quantity: 0 })}
                    className="text-red-500 hover:underline ml-4"
                  >
                    Remove
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-8 border-t pt-6 flex justify-between items-center">
            <div>
              <p className="text-gray-600">Total</p>
              <p className="text-2xl font-bold">
                {(cart.grandTotalCents / 100).toLocaleString("en-US", {
                  style: "currency",
                  currency: cart.currency,
                })}
              </p>
            </div>
            <Link
              href="/checkout"
              className="bg-green-600 text-white px-8 py-3 rounded text-lg font-bold hover:bg-green-700 transition"
            >
              Proceed to Checkout
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
