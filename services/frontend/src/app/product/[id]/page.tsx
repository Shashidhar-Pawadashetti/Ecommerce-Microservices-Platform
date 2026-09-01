"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useState } from "react";
import { Product } from "@/types";
import { ArrowLeft, ShoppingCart, Loader2, Sparkles, Tag, ShieldCheck, Zap } from "lucide-react";
import { PageWrapper } from "@/components/anime/PageWrapper";
import { AnimeButton } from "@/components/anime/AnimeButton";

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
        <Loader2 className="h-10 w-10 animate-spin text-cyan-400" />
        <p className="text-slate-400 text-sm font-semibold">Loading product details...</p>
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className="container mx-auto p-8 max-w-md text-center min-h-[60vh] flex flex-col items-center justify-center">
        <div className="glass-panel border border-rose-500/30 bg-rose-950/20 text-rose-300 p-8 rounded-3xl mb-6">
          <p className="font-bold text-lg mb-1">Product Not Found</p>
          <p className="text-xs text-rose-400">{(error as Error)?.message || "Requested item unavailable"}</p>
        </div>
        <Link href="/">
          <AnimeButton variant="secondary">
            <ArrowLeft className="h-4 w-4" /> Return to Catalog
          </AnimeButton>
        </Link>
      </div>
    );
  }

  return (
    <PageWrapper className="max-w-5xl mx-auto px-4 md:px-6 py-8">
      <Link
        href="/"
        className="inline-flex items-center text-xs font-bold text-slate-400 hover:text-cyan-400 mb-8 transition-colors gap-1.5"
      >
        <ArrowLeft className="h-4 w-4" /> Back to Catalog
      </Link>

      <div className="flex flex-col md:flex-row gap-10 glass-panel rounded-3xl p-6 md:p-10 border border-white/[0.08] shadow-2xl">
        {/* Product Visual Showcase */}
        <div className="w-full md:w-1/2 aspect-square bg-gradient-to-br from-slate-800/80 via-slate-900/90 to-indigo-950/40 rounded-3xl flex flex-col items-center justify-center p-10 relative overflow-hidden border border-white/5">
          <div className="absolute -top-12 -left-12 w-48 h-48 bg-cyan-500/20 rounded-full blur-2xl pointer-events-none" />
          <div className="absolute -bottom-12 -right-12 w-48 h-48 bg-pink-500/20 rounded-full blur-2xl pointer-events-none" />

          <div className="p-8 rounded-3xl bg-white/5 border border-white/10 shadow-2xl relative z-10">
            <ShoppingCart className="h-28 w-28 text-indigo-400" />
          </div>

          <div className="mt-6 flex items-center gap-2 text-xs font-semibold text-slate-400">
            <ShieldCheck className="h-4 w-4 text-emerald-400" /> Fast & Verified Delivery
          </div>
        </div>

        {/* Product Info & Cart Controls */}
        <div className="w-full md:w-1/2 flex flex-col justify-between">
          <div>
            <div className="flex flex-wrap gap-2 mb-4">
              {product.categories?.map((cat) => (
                <span
                  key={cat}
                  className="inline-flex items-center gap-1 text-xs font-bold text-cyan-400 bg-cyan-500/10 border border-cyan-500/20 px-3 py-1 rounded-full uppercase tracking-wider"
                >
                  <Tag className="h-3 w-3" />
                  {cat}
                </span>
              ))}
            </div>

            <h1 className="text-2xl sm:text-4xl font-black text-white mb-3">
              {product.name}
            </h1>

            <p className="text-slate-300 text-sm leading-relaxed mb-6">
              {product.description || "High performance microservices product item."}
            </p>

            <div className="mb-6 p-4 rounded-2xl glass-card border border-white/5 flex items-center justify-between">
              <span className="text-xs uppercase font-bold tracking-wider text-slate-400">
                Unit Price
              </span>
              <span className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-white via-cyan-200 to-indigo-300">
                {((product.priceCents || 0) / 100).toLocaleString("en-US", {
                  style: "currency",
                  currency: product.currency || "USD",
                })}
              </span>
            </div>
          </div>

          <div>
            {cartError && (
              <div className="bg-rose-950/40 border border-rose-500/40 text-rose-300 p-3.5 rounded-2xl text-xs font-semibold mb-4">
                {cartError}
              </div>
            )}

            <div className="flex items-center gap-4 mb-6">
              <label htmlFor="quantity" className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Quantity:
              </label>
              <div className="flex items-center border border-white/10 rounded-full bg-slate-900/80 px-4 py-2">
                <input
                  type="number"
                  id="quantity"
                  min="1"
                  max={product.stock || 99}
                  value={quantity}
                  onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-12 bg-transparent text-center font-bold text-white focus:outline-none text-sm"
                />
              </div>
              <span className="text-xs font-semibold text-slate-400">
                {product.stock > 0 ? `${product.stock} available` : "Out of stock"}
              </span>
            </div>

            <AnimeButton
              onClick={() => addToCartMutation.mutate()}
              disabled={addToCartMutation.isPending || product.stock === 0}
              variant="primary"
              size="lg"
              className="w-full"
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
            </AnimeButton>
          </div>
        </div>
      </div>
    </PageWrapper>
  );
}
