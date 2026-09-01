"use client";

import Link from "next/link";
import { ShoppingBag, ArrowUpRight, Sparkles, Tag } from "lucide-react";
import { Product } from "@/types";

interface ProductCardProps {
  product: Product;
}

export function ProductCard({ product }: ProductCardProps) {
  const formattedPrice = (product.priceCents / 100).toLocaleString("en-US", {
    style: "currency",
    currency: product.currency || "USD",
  });

  const getCategoryColor = (category?: string) => {
    const cat = category?.toLowerCase() || "";
    if (cat.includes("elect")) return "from-cyan-500/20 to-blue-600/20 text-cyan-400 border-cyan-500/30";
    if (cat.includes("audio") || cat.includes("apparel")) return "from-pink-500/20 to-purple-600/20 text-pink-400 border-pink-500/30";
    if (cat.includes("comput") || cat.includes("device")) return "from-indigo-500/20 to-violet-600/20 text-indigo-400 border-indigo-500/30";
    return "from-emerald-500/20 to-teal-600/20 text-emerald-400 border-emerald-500/30";
  };

  const primaryCategory = product.categories?.[0] || product.category || "General";

  return (
    <div className="anime-stagger-item group relative flex flex-col justify-between overflow-hidden rounded-3xl glass-card border border-white/[0.08] hover:border-indigo-500/50 transition-all duration-300 hover:shadow-2xl hover:shadow-indigo-500/10">
      {/* Product Visual Header */}
      <div className="relative aspect-[4/3] w-full bg-gradient-to-b from-slate-800/50 to-slate-900/60 overflow-hidden flex items-center justify-center p-6">
        {/* Glowing backdrop */}
        <div className="absolute inset-0 bg-gradient-to-tr from-indigo-500/10 via-purple-500/10 to-pink-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

        {/* Category Pill Tag */}
        <div className="absolute top-3 left-3 z-10">
          <span
            className={`inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wider bg-gradient-to-r border backdrop-blur-md ${getCategoryColor(
              primaryCategory
            )}`}
          >
            <Tag className="h-3 w-3" />
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
        <div className="relative z-10 p-5 rounded-2xl bg-white/5 border border-white/10 group-hover:scale-110 group-hover:rotate-2 transition-all duration-500 shadow-inner">
          <ShoppingBag className="h-12 w-12 text-indigo-400 group-hover:text-pink-400 transition-colors" />
        </div>
      </div>

      {/* Product Content */}
      <div className="flex flex-col flex-1 p-5">
        <h3 className="text-base font-bold text-white mb-1.5 line-clamp-1 group-hover:text-cyan-300 transition-colors">
          {product.name}
        </h3>

        <p className="text-xs text-slate-400 mb-5 line-clamp-2 leading-relaxed">
          {product.description || "Engineered for high performance and durability."}
        </p>

        {/* Price & Action */}
        <div className="mt-auto flex items-center justify-between pt-3 border-t border-white/5">
          <div className="flex flex-col">
            <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400">
              Price
            </span>
            <span className="text-lg font-black text-transparent bg-clip-text bg-gradient-to-r from-white via-slate-100 to-slate-300">
              {formattedPrice}
            </span>
          </div>

          <Link
            href={`/product/${product.id}`}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold bg-white/10 hover:bg-gradient-to-r hover:from-indigo-600 hover:to-pink-600 text-white border border-white/10 hover:border-transparent transition-all shadow-sm group-hover:shadow-md"
          >
            <span>View</span>
            <ArrowUpRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>
    </div>
  );
}
