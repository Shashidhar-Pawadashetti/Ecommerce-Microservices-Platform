"use client";

import Link from "next/link";
import { ShoppingCart, User, Package2, LogOut, Package } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Cart, User as UserType } from "@/types";

export function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const queryClient = useQueryClient();

  // Query authenticated user profile
  const { data: user } = useQuery<UserType>({
    queryKey: ["auth-user"],
    queryFn: async () => {
      const res = await fetch("/api/gateway/auth/me");
      if (!res.ok) return null;
      return res.json();
    },
    retry: false,
  });

  // Query live cart to display accurate item count badge
  const { data: cart } = useQuery<Cart>({
    queryKey: ["cart"],
    queryFn: async () => {
      const res = await fetch("/api/gateway/cart");
      if (!res.ok) return null;
      return res.json();
    },
    retry: false,
  });

  const cartItemCount =
    cart?.items?.reduce((acc, item) => acc + (item.quantity || 1), 0) || 0;

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    queryClient.setQueryData(["auth-user"], null);
    queryClient.setQueryData(["cart"], null);
    queryClient.invalidateQueries();
    router.push("/");
  };

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
          <span className="text-xl font-black tracking-tight">EcoMicro</span>
        </Link>

        <nav className="hidden md:flex items-center gap-6 text-sm font-medium">
          <Link
            href="/"
            className={`transition-colors hover:text-blue-600 ${
              pathname === "/" ? "text-blue-600 font-semibold" : "text-neutral-600 dark:text-neutral-300"
            }`}
          >
            Catalog
          </Link>
          {user && (
            <Link
              href="/orders"
              className={`transition-colors hover:text-blue-600 ${
                pathname === "/orders" ? "text-blue-600 font-semibold" : "text-neutral-600 dark:text-neutral-300"
              }`}
            >
              My Orders
            </Link>
          )}
        </nav>

        <div className="flex items-center gap-3 md:gap-4">
          <Link
            href="/cart"
            className="relative p-2 text-neutral-600 hover:text-blue-600 dark:text-neutral-300 transition-colors rounded-full hover:bg-neutral-100 dark:hover:bg-neutral-800"
            title="Cart"
          >
            <ShoppingCart className="h-5 w-5" />
            {cartItemCount > 0 && (
              <span className="absolute top-0 right-0 flex h-4 min-w-[1rem] px-1 items-center justify-center rounded-full bg-blue-600 text-[10px] font-bold text-white">
                {cartItemCount}
              </span>
            )}
          </Link>

          {user ? (
            <div className="flex items-center gap-3 border-l pl-3 md:pl-4 dark:border-neutral-800">
              <Link
                href="/orders"
                className="hidden sm:flex items-center gap-1.5 text-sm font-medium text-neutral-700 dark:text-neutral-200 hover:text-blue-600 transition-colors"
              >
                <Package className="h-4 w-4 text-neutral-400" />
                <span className="max-w-[120px] truncate">{user.email}</span>
              </Link>
              <button
                onClick={handleLogout}
                className="p-2 text-neutral-500 hover:text-red-600 transition-colors rounded-full hover:bg-neutral-100 dark:hover:bg-neutral-800"
                title="Log out"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2 border-l pl-3 md:pl-4 dark:border-neutral-800">
              <Link
                href="/login"
                className="text-sm font-medium hover:text-blue-600 transition-colors px-2 py-1"
              >
                Log in
              </Link>
              <Link
                href="/signup"
                className="rounded-full bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 hover:shadow-md transition-all active:scale-95"
              >
                Sign up
              </Link>
            </div>
          )}
        </div>
      </div>
    </motion.header>
  );
}
