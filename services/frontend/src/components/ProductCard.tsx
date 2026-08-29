"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ShoppingCart } from "lucide-react";
import { Product } from "@/types";

interface ProductCardProps {
  product: Product;
}

export function ProductCard({ product }: ProductCardProps) {
  const formattedPrice = (product.priceCents / 100).toLocaleString("en-US", {
    style: "currency",
    currency: product.currency || "USD",
  });

  return (
    <motion.div
      whileHover={{ y: -5, scale: 1.02 }}
      transition={{ type: "spring", stiffness: 300, damping: 20 }}
      className="group flex flex-col justify-between overflow-hidden rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-sm hover:shadow-xl dark:hover:shadow-blue-900/10 transition-all duration-300"
    >
      <div className="relative aspect-square w-full bg-neutral-100 dark:bg-neutral-800 overflow-hidden flex items-center justify-center p-8">
        {/* Placeholder for actual product image */}
        <div className="absolute inset-0 bg-gradient-to-tr from-neutral-200 to-neutral-100 dark:from-neutral-800 dark:to-neutral-700 opacity-50 group-hover:opacity-70 transition-opacity"></div>
        <ShoppingCart className="h-20 w-20 text-neutral-300 dark:text-neutral-600 drop-shadow-md z-10 transition-transform group-hover:scale-110 duration-500" />
      </div>

      <div className="flex flex-col flex-1 p-5">
        <div className="flex items-center gap-2 mb-2">
          {product.categories?.slice(0, 2).map((cat) => (
            <span key={cat} className="text-xs font-semibold text-blue-600 bg-blue-50 dark:bg-blue-900/30 dark:text-blue-400 px-2 py-1 rounded-full uppercase tracking-wider">
              {cat}
            </span>
          ))}
        </div>
        
        <h2 className="text-lg font-bold text-neutral-900 dark:text-white mb-2 line-clamp-1 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
          {product.name}
        </h2>
        
        <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-6 line-clamp-2">
          {product.description}
        </p>
        
        <div className="mt-auto flex items-center justify-between">
          <span className="text-xl font-extrabold text-neutral-900 dark:text-white">
            {formattedPrice}
          </span>
          <Link
            href={`/product/${product.id}`}
            className="inline-flex h-9 items-center justify-center rounded-full bg-neutral-900 dark:bg-white px-4 py-2 text-sm font-medium text-white dark:text-neutral-900 hover:bg-neutral-800 dark:hover:bg-neutral-100 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2 transition-colors"
          >
            Details
          </Link>
        </div>
      </div>
    </motion.div>
  );
}
