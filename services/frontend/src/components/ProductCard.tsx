"use client";

import Link from "next/link";
import { ShoppingBag, ArrowUpRight, Sparkles, Tag, Star, Zap, ShoppingCart, Loader2 } from "lucide-react";
import { Product } from "@/types";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useStore } from "@/providers/StoreContext";

interface ProductCardProps {
  product: Product;
}

export function ProductCard({ product }: ProductCardProps) {
  const queryClient = useQueryClient();
  const { showToast, location } = useStore();

  const formattedPrice = ((product.priceCents || 0) / 100).toLocaleString("en-US", {
    style: "currency",
    currency: product.currency || "USD",
  });

  // Calculate simulated Amazon list price (15% higher)
  const listPriceCents = Math.round((product.priceCents || 0) * 1.15);
  const formattedListPrice = (listPriceCents / 100).toLocaleString("en-US", {
    style: "currency",
    currency: product.currency || "USD",
  });

  const addToCartMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/gateway/cart/items`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId: product.id,
          quantity: 1,
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
    onSuccess: (cartData) => {
      queryClient.invalidateQueries({ queryKey: ["cart"] });
      showToast({
        title: "Added to Cart",
        productName: product.name,
        priceCents: product.priceCents,
        quantity: 1,
        cartTotalCents: cartData?.grandTotalCents || product.priceCents,
        currency: product.currency || "USD",
      });
    },
  });

  const getCategoryColor = (category?: string) => {
    const cat = category?.toLowerCase() || "";
    if (cat.includes("elect")) return "from-cyan-500/20 to-blue-600/20 text-cyan-400 border-cyan-500/30";
    if (cat.includes("audio") || cat.includes("apparel")) return "from-pink-500/20 to-purple-600/20 text-pink-400 border-pink-500/30";
    if (cat.includes("comput") || cat.includes("device")) return "from-indigo-500/20 to-violet-600/20 text-indigo-400 border-indigo-500/30";
    return "from-emerald-500/20 to-teal-600/20 text-emerald-400 border-emerald-500/30";
  };

  const primaryCategory = product.categories?.[0] || product.category || "General";
  const rating = product.rating || 4.8;
  const reviewCount = product.reviewCount || 1248;

  return (
    <div className="anime-stagger-item group relative flex flex-col justify-between overflow-hidden rounded-3xl glass-card border border-white/[0.08] hover:border-amber-500/50 transition-all duration-300 hover:shadow-2xl hover:shadow-amber-500/10">
      {/* Visual Header */}
      <div className="relative aspect-[4/3] w-full bg-gradient-to-b from-slate-800/60 to-slate-900/80 overflow-hidden flex items-center justify-center p-6">
        {/* Amazon's Choice / Best Seller Ribbon */}
        <div className="absolute top-3 left-3 z-10 flex flex-col gap-1">
          <span className="inline-flex items-center gap-1 text-[10px] font-black px-2.5 py-0.5 rounded-full bg-amber-500 text-slate-950 uppercase tracking-wider shadow-md">
            Best Seller
          </span>
          <span
            className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider bg-gradient-to-r border backdrop-blur-md ${getCategoryColor(
              primaryCategory
            )}`}
          >
            <Tag className="h-2.5 w-2.5" />
            {primaryCategory}
          </span>
        </div>

        {/* Stock Badge */}
        {product.stock !== undefined && (
          <div className="absolute top-3 right-3 z-10">
            <span
              className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                product.stock > 0
                  ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                  : "bg-rose-500/10 text-rose-400 border-rose-500/20"
              }`}
            >
              {product.stock > 0 ? `${product.stock} in stock` : "Out of stock"}
            </span>
          </div>
        )}

        {/* Icon / Visual Container */}
        <Link
          href={`/product/${product.id}`}
          className="relative z-10 p-5 rounded-2xl bg-white/5 border border-white/10 group-hover:scale-110 group-hover:rotate-2 transition-all duration-500 shadow-inner"
        >
          <ShoppingBag className="h-12 w-12 text-indigo-400 group-hover:text-amber-400 transition-colors" />
        </Link>
      </div>

      {/* Product Content */}
      <div className="flex flex-col flex-1 p-5">
        <Link href={`/product/${product.id}`}>
          <h3 className="text-base font-bold text-white mb-1.5 line-clamp-1 group-hover:text-amber-400 transition-colors">
            {product.name}
          </h3>
        </Link>

        {/* Star Rating */}
        <div className="flex items-center gap-1.5 mb-2 text-xs">
          <div className="flex text-amber-400">
            {[...Array(5)].map((_, i) => (
              <Star key={i} className="h-3.5 w-3.5 fill-amber-400" />
            ))}
          </div>
          <span className="font-bold text-amber-400 text-xs">{rating}</span>
          <span className="text-[11px] text-slate-400">({reviewCount.toLocaleString()})</span>
        </div>

        <p className="text-xs text-slate-400 mb-4 line-clamp-2 leading-relaxed">
          {product.description || "Engineered for high performance and durability."}
        </p>

        {/* Prime Next-Day Delivery Badge */}
        <div className="flex items-center gap-1.5 text-[11px] font-bold text-cyan-400 mb-4">
          <Zap className="h-3.5 w-3.5 fill-cyan-400 text-cyan-400" />
          <span>FREE Tomorrow Delivery</span>
        </div>

        {/* Price, List Price & Quick Add */}
        <div className="mt-auto flex items-center justify-between pt-3 border-t border-white/5">
          <div className="flex flex-col">
            <div className="flex items-baseline gap-1.5">
              <span className="text-lg font-black text-white">{formattedPrice}</span>
              <span className="text-[11px] text-slate-400 line-through">{formattedListPrice}</span>
            </div>
            <span className="text-[10px] text-emerald-400 font-bold">Save 15%</span>
          </div>

          <button
            onClick={() => addToCartMutation.mutate()}
            disabled={addToCartMutation.isPending || product.stock === 0}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full text-xs font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 transition-all shadow-md shadow-amber-500/20 cursor-pointer disabled:opacity-50"
            title="Quick Add to Cart"
          >
            {addToCartMutation.isPending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <>
                <ShoppingCart className="h-3.5 w-3.5" />
                <span>Add</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
