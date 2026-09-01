"use client";

import { useQuery } from "@tanstack/react-query";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useState } from "react";
import { Product } from "@/types";
import {
  ArrowLeft,
  ShoppingBag,
  Star,
  ShieldCheck,
  Zap,
  Truck,
  RotateCcw,
  Loader2,
  Tag,
  Check,
  ChevronRight,
  Bell,
  Scale,
} from "lucide-react";
import { PageWrapper } from "@/components/anime/PageWrapper";
import { ProductBuyBox } from "@/components/marketplace/ProductBuyBox";
import { FrequentlyBoughtTogether } from "@/components/marketplace/FrequentlyBoughtTogether";
import { ProductReviews } from "@/components/marketplace/ProductReviews";
import { PriceWatcherModal } from "@/components/marketplace/PriceWatcherModal";
import { ProductCompareModal } from "@/components/marketplace/ProductCompareModal";

export default function ProductDetailPage() {
  const { id } = useParams();
  const [selectedAngle, setSelectedAngle] = useState(0);
  const [isPriceWatcherOpen, setIsPriceWatcherOpen] = useState(false);
  const [isCompareOpen, setIsCompareOpen] = useState(false);

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

  const { data: allProducts } = useQuery<Product[]>({
    queryKey: ["products-all"],
    queryFn: async () => {
      const res = await fetch(`/api/gateway/catalog/products?limit=20`);
      if (!res.ok) return [];
      const data = await res.json();
      return data.items || [];
    },
  });

  if (isLoading) {
    return (
      <div className="container mx-auto p-8 flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <Loader2 className="h-10 w-10 animate-spin text-cyan-400" />
        <p className="text-slate-400 text-sm font-semibold">Loading product details from MongoDB...</p>
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
        <Link
          href="/"
          className="px-6 py-2.5 rounded-full bg-slate-800 text-white font-bold text-xs hover:bg-slate-700"
        >
          Return to Catalog
        </Link>
      </div>
    );
  }

  const primaryCategory = product.categories?.[0] || product.category || "Electronics";
  const angles = ["Front View", "Angled Profile", "Port Details", "In-Box Packaging"];

  const specs = product.specs || {
    "Brand": "Nexora Engineering Labs",
    "Model Number": `NX-${product.id.toUpperCase()}`,
    "Connectivity": "USB4 Thunderbolt, Bluetooth 5.4, Dual Band Wi-Fi 6E",
    "Power Delivery": "100W GaN Fast Charging",
    "Warranty": "2-Year Comprehensive Hardware Warranty",
    "Package Dimensions": "12.4 x 8.6 x 3.2 inches",
    "Item Weight": "2.45 lbs",
  };

  return (
    <PageWrapper className="max-w-7xl mx-auto px-4 md:px-6 py-6">
      {/* Breadcrumbs */}
      <nav className="flex items-center gap-1.5 text-xs text-slate-400 mb-6">
        <Link href="/" className="hover:text-cyan-400 transition-colors">
          Home
        </Link>
        <ChevronRight className="h-3 w-3 text-slate-600" />
        <Link href={`/?category=${primaryCategory.toLowerCase()}`} className="hover:text-cyan-400 transition-colors">
          {primaryCategory}
        </Link>
        <ChevronRight className="h-3 w-3 text-slate-600" />
        <span className="text-slate-200 font-medium truncate max-w-xs">{product.name}</span>
      </nav>

      {/* Main Showcase Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start mb-12">
        {/* Left Column: Image Gallery with Angle Selector */}
        <div className="lg:col-span-5 flex flex-col-reverse sm:flex-row gap-4">
          {/* Thumbnails */}
          <div className="flex sm:flex-col gap-2.5 overflow-x-auto">
            {angles.map((angle, idx) => (
              <button
                key={idx}
                onClick={() => setSelectedAngle(idx)}
                className={`p-2.5 rounded-2xl border transition-all shrink-0 text-left cursor-pointer ${
                  selectedAngle === idx
                    ? "border-cyan-400 bg-cyan-500/10 shadow-md ring-1 ring-cyan-400"
                    : "border-white/10 bg-slate-900/60 hover:border-white/20"
                }`}
              >
                <div className="w-12 h-12 flex items-center justify-center bg-slate-900 rounded-xl text-cyan-400">
                  <ShoppingBag className="h-6 w-6" />
                </div>
              </button>
            ))}
          </div>

          {/* Main Visual Frame */}
          <div className="flex-1 aspect-square glass-panel bg-slate-900/80 rounded-3xl p-10 flex flex-col items-center justify-center relative overflow-hidden border border-white/10 shadow-2xl">
            <div className="absolute top-4 left-4 z-10 flex items-center gap-1 text-[10px] font-bold px-2.5 py-1 rounded-full bg-gradient-to-r from-cyan-500 to-indigo-600 text-slate-950 uppercase tracking-wider">
              Featured Choice
            </div>
            <div className="p-10 rounded-3xl bg-white/5 border border-white/10 shadow-inner relative z-10 hover:scale-105 transition-transform duration-500">
              <ShoppingBag className="h-36 w-36 text-cyan-400" />
            </div>
            <span className="text-[11px] text-slate-400 mt-4 font-semibold">
              {angles[selectedAngle]} • Ultra-HD Render
            </span>
          </div>
        </div>

        {/* Center Column: Product Specifications & Details */}
        <div className="lg:col-span-4 flex flex-col justify-between">
          <div>
            <span className="text-xs font-bold text-cyan-400 uppercase tracking-wider">
              Brand: Nexora Hardware Labs
            </span>

            <h1 className="text-2xl sm:text-3xl font-black text-white mt-1 mb-2">
              {product.name}
            </h1>

            {/* Star Rating & Reviews link */}
            <div className="flex items-center gap-2 pb-4 mb-4 border-b border-white/10">
              <div className="flex text-amber-400">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} className="h-4 w-4 fill-amber-400" />
                ))}
              </div>
              <span className="text-xs font-bold text-amber-400">4.8</span>
              <span className="text-xs text-slate-400 hover:text-cyan-400 transition-colors cursor-pointer">
                1,248 ratings
              </span>
            </div>

            {/* Highlights bullet points */}
            <div className="space-y-2 mb-6 text-xs text-slate-300">
              <p className="font-bold text-white uppercase tracking-wider text-[11px] mb-2">
                About this item
              </p>
              <ul className="space-y-2 list-disc list-inside text-slate-300">
                <li>{product.description}</li>
                <li>Built with real-time Kafka event bus synchronization and sub-8ms transaction latency.</li>
                <li>Universal USB-C Power Delivery and global adaptive voltage support.</li>
                <li>Backed by Nexora 30-day return policy and 2-year warranty coverage.</li>
              </ul>
            </div>

            {/* Technical Specifications Summary Table */}
            <div className="glass-card rounded-2xl p-4 border border-white/5 text-xs mb-4">
              <p className="font-bold text-white uppercase text-[11px] mb-3">
                Core Specifications
              </p>
              <div className="divide-y divide-white/5">
                {Object.entries(specs).slice(0, 4).map(([key, value]) => (
                  <div key={key} className="py-1.5 flex justify-between">
                    <span className="text-slate-400">{key}:</span>
                    <span className="font-semibold text-slate-200">{value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Nexora Buy Box */}
        <div className="lg:col-span-3">
          <ProductBuyBox
            product={product}
            onOpenPriceWatcher={() => setIsPriceWatcherOpen(true)}
            onOpenComparison={() => setIsCompareOpen(true)}
          />
        </div>
      </div>

      {/* Frequently Bought Together Bundle */}
      <FrequentlyBoughtTogether mainProduct={product} />

      {/* Complete Technical Specifications Full Table */}
      <div className="glass-panel rounded-3xl p-6 sm:p-8 border border-white/[0.08] shadow-xl my-10">
        <div className="flex items-center justify-between pb-3 border-b border-white/10 mb-4">
          <h3 className="text-lg font-bold text-white">
            Complete Hardware & Engineering Specifications
          </h3>
          <button
            onClick={() => setIsCompareOpen(true)}
            className="text-xs text-cyan-400 hover:text-cyan-300 font-bold flex items-center gap-1 cursor-pointer"
          >
            <Scale className="h-4 w-4" /> Compare with Competitors
          </button>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-3 text-xs">
          {Object.entries(specs).map(([key, val]) => (
            <div key={key} className="flex justify-between py-2 border-b border-white/5">
              <span className="text-slate-400 font-medium">{key}</span>
              <span className="text-slate-200 font-bold">{val}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Customer Reviews Section */}
      <ProductReviews productId={product.id} productName={product.name} />

      {/* Price Watcher Modal */}
      {isPriceWatcherOpen && (
        <PriceWatcherModal
          product={product}
          onClose={() => setIsPriceWatcherOpen(false)}
        />
      )}

      {/* Product Comparison Matrix Modal */}
      {isCompareOpen && (
        <ProductCompareModal
          currentProduct={product}
          allProducts={allProducts || []}
          onClose={() => setIsCompareOpen(false)}
        />
      )}
    </PageWrapper>
  );
}
