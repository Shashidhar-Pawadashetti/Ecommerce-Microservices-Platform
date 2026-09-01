"use client";

import { useState } from "react";
import { X, Scale, Check, ShoppingCart, Sparkles, Star, Zap, Layers } from "lucide-react";
import { Product } from "@/types";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useStore } from "@/providers/StoreContext";

interface ProductCompareModalProps {
  currentProduct: Product;
  allProducts: Product[];
  onClose: () => void;
}

export function ProductCompareModal({
  currentProduct,
  allProducts,
  onClose,
}: ProductCompareModalProps) {
  const queryClient = useQueryClient();
  const { showToast } = useStore();

  // Find 2 other products from same category or random
  const defaultCompetitors = allProducts
    .filter((p) => p.id !== currentProduct.id)
    .slice(0, 2);

  const [comparedProducts, setComparedProducts] = useState<Product[]>([
    currentProduct,
    ...defaultCompetitors,
  ]);

  const addToCartMutation = useMutation({
    mutationFn: async (prod: Product) => {
      const res = await fetch(`/api/gateway/cart/items`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId: prod.id, quantity: 1 }),
      });
      if (!res.ok) throw new Error("Failed to add to cart");
      return res.json();
    },
    onSuccess: (cartData, prod) => {
      queryClient.invalidateQueries({ queryKey: ["cart"] });
      showToast({
        title: "Added to Cart",
        productName: prod.name,
        priceCents: prod.priceCents,
        quantity: 1,
        cartTotalCents: cartData?.grandTotalCents || prod.priceCents,
        currency: prod.currency || "USD",
      });
    },
  });

  const comparisonAttributes = [
    { label: "Price", render: (p: Product) => ((p.priceCents || 0) / 100).toLocaleString("en-US", { style: "currency", currency: p.currency || "USD" }) },
    { label: "Customer Rating", render: (p: Product) => `${p.rating || 4.8} ★ (${(p.reviewCount || 1248).toLocaleString()} ratings)` },
    { label: "Delivery Speed", render: () => "FREE Next-Day Prime" },
    { label: "Stock Availability", render: (p: Product) => (p.stock !== undefined && p.stock > 0 ? `In Stock (${p.stock} units)` : "In Stock") },
    { label: "Power Delivery", render: (p: Product) => p.specs?.["Power Delivery"] || "100W GaN Fast Charge" },
    { label: "Connectivity", render: (p: Product) => p.specs?.["Connectivity"] || "USB-C, Bluetooth 5.4, Wi-Fi 6E" },
    { label: "Warranty Coverage", render: () => "2-Year Comprehensive" },
    { label: "Return Guarantee", render: () => "30 Days Hassle-Free" },
  ];

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-slate-900 border border-white/10 rounded-3xl p-6 sm:p-8 max-w-4xl w-full shadow-2xl text-white my-8 relative">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-white/10 mb-6">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
              <Scale className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-black text-lg text-white">Nexora AI Spec Comparison Matrix</h3>
              <p className="text-xs text-slate-400">
                Side-by-side technical evaluation against category alternatives
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-full text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Product Comparison Grid */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-white/10">
                <th className="py-4 px-3 w-1/4 text-slate-400 font-bold uppercase text-[10px]">
                  Attributes
                </th>
                {comparedProducts.map((prod, idx) => (
                  <th key={prod.id} className="py-4 px-3 w-1/4 text-center align-top">
                    <div className="flex flex-col items-center gap-2">
                      <div className="p-3 rounded-2xl bg-slate-800 text-cyan-400 border border-white/5">
                        <ShoppingCart className="h-6 w-6" />
                      </div>
                      <span className="font-bold text-xs text-white line-clamp-2 max-w-[150px]">
                        {prod.name}
                      </span>
                      {idx === 0 && (
                        <span className="px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 font-bold text-[9px] border border-cyan-500/30 uppercase">
                          Current Selection
                        </span>
                      )}
                      <button
                        onClick={() => addToCartMutation.mutate(prod)}
                        disabled={addToCartMutation.isPending}
                        className="mt-2 px-3 py-1.5 rounded-full bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-[11px] shadow-sm flex items-center gap-1 transition-all"
                      >
                        <ShoppingCart className="h-3 w-3" /> Select & Add
                      </button>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>

            <tbody className="divide-y divide-white/5">
              {comparisonAttributes.map((attr, i) => (
                <tr key={i} className="hover:bg-white/[0.02]">
                  <td className="py-3 px-3 font-semibold text-slate-400">{attr.label}</td>
                  {comparedProducts.map((prod) => (
                    <td key={prod.id} className="py-3 px-3 text-center text-slate-200 font-medium">
                      {attr.render(prod)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="pt-6 border-t border-white/10 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-full bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs transition-colors"
          >
            Done Comparing
          </button>
        </div>
      </div>
    </div>
  );
}
