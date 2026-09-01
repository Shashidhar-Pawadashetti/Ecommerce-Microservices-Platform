"use client";

import { Star, Zap, RotateCcw, Check } from "lucide-react";

interface CatalogFilterSidebarProps {
  category: string;
  onCategoryChange: (cat: string) => void;
  priceRange: string;
  onPriceRangeChange: (range: string) => void;
  minRating: number;
  onMinRatingChange: (rating: number) => void;
  isPrimeOnly: boolean;
  onPrimeToggle: (val: boolean) => void;
  inStockOnly: boolean;
  onInStockToggle: (val: boolean) => void;
  onClearFilters: () => void;
}

const CATEGORIES = [
  { id: "", label: "All Categories" },
  { id: "electronics", label: "Electronics" },
  { id: "clothing", label: "Apparel & Fashion" },
  { id: "books", label: "Books & Literature" },
  { id: "accessories", label: "Audio & Accessories" },
];

const PRICE_RANGES = [
  { id: "", label: "Any Price" },
  { id: "0-50", label: "Under $50" },
  { id: "50-100", label: "$50 to $100" },
  { id: "100-300", label: "$100 to $300" },
  { id: "300-9999", label: "$300 & Above" },
];

export function CatalogFilterSidebar({
  category,
  onCategoryChange,
  priceRange,
  onPriceRangeChange,
  minRating,
  onMinRatingChange,
  isPrimeOnly,
  onPrimeToggle,
  inStockOnly,
  onInStockToggle,
  onClearFilters,
}: CatalogFilterSidebarProps) {
  return (
    <aside className="w-full lg:w-64 glass-panel bg-slate-900/70 rounded-3xl p-5 border border-white/[0.08] text-xs space-y-6 shrink-0">
      <div className="flex items-center justify-between pb-3 border-b border-white/10">
        <span className="font-bold text-sm text-white">Filters</span>
        <button
          onClick={onClearFilters}
          className="text-[11px] text-amber-400 hover:text-amber-300 font-semibold cursor-pointer"
        >
          Reset All
        </button>
      </div>

      {/* Prime Delivery Filter */}
      <div>
        <h4 className="font-bold text-white uppercase tracking-wider text-[11px] mb-2.5">
          Delivery Program
        </h4>
        <label className="flex items-center gap-2 text-slate-300 cursor-pointer select-none hover:text-white">
          <input
            type="checkbox"
            checked={isPrimeOnly}
            onChange={(e) => onPrimeToggle(e.target.checked)}
            className="rounded border-white/20 bg-slate-800 text-amber-500 focus:ring-amber-400"
          />
          <span className="inline-flex items-center gap-1 font-bold text-cyan-400">
            <Zap className="h-3.5 w-3.5 fill-cyan-400" /> EcoPrime FREE Delivery
          </span>
        </label>
      </div>

      {/* Department / Category Filter */}
      <div>
        <h4 className="font-bold text-white uppercase tracking-wider text-[11px] mb-2.5">
          Department
        </h4>
        <ul className="space-y-1.5">
          {CATEGORIES.map((cat) => (
            <li key={cat.id}>
              <button
                onClick={() => onCategoryChange(cat.id)}
                className={`w-full text-left py-1 px-2 rounded-xl transition-colors cursor-pointer ${
                  category === cat.id
                    ? "font-bold text-amber-400 bg-amber-500/10"
                    : "text-slate-300 hover:text-white hover:bg-white/5"
                }`}
              >
                {cat.label}
              </button>
            </li>
          ))}
        </ul>
      </div>

      {/* Customer Reviews Star Filter */}
      <div>
        <h4 className="font-bold text-white uppercase tracking-wider text-[11px] mb-2.5">
          Customer Reviews
        </h4>
        <div className="space-y-1.5">
          {[4, 3, 2, 1].map((stars) => (
            <button
              key={stars}
              onClick={() => onMinRatingChange(minRating === stars ? 0 : stars)}
              className={`w-full flex items-center gap-1.5 py-1 px-2 rounded-xl transition-colors cursor-pointer ${
                minRating === stars
                  ? "font-bold text-amber-400 bg-amber-500/10"
                  : "text-slate-300 hover:text-white hover:bg-white/5"
              }`}
            >
              <div className="flex text-amber-400">
                {[...Array(5)].map((_, i) => (
                  <Star
                    key={i}
                    className={`h-3.5 w-3.5 ${
                      i < stars ? "fill-amber-400" : "text-slate-600"
                    }`}
                  />
                ))}
              </div>
              <span className="text-[11px] text-slate-400">& Up</span>
            </button>
          ))}
        </div>
      </div>

      {/* Price Range Filter */}
      <div>
        <h4 className="font-bold text-white uppercase tracking-wider text-[11px] mb-2.5">
          Price Range
        </h4>
        <ul className="space-y-1.5">
          {PRICE_RANGES.map((r) => (
            <li key={r.id}>
              <button
                onClick={() => onPriceRangeChange(priceRange === r.id ? "" : r.id)}
                className={`w-full text-left py-1 px-2 rounded-xl transition-colors cursor-pointer ${
                  priceRange === r.id
                    ? "font-bold text-amber-400 bg-amber-500/10"
                    : "text-slate-300 hover:text-white hover:bg-white/5"
                }`}
              >
                {r.label}
              </button>
            </li>
          ))}
        </ul>
      </div>

      {/* Availability Filter */}
      <div>
        <h4 className="font-bold text-white uppercase tracking-wider text-[11px] mb-2.5">
          Availability
        </h4>
        <label className="flex items-center gap-2 text-slate-300 cursor-pointer select-none hover:text-white">
          <input
            type="checkbox"
            checked={inStockOnly}
            onChange={(e) => onInStockToggle(e.target.checked)}
            className="rounded border-white/20 bg-slate-800 text-amber-500 focus:ring-amber-400"
          />
          <span>In Stock Only</span>
        </label>
      </div>
    </aside>
  );
}
