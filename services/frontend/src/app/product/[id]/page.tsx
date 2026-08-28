"use client";

import { useQuery, useMutation } from "@tanstack/react-query";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useState } from "react";

export default function ProductDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const [quantity, setQuantity] = useState(1);
  const [cartError, setCartError] = useState("");

  const { data: product, isLoading, error } = useQuery({
    queryKey: ["product", id],
    queryFn: async () => {
      const res = await fetch(`/api/gateway/catalog/products/${id}`);
      if (!res.ok) {
        throw new Error("Product not found");
      }
      return res.json();
    },
    enabled: !!id,
  });

  const addToCartMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/gateway/cart/items`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          productId: id,
          quantity,
        }),
      });

      if (!res.ok) {
        if (res.status === 401) {
          throw new Error("Please login to add items to cart.");
        }
        throw new Error("Failed to add to cart");
      }
      return res.json();
    },
    onSuccess: () => {
      router.push("/cart"); // We don't have a cart page yet, but let's assume /cart
    },
    onError: (err: any) => {
      setCartError(err.message || "An error occurred");
    }
  });

  if (isLoading) return <div className="p-4">Loading product details...</div>;
  if (error) return <div className="p-4 text-red-500">Error: {(error as Error).message}</div>;
  if (!product) return <div className="p-4">Product not found.</div>;

  return (
    <div className="container mx-auto p-4 max-w-4xl">
      <div className="mb-6">
        <Link href="/" className="text-blue-500 hover:underline">← Back to Catalog</Link>
      </div>
      
      <div className="flex flex-col md:flex-row gap-8">
        <div className="w-full md:w-1/2 bg-gray-200 h-64 md:h-96 rounded flex items-center justify-center">
          <span className="text-gray-500">Product Image</span>
        </div>
        
        <div className="w-full md:w-1/2 flex flex-col">
          <h1 className="text-3xl font-bold mb-4">{product.name}</h1>
          <p className="text-gray-600 mb-6">{product.description}</p>
          
          <div className="text-2xl font-bold mb-6">
            {(product.priceCents / 100).toLocaleString("en-US", {
              style: "currency",
              currency: product.currency,
            })}
          </div>

          {cartError && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
              {cartError}
            </div>
          )}

          <div className="flex items-center gap-4 mb-6 mt-auto">
            <label htmlFor="quantity" className="font-semibold">Quantity:</label>
            <input
              type="number"
              id="quantity"
              min="1"
              max={product.stock || 10}
              value={quantity}
              onChange={(e) => setQuantity(parseInt(e.target.value) || 1)}
              className="border p-2 rounded w-20"
            />
          </div>

          <button
            onClick={() => addToCartMutation.mutate()}
            disabled={addToCartMutation.isPending || product.stock === 0}
            className="w-full bg-blue-600 text-white py-3 rounded text-lg font-semibold hover:bg-blue-700 disabled:bg-blue-300 transition"
          >
            {addToCartMutation.isPending ? "Adding..." : product.stock === 0 ? "Out of Stock" : "Add to Cart"}
          </button>
        </div>
      </div>
    </div>
  );
}
