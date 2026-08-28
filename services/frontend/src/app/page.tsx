"use client";

import { Suspense } from "react";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";

interface Product {
  id: string;
  name: string;
  description: string;
  priceCents: number;
  currency: string;
  stock: number;
  categories: string[];
}

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
        throw new Error("Failed to fetch products");
      }
      return res.json();
    },
  });

  return (
    <div className="container mx-auto p-4">
      <header className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold">Ecommerce Catalog</h1>
        <div>
          <Link href="/login" className="text-blue-500 hover:underline mr-4">Login</Link>
          <Link href="/signup" className="text-green-500 hover:underline">Sign up</Link>
        </div>
      </header>

      <div className="flex gap-4 mb-8">
        <input
          type="text"
          placeholder="Search products..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="border p-2 rounded flex-grow"
        />
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="border p-2 rounded"
        >
          <option value="">All Categories</option>
          <option value="electronics">Electronics</option>
          <option value="clothing">Clothing</option>
          <option value="books">Books</option>
        </select>
      </div>

      {isLoading ? (
        <p>Loading products...</p>
      ) : error ? (
        <p className="text-red-500">Error: {(error as Error).message}</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {products?.map((product) => (
            <div key={product.id} className="border p-4 rounded shadow hover:shadow-lg transition">
              <h2 className="text-xl font-semibold mb-2">{product.name}</h2>
              <p className="text-gray-600 mb-4 line-clamp-2">{product.description}</p>
              <div className="flex justify-between items-center mt-auto">
                <span className="font-bold text-lg">
                  {(product.priceCents / 100).toLocaleString("en-US", {
                    style: "currency",
                    currency: product.currency,
                  })}
                </span>
                <Link
                  href={`/product/${product.id}`}
                  className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
                >
                  View
                </Link>
              </div>
            </div>
          ))}
          {products?.length === 0 && (
            <p className="col-span-full text-center text-gray-500">No products found.</p>
          )}
        </div>
      )}
    </div>
  );
}

export default function Home() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <HomeContent />
    </Suspense>
  );
}
