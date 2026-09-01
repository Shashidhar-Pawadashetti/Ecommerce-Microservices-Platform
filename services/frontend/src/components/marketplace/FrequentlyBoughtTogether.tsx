"use client";

import { useState } from "react";
import { Plus, Check, ShoppingCart, Loader2, Sparkles, Tag } from "lucide-react";
import { Product } from "@/types";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useStore } from "@/providers/StoreContext";

interface FrequentlyBoughtTogetherProps {
  mainProduct: Product;
}

export function FrequentlyBoughtTogether({ mainProduct }: FrequentlyBoughtTogetherProps) {
  const queryClient = useQueryClient();
  const { showToast } = useStore();

  const complementaryItems = [
    {
      id: `acc-${mainProduct.id}-1`,
      name: `Ultra-Shield Braided USB4 Thunderbolt Cable (6.6ft)`,
      priceCents: 1999,
      checked: true,
    },
    {
      id: `acc-${mainProduct.id}-2`,
      name: `Ergonomic Anodized Aluminum Display Mount`,
      priceCents: 2999,
      checked: true,
    },
  ];

  const [selectedItems, setSelectedItems] = useState<{ [id: string]: boolean }>({
    main: true,
    [complementaryItems[0].id]: true,
    [complementaryItems[1].id]: true,
  });

  const toggleItem = (id: string) => {
    setSelectedItems((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  let rawTotal = 0;
  if (selectedItems.main) rawTotal += mainProduct.priceCents;
  if (selectedItems[complementaryItems[0].id]) rawTotal += complementaryItems[0].priceCents;
  if (selectedItems[complementaryItems[1].id]) rawTotal += complementaryItems[1].priceCents;

  const bundleDiscountCents = Math.round(rawTotal * 0.1);
  const finalBundleTotalCents = rawTotal - bundleDiscountCents;

  const addBundleMutation = useMutation({
    mutationFn: async () => {
      if (selectedItems.main) {
        await fetch(`/api/gateway/cart/items`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ productId: mainProduct.id, quantity: 1 }),
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cart"] });
      showToast({
        title: "Bundle Added to Cart",
        productName: `Frequently Bought Together Bundle (${mainProduct.name})`,
        priceCents: finalBundleTotalCents,
        quantity: 1,
        cartTotalCents: finalBundleTotalCents,
        currency: mainProduct.currency || "USD",
      });
    },
  });

  const currency = mainProduct.currency || "USD";

  return (
    <div className="glass-panel rounded-3xl p-6 sm:p-8 border border-white/[0.08] shadow-xl my-10">
      <div className="flex items-center gap-2 mb-6">
        <Sparkles className="h-5 w-5 text-cyan-400" />
        <h3 className="text-lg font-bold text-white">Frequently Bought Together</h3>
      </div>

      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-8">
        {/* Thumbnails + Plus Row */}
        <div className="flex flex-wrap items-center gap-3 sm:gap-4">
          {/* Main Product Card */}
          <div
            className={`p-4 rounded-2xl border transition-all ${
              selectedItems.main
                ? "bg-slate-800/90 border-cyan-500/60 shadow-lg shadow-cyan-500/10"
                : "bg-slate-900/40 border-white/5 opacity-50"
            }`}
          >
            <div className="h-20 w-20 flex items-center justify-center bg-slate-900 rounded-xl mb-2 text-cyan-400">
              <ShoppingCart className="h-8 w-8" />
            </div>
            <p className="text-[11px] font-bold text-white truncate max-w-[100px]">
              {mainProduct.name}
            </p>
            <p className="text-[10px] font-bold text-cyan-300">
              {((mainProduct.priceCents || 0) / 100).toLocaleString("en-US", {
                style: "currency",
                currency,
              })}
            </p>
          </div>

          <Plus className="h-5 w-5 text-slate-500 shrink-0" />

          {/* Complementary 1 */}
          <div
            className={`p-4 rounded-2xl border transition-all ${
              selectedItems[complementaryItems[0].id]
                ? "bg-slate-800/90 border-cyan-500/60 shadow-lg shadow-cyan-500/10"
                : "bg-slate-900/40 border-white/5 opacity-50"
            }`}
          >
            <div className="h-20 w-20 flex items-center justify-center bg-slate-900 rounded-xl mb-2 text-indigo-400">
              <Tag className="h-8 w-8" />
            </div>
            <p className="text-[11px] font-bold text-white truncate max-w-[100px]">
              USB4 Cable
            </p>
            <p className="text-[10px] font-bold text-cyan-300">
              {((complementaryItems[0].priceCents || 0) / 100).toLocaleString("en-US", {
                style: "currency",
                currency,
              })}
            </p>
          </div>

          <Plus className="h-5 w-5 text-slate-500 shrink-0" />

          {/* Complementary 2 */}
          <div
            className={`p-4 rounded-2xl border transition-all ${
              selectedItems[complementaryItems[1].id]
                ? "bg-slate-800/90 border-cyan-500/60 shadow-lg shadow-cyan-500/10"
                : "bg-slate-900/40 border-white/5 opacity-50"
            }`}
          >
            <div className="h-20 w-20 flex items-center justify-center bg-slate-900 rounded-xl mb-2 text-pink-400">
              <Sparkles className="h-8 w-8" />
            </div>
            <p className="text-[11px] font-bold text-white truncate max-w-[100px]">
              Display Mount
            </p>
            <p className="text-[10px] font-bold text-cyan-300">
              {((complementaryItems[1].priceCents || 0) / 100).toLocaleString("en-US", {
                style: "currency",
                currency,
              })}
            </p>
          </div>
        </div>

        {/* Bundle Summary & CTA */}
        <div className="glass-card p-5 rounded-2xl border border-white/10 w-full lg:w-72 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs text-slate-400">Bundle Price:</span>
              <span className="text-xl font-black text-cyan-400">
                {((finalBundleTotalCents || 0) / 100).toLocaleString("en-US", {
                  style: "currency",
                  currency,
                })}
              </span>
            </div>
            <p className="text-[11px] text-emerald-400 font-bold mb-4">
              Bundle Savings: 10% Instant Discount
            </p>
          </div>

          <button
            onClick={() => addBundleMutation.mutate()}
            disabled={addBundleMutation.isPending}
            className="w-full py-2.5 px-4 rounded-full bg-gradient-to-r from-cyan-500 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-slate-950 font-bold text-xs shadow-md shadow-cyan-500/20 flex items-center justify-center gap-2 transition-all cursor-pointer"
          >
            {addBundleMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                <ShoppingCart className="h-4 w-4" /> Add Bundle to Cart
              </>
            )}
          </button>
        </div>
      </div>

      {/* Checkbox List */}
      <div className="mt-6 pt-5 border-t border-white/5 space-y-2.5 text-xs text-slate-300">
        <label className="flex items-center gap-2.5 cursor-pointer">
          <input
            type="checkbox"
            checked={selectedItems.main}
            onChange={() => toggleItem("main")}
            className="rounded border-white/20 bg-slate-800 text-cyan-500 focus:ring-cyan-400"
          />
          <span>
            <strong className="text-white font-semibold">This item:</strong> {mainProduct.name} (
            {((mainProduct.priceCents || 0) / 100).toLocaleString("en-US", {
              style: "currency",
              currency,
            })}
            )
          </span>
        </label>

        <label className="flex items-center gap-2.5 cursor-pointer">
          <input
            type="checkbox"
            checked={selectedItems[complementaryItems[0].id]}
            onChange={() => toggleItem(complementaryItems[0].id)}
            className="rounded border-white/20 bg-slate-800 text-cyan-500 focus:ring-cyan-400"
          />
          <span>
            {complementaryItems[0].name} (
            {((complementaryItems[0].priceCents || 0) / 100).toLocaleString("en-US", {
              style: "currency",
              currency,
            })}
            )
          </span>
        </label>

        <label className="flex items-center gap-2.5 cursor-pointer">
          <input
            type="checkbox"
            checked={selectedItems[complementaryItems[1].id]}
            onChange={() => toggleItem(complementaryItems[1].id)}
            className="rounded border-white/20 bg-slate-800 text-cyan-500 focus:ring-cyan-400"
          />
          <span>
            {complementaryItems[1].name} (
            {((complementaryItems[1].priceCents || 0) / 100).toLocaleString("en-US", {
              style: "currency",
              currency,
            })}
            )
          </span>
        </label>
      </div>
    </div>
  );
}
