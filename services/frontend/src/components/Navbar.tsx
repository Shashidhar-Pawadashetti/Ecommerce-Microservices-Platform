"use client";

import Link from "next/link";
import { ShoppingCart, User, Package2 } from "lucide-react";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";

export function Navbar() {
  const pathname = usePathname();

  return (
    <motion.header 
      initial={{ y: -100 }}
      animate={{ y: 0 }}
      transition={{ type: "spring", stiffness: 300, damping: 30 }}
      className="sticky top-0 z-50 w-full border-b bg-white/70 backdrop-blur-md dark:border-neutral-800 dark:bg-neutral-950/70"
    >
      <div className="container mx-auto flex h-16 items-center justify-between px-4 md:px-6">
        <Link href="/" className="flex items-center gap-2 transition-transform hover:scale-105">
          <Package2 className="h-6 w-6 text-blue-600 dark:text-blue-500" />
          <span className="text-xl font-bold tracking-tight">EcoMicro</span>
        </Link>
        <nav className="hidden md:flex items-center gap-6 text-sm font-medium">
          <Link href="/" className={`transition-colors hover:text-blue-600 ${pathname === "/" ? "text-blue-600" : "text-neutral-600 dark:text-neutral-300"}`}>
            Home
          </Link>
          <Link href="/products" className={`transition-colors hover:text-blue-600 ${pathname?.startsWith("/products") ? "text-blue-600" : "text-neutral-600 dark:text-neutral-300"}`}>
            Products
          </Link>
          <Link href="/about" className={`transition-colors hover:text-blue-600 ${pathname === "/about" ? "text-blue-600" : "text-neutral-600 dark:text-neutral-300"}`}>
            About
          </Link>
        </nav>
        <div className="flex items-center gap-4">
          <Link href="/cart" className="relative p-2 text-neutral-600 hover:text-blue-600 dark:text-neutral-300 transition-colors rounded-full hover:bg-neutral-100 dark:hover:bg-neutral-800">
            <ShoppingCart className="h-5 w-5" />
            <span className="absolute top-0 right-0 flex h-4 w-4 items-center justify-center rounded-full bg-blue-600 text-[10px] font-bold text-white">
              3
            </span>
          </Link>
          <div className="hidden sm:flex items-center gap-2 border-l pl-4 dark:border-neutral-800">
            <Link href="/login" className="text-sm font-medium hover:text-blue-600 transition-colors">
              Log in
            </Link>
            <Link href="/signup" className="rounded-full bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 hover:shadow-md transition-all active:scale-95">
              Sign up
            </Link>
          </div>
          <button className="md:hidden p-2 rounded-full hover:bg-neutral-100 dark:hover:bg-neutral-800">
            <User className="h-5 w-5" />
          </button>
        </div>
      </div>
    </motion.header>
  );
}
