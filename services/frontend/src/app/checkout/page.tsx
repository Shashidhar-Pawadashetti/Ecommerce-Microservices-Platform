"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useState } from "react";
import Link from "next/link";

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
      const idempotencyKey = crypto.randomUUID(); // Generate unique key for this submission

      const res = await fetch(`/api/gateway/orders`, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Idempotency-Key": idempotencyKey
        },
        body: JSON.stringify({}), // Payload would normally have shipping info etc.
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to create order");
      }
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["cart"] });
      router.push(`/order/${data.id}`); // Proceed to order/payment status
    },
    onError: (err: any) => {
      setError(err.message || "Checkout failed");
    }
  });

  if (isLoading) return <div className="p-8 text-center">Loading checkout...</div>;

  if (!cart || cart.items.length === 0) {
    return (
      <div className="p-8 text-center">
        <p className="text-xl">Your cart is empty.</p>
        <Link href="/" className="text-blue-500 hover:underline mt-4 inline-block">Return to Catalog</Link>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 max-w-2xl">
      <h1 className="text-3xl font-bold mb-8">Checkout</h1>
      
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}

      <div className="bg-white rounded shadow p-6 mb-8">
        <h2 className="text-xl font-bold mb-4">Order Summary</h2>
        <div className="divide-y mb-4">
          {cart.items.map((item) => (
            <div key={item.productId} className="py-2 flex justify-between">
              <span>Product {item.productId}</span>
              <span>Qty: {item.quantity}</span>
            </div>
          ))}
        </div>
        <div className="flex justify-between items-center pt-4 border-t text-xl font-bold">
          <span>Total:</span>
          <span>
            {(cart.grandTotalCents / 100).toLocaleString("en-US", {
              style: "currency",
              currency: cart.currency,
            })}
          </span>
        </div>
      </div>

      <div className="flex justify-between">
        <Link href="/cart" className="text-gray-500 hover:underline py-3 px-4">
          Return to Cart
        </Link>
        <button
          onClick={() => checkoutMutation.mutate()}
          disabled={checkoutMutation.isPending}
          className="bg-green-600 text-white px-8 py-3 rounded font-bold hover:bg-green-700 disabled:bg-green-400 transition"
        >
          {checkoutMutation.isPending ? "Processing..." : "Place Order"}
        </button>
      </div>
    </div>
  );
}
