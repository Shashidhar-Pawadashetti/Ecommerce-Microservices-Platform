"use client";

import { Suspense, useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRouter, useSearchParams } from "next/navigation";
import { Search, Loader2, Sparkles, Filter, PackageOpen } from "lucide-react";
import { LandingPage } from "@/components/LandingPage";
import { ProductCard } from "@/components/ProductCard";
import { AnimeStagger } from "@/components/anime/AnimeStagger";
import { AnimeText } from "@/components/anime/AnimeText";
import { Product } from "@/types";

const CATEGORIES = [
  { id: "", label: "All Items" },
  { id: "electronics", label: "⚡ Electronics" },
  { id: "clothing", label: "👕 Apparel" },
  { id: "books", label: "📚 Books" },
  { id: "accessories", label: "🎧 Accessories" },
];

function HomeContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [searchTerm, setSearchTerm] = useState(searchParams.get("q") || "");
  const [category, setCategory] = useState(searchParams.get("category") || "");

  // Update URL when state changes
  useEffect(() => {
    const params = new URLSearchParams();
    if (searchTerm) params.set("q", searchTerm);
    if (category) params.set("category", category);

    const newUrl = params.toString() ? `/?${params.toString()}` : "/";
    router.replace(newUrl, { scroll: false });
  }, [searchTerm, category, router]);

  const { data: products, isLoading, error } = useQuery<Product[]>({
    queryKey: ["products", searchTerm, category],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (searchTerm) params.append("q", searchTerm);
      if (category) params.append("category", category);

      const res = await fetch(`/api/gateway/catalog/products?${params.toString()}`);
      if (!res.ok) {
        throw new Error("Failed to fetch products from Catalog Service");
      }
      const data = await res.json();
      return data.items || [];
    },
  });

  return (
    <div className="w-full flex flex-col min-h-screen">
      {/* ── HERO LANDING PAGE SECTION ── */}
      <LandingPage />

      {/* ── LIVE CATALOG SECTION ── */}
      <section id="catalog-section" className="w-full max-w-7xl mx-auto px-4 md:px-6 py-16">
        {/* Section Header */}
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-end gap-6 mb-12">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 mb-3">
              <Sparkles className="h-3.5 w-3.5" /> Curated Marketplace
            </div>
            <h2 className="text-3xl sm:text-4xl font-black text-white">
              Explore Our <AnimeText text="Live Products" gradient="neon" delay={150} />
            </h2>
            <p className="text-slate-400 text-sm mt-1 max-w-md">
              Real-time inventory synced with MongoDB 8.0 and instant Redis cart reservation.
            </p>
          </div>

          {/* Search & Category Filter Controls */}
          <div className="flex flex-col sm:flex-row gap-3 w-full lg:w-auto">
            {/* Search Input */}
            <div className="relative group w-full sm:w-72">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 group-focus-within:text-cyan-400 transition-colors" />
              <input
                type="text"
                placeholder="Search products..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 pr-4 py-2.5 w-full rounded-2xl border border-white/10 bg-slate-900/80 text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/30 focus:border-cyan-500 transition-all text-sm shadow-inner"
              />
            </div>
          </div>
        </div>

        {/* Category Pill Filters */}
        <div className="flex items-center gap-2 overflow-x-auto pb-4 mb-10 no-scrollbar">
          {CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setCategory(cat.id)}
              className={`px-4 py-2 rounded-full text-xs font-bold whitespace-nowrap transition-all duration-200 cursor-pointer ${
                category === cat.id
                  ? "bg-gradient-to-r from-indigo-600 to-pink-600 text-white shadow-lg shadow-indigo-500/25 border-transparent scale-105"
                  : "bg-slate-900/60 hover:bg-slate-800 text-slate-300 border border-white/5 hover:border-white/20"
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* Product Grid Content */}
        {isLoading ? (
          <div className="flex flex-col items-center justify-center h-64 gap-4 glass-panel rounded-3xl p-8">
            <Loader2 className="h-10 w-10 animate-spin text-cyan-400" />
            <p className="text-slate-400 text-sm font-semibold">
              Querying FastAPI Catalog Service...
            </p>
          </div>
        ) : error ? (
          <div className="glass-panel border border-rose-500/30 bg-rose-950/20 text-rose-300 p-8 rounded-3xl text-center">
            <p className="font-bold text-lg mb-1">Unable to load catalog products</p>
            <p className="text-xs text-rose-400">{(error as Error).message}</p>
          </div>
        ) : products?.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-center p-8 glass-panel rounded-3xl border border-dashed border-slate-800">
            <div className="p-4 rounded-full bg-slate-800/80 mb-3 text-slate-400">
              <PackageOpen className="h-8 w-8" />
            </div>
            <h3 className="text-lg font-bold text-white mb-1">No products found</h3>
            <p className="text-xs text-slate-400 max-w-sm">
              No matching products for &quot;{searchTerm}&quot; {category ? `in ${category}` : ""}. Try resetting filters.
            </p>
          </div>
        ) : (
          <AnimeStagger
            className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6"
            delay={100}
            staggerDelay={60}
          >
            {products?.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </AnimeStagger>
        )}
      </section>
    </div>
  );
}

export default function Home() {
  return (
    <Suspense
      fallback={
        <div className="flex h-screen items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
        </div>
      }
    >
      <HomeContent />
    </Suspense>
  );
}
