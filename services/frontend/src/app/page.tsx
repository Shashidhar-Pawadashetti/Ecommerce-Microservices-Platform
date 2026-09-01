"use client";

import { Suspense, useEffect, useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Search,
  Loader2,
  Sparkles,
  Flame,
  ArrowUpDown,
  Zap,
  Tag,
  PackageOpen,
  Filter,
} from "lucide-react";
import { LandingPage } from "@/components/LandingPage";
import { ProductCard } from "@/components/ProductCard";
import { CatalogFilterSidebar } from "@/components/amazon/CatalogFilterSidebar";
import { AnimeStagger } from "@/components/anime/AnimeStagger";
import { AnimeText } from "@/components/anime/AnimeText";
import { Product } from "@/types";
import { useStore } from "@/providers/StoreContext";

function HomeContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { searchCategory, setSearchCategory } = useStore();

  const [searchTerm, setSearchTerm] = useState(searchParams.get("q") || "");
  const [category, setCategory] = useState(searchParams.get("category") || searchCategory || "");
  const [priceRange, setPriceRange] = useState("");
  const [minRating, setMinRating] = useState(0);
  const [isPrimeOnly, setIsPrimeOnly] = useState(false);
  const [inStockOnly, setInStockOnly] = useState(false);
  const [sortBy, setSortBy] = useState("featured");

  // Sync with URL
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

  // Client-side faceted filtering & sorting
  const filteredProducts = useMemo(() => {
    if (!products) return [];

    let list = [...products];

    // Price range filter
    if (priceRange) {
      const [minStr, maxStr] = priceRange.split("-");
      const minCents = parseInt(minStr) * 100;
      const maxCents = parseInt(maxStr) * 100;
      list = list.filter(
        (p) => p.priceCents >= minCents && p.priceCents <= maxCents
      );
    }

    // Min rating filter
    if (minRating > 0) {
      list = list.filter((p) => (p.rating || 4.8) >= minRating);
    }

    // In-stock only filter
    if (inStockOnly) {
      list = list.filter((p) => p.stock === undefined || p.stock > 0);
    }

    // Sorting
    if (sortBy === "price-asc") {
      list.sort((a, b) => a.priceCents - b.priceCents);
    } else if (sortBy === "price-desc") {
      list.sort((a, b) => b.priceCents - a.priceCents);
    } else if (sortBy === "rating") {
      list.sort((a, b) => (b.rating || 4.8) - (a.rating || 4.8));
    }

    return list;
  }, [products, priceRange, minRating, inStockOnly, sortBy]);

  const handleClearFilters = () => {
    setSearchTerm("");
    setCategory("");
    setSearchCategory("");
    setPriceRange("");
    setMinRating(0);
    setIsPrimeOnly(false);
    setInStockOnly(false);
    setSortBy("featured");
  };

  return (
    <div className="w-full flex flex-col min-h-screen">
      {/* ── HERO LANDING PAGE SECTION ── */}
      <LandingPage />

      {/* ── LIVE AMAZON CATALOG SECTION ── */}
      <section id="catalog-section" className="w-full max-w-7xl mx-auto px-4 md:px-6 py-12">
        {/* Deal of the Day Banner */}
        <div className="mb-10 p-4 sm:p-6 rounded-3xl bg-gradient-to-r from-amber-500/20 via-orange-500/15 to-indigo-950/40 border border-amber-500/30 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-xl">
          <div className="flex items-center gap-3.5">
            <div className="p-3 rounded-2xl bg-amber-500 text-slate-950 font-black">
              <Flame className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-black uppercase tracking-wider px-2 py-0.5 rounded bg-amber-500 text-slate-950">
                  Deal of the Day
                </span>
                <span className="text-xs font-bold text-amber-400">Ends in 06:42:19</span>
              </div>
              <h3 className="text-base sm:text-lg font-black text-white mt-1">
                Save up to 25% on High-Performance Microservices Hardware
              </h3>
            </div>
          </div>
          <button
            onClick={() => setPriceRange("100-300")}
            className="px-5 py-2.5 rounded-full bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs shadow-md transition-colors shrink-0 cursor-pointer"
          >
            Explore Deals
          </button>
        </div>

        {/* Results Bar & Sort Control */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8 pb-4 border-b border-white/10">
          <div>
            <h2 className="text-2xl sm:text-3xl font-black text-white flex items-center gap-2">
              <span>Marketplace Results</span>
              {category && (
                <span className="text-sm font-normal text-slate-400">
                  in <strong className="text-amber-400">&ldquo;{category}&rdquo;</strong>
                </span>
              )}
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              Showing {filteredProducts.length} of {products?.length || 0} products available
            </p>
          </div>

          {/* Sort By Dropdown */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400">Sort by:</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="bg-slate-800 border border-white/10 text-white rounded-xl px-3 py-1.5 text-xs font-bold focus:ring-2 focus:ring-amber-400 cursor-pointer"
            >
              <option value="featured">Featured</option>
              <option value="price-asc">Price: Low to High</option>
              <option value="price-desc">Price: High to Low</option>
              <option value="rating">Avg. Customer Review</option>
            </select>
          </div>
        </div>

        {/* Main Layout: Sidebar + Products Grid */}
        <div className="flex flex-col lg:flex-row gap-8 items-start">
          {/* Faceted Sidebar */}
          <CatalogFilterSidebar
            category={category}
            onCategoryChange={(cat) => {
              setCategory(cat);
              setSearchCategory(cat);
            }}
            priceRange={priceRange}
            onPriceRangeChange={setPriceRange}
            minRating={minRating}
            onMinRatingChange={setMinRating}
            isPrimeOnly={isPrimeOnly}
            onPrimeToggle={setIsPrimeOnly}
            inStockOnly={inStockOnly}
            onInStockToggle={setInStockOnly}
            onClearFilters={handleClearFilters}
          />

          {/* Product Grid / States */}
          <div className="flex-1 w-full">
            {isLoading ? (
              <div className="flex flex-col items-center justify-center h-64 gap-4 glass-panel rounded-3xl p-8">
                <Loader2 className="h-10 w-10 animate-spin text-amber-400" />
                <p className="text-slate-400 text-sm font-semibold">
                  Querying FastAPI Catalog Service & MongoDB...
                </p>
              </div>
            ) : error ? (
              <div className="glass-panel border border-rose-500/30 bg-rose-950/20 text-rose-300 p-8 rounded-3xl text-center">
                <p className="font-bold text-lg mb-1">Unable to load catalog products</p>
                <p className="text-xs text-rose-400">{(error as Error).message}</p>
              </div>
            ) : filteredProducts.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-64 text-center p-8 glass-panel rounded-3xl border border-dashed border-slate-800">
                <div className="p-4 rounded-full bg-slate-800/80 mb-3 text-slate-400">
                  <PackageOpen className="h-8 w-8" />
                </div>
                <h3 className="text-lg font-bold text-white mb-1">No products match your filters</h3>
                <p className="text-xs text-slate-400 max-w-sm mb-4">
                  Try clearing some filter criteria to expand your results.
                </p>
                <button
                  onClick={handleClearFilters}
                  className="px-4 py-2 rounded-full bg-slate-800 hover:bg-slate-700 text-amber-400 font-bold text-xs"
                >
                  Reset All Filters
                </button>
              </div>
            ) : (
              <AnimeStagger
                className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6"
                delay={100}
                staggerDelay={50}
              >
                {filteredProducts.map((product) => (
                  <ProductCard key={product.id} product={product} />
                ))}
              </AnimeStagger>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}

export default function Home() {
  return (
    <Suspense
      fallback={
        <div className="flex h-screen items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-amber-500" />
        </div>
      }
    >
      <HomeContent />
    </Suspense>
  );
}
