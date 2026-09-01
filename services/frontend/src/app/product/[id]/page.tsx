"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useState } from "react";
import { Product } from "@/types";
import { ArrowLeft, ShoppingCart, Loader2, Check, Package2 } from "lucide-react";

export default function ProductDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [quantity, setQuantity] = useState(1);
  const [cartError, setCartError] = useState("");

  const { data: product, isLoading, error } = useQuery<Product>({
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
      setCartError("");
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
          throw new Error("Please log in to add items to your cart.");
        }
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || "Failed to add item to cart");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cart"] });
      router.push("/cart");
    },
    onError: (err: any) => {
      setCartError(err.message || "An error occurred");
    },
  });

  if (isLoading) {
    return (
      <div className="container mx-auto p-8 flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
        <p className="text-neutral-500">Loading product details...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto p-8 max-w-md text-center min-h-[60vh] flex flex-col items-center justify-center">
        <div className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 p-6 rounded-2xl border border-red-100 dark:border-red-900/30 mb-6">
          <p className="font-semibold text-lg mb-1">Product Not Found</p>
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

  if (!product) return null;

  return (
    <div className="container mx-auto px-4 md:px-6 py-8 max-w-4xl min-h-[calc(100vh-4rem)]">
      <Link
        href="/"
        className="inline-flex items-center text-sm text-neutral-500 hover:text-blue-600 mb-8 transition-colors"
      >
        <ArrowLeft className="h-4 w-4 mr-1" /> Back to Catalog
      </Link>

      <div className="flex flex-col md:flex-row gap-10 bg-white dark:bg-neutral-900 rounded-3xl p-6 md:p-10 border border-neutral-200 dark:border-neutral-800 shadow-sm">
        {/* Product Image Placeholder */}
        <div className="w-full md:w-1/2 aspect-square bg-gradient-to-tr from-neutral-100 to-neutral-200 dark:from-neutral-800 dark:to-neutral-700 rounded-2xl flex items-center justify-center p-12">
          <Package2 className="h-28 w-28 text-neutral-300 dark:text-neutral-600" />
        </div>

        {/* Product Details */}
        <div className="w-full md:w-1/2 flex flex-col justify-between">
          <div>
            <div className="flex flex-wrap gap-2 mb-3">
              {product.categories?.map((cat) => (
                <span
                  key={cat}
                  className="text-xs font-semibold text-blue-600 bg-blue-50 dark:bg-blue-900/30 dark:text-blue-400 px-2.5 py-1 rounded-full uppercase tracking-wider"
                >
                  {cat}
                </span>
              ))}
            </div>

            <h1 className="text-3xl font-extrabold text-neutral-900 dark:text-white mb-3">
              {product.name}
            </h1>

            <p className="text-neutral-600 dark:text-neutral-300 leading-relaxed mb-6 text-sm">
              {product.description}
            </p>

            <div className="text-3xl font-black text-neutral-900 dark:text-white mb-6">
              {((product.priceCents || 0) / 100).toLocaleString("en-US", {
                style: "currency",
                currency: product.currency || "USD",
              })}
            </div>
          </div>

          <div>
            {cartError && (
              <div className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 p-3 rounded-xl text-sm mb-4 border border-red-200 dark:border-red-800">
                {cartError}
              </div>
            )}

            <div className="flex items-center gap-4 mb-6">
              <label htmlFor="quantity" className="text-sm font-semibold text-neutral-700 dark:text-neutral-300">
                Quantity:
              </label>
              <div className="flex items-center border border-neutral-200 dark:border-neutral-700 rounded-full bg-neutral-50 dark:bg-neutral-800 px-3 py-1.5">
                <input
                  type="number"
                  id="quantity"
                  min="1"
                  max={product.stock || 99}
                  value={quantity}
                  onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-12 bg-transparent text-center font-semibold focus:outline-none text-sm"
                />
              </div>
              <span className="text-xs text-neutral-400">
                {product.stock > 0 ? `${product.stock} in stock` : "Out of stock"}
              </span>
            </div>

            <button
              onClick={() => addToCartMutation.mutate()}
              disabled={addToCartMutation.isPending || product.stock === 0}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3.5 px-6 rounded-full font-bold shadow-lg shadow-blue-600/30 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {addToCartMutation.isPending ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" /> Adding to Cart...
                </>
              ) : product.stock === 0 ? (
                "Out of Stock"
              ) : (
                <>
                  <ShoppingCart className="h-5 w-5" /> Add to Cart
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
