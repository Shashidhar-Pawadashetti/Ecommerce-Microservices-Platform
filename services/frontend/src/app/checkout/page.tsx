"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useState } from "react";
import Link from "next/link";
import { Cart, ShippingAddress, DeliveryOption } from "@/types";
import {
  ArrowLeft,
  ShieldCheck,
  Loader2,
  Zap,
  Radio,
  CheckCircle2,
  CreditCard,
  Truck,
  MapPin,
  Tag,
  Lock,
  ChevronRight,
  Sparkles,
} from "lucide-react";
import { PageWrapper } from "@/components/anime/PageWrapper";
import { AnimeButton } from "@/components/anime/AnimeButton";
import { useStore } from "@/providers/StoreContext";
import { generateUUID } from "@/lib/uuid";

const DELIVERY_OPTIONS: DeliveryOption[] = [
  {
    id: "prime",
    title: "FREE Nexora Express Delivery",
    description: "Guaranteed delivery tomorrow by 8:00 PM",
    priceCents: 0,
    estimatedDate: "Tomorrow",
  },
  {
    id: "standard",
    title: "FREE Standard Shipping",
    description: "Arrives in 3 to 5 business days",
    priceCents: 0,
    estimatedDate: "3-5 Days",
  },
  {
    id: "priority",
    title: "Priority Express Morning Delivery",
    description: "Arrives tomorrow morning by 10:30 AM",
    priceCents: 999,
    estimatedDate: "Tomorrow 10:30 AM",
  },
];

export default function CheckoutPage() {
  const queryClient = useQueryClient();
  const router = useRouter();
  const { location } = useStore();

  const [shippingAddress, setShippingAddress] = useState<ShippingAddress>({
    fullName: "Alex Johnson",
    addressLine1: "410 Terry Ave N",
    addressLine2: "Suite 400",
    city: location.city || "Seattle",
    state: "WA",
    zipCode: location.zipCode || "98109",
    phoneNumber: "(555) 382-9104",
    country: "United States",
  });

  const [selectedDelivery, setSelectedDelivery] = useState<string>("prime");
  const [promoCode, setPromoCode] = useState<string>("");
  const [promoDiscountPct, setPromoDiscountPct] = useState<number>(0);
  const [promoMessage, setPromoMessage] = useState<string>("");
  const [cardDetails, setCardDetails] = useState({
    number: "•••• •••• •••• 4242",
    name: "Alex Johnson",
    expiry: "12/28",
    cvv: "•••",
  });
  const [error, setError] = useState("");

  const { data: cart, isLoading } = useQuery<Cart>({
    queryKey: ["cart"],
    queryFn: async () => {
      const res = await fetch("/api/gateway/cart");
      if (!res.ok) throw new Error("Failed to fetch cart");
      return res.json();
    },
  });

  const handleApplyPromo = (e: React.FormEvent) => {
    e.preventDefault();
    const code = promoCode.trim().toUpperCase();
    if (code === "NEXORA20" || code === "NEXORA25" || code === "PRIME20") {
      setPromoDiscountPct(20);
      setPromoMessage("✓ Promo code applied: 20% instant discount on all items!");
    } else if (code === "KAFKAPOWER" || code === "SAVE10") {
      setPromoDiscountPct(10);
      setPromoMessage("✓ Promo code applied: 10% instant discount on all items!");
    } else {
      setPromoMessage("Invalid promo code. Try 'NEXORA20' or 'KAFKAPOWER'.");
    }
  };

  const selectedDeliveryOption =
    DELIVERY_OPTIONS.find((d) => d.id === selectedDelivery) || DELIVERY_OPTIONS[0];

  const itemsTotalCents = cart?.grandTotalCents || 0;
  const shippingCents = selectedDeliveryOption.priceCents;
  const promoDiscountCents = Math.round((itemsTotalCents * promoDiscountPct) / 100);
  const grandTotalPayableCents = Math.max(0, itemsTotalCents + shippingCents - promoDiscountCents);

  const checkoutMutation = useMutation({
    mutationFn: async () => {
      const idempotencyKey = generateUUID();

      const res = await fetch(`/api/gateway/orders`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": idempotencyKey,
        },
        body: JSON.stringify({
          shippingAddress,
          deliveryOption: selectedDeliveryOption.id,
        }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.message || errorData.error || "Failed to create order");
      }
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["cart"] });
      router.push(`/order/${data.orderId}`);
    },
    onError: (err: any) => {
      setError(err.message || "Checkout failed. Please try again.");
    },
  });

  if (isLoading) {
    return (
      <div className="container mx-auto p-8 flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <Loader2 className="h-10 w-10 animate-spin text-cyan-400" />
        <p className="text-slate-400 text-sm font-semibold">Preparing Nexora checkout...</p>
      </div>
    );
  }

  if (!cart || !cart.items || cart.items.length === 0) {
    return (
      <div className="container mx-auto p-8 max-w-md text-center min-h-[60vh] flex flex-col items-center justify-center">
        <div className="glass-panel p-8 rounded-3xl w-full border border-white/10">
          <h2 className="text-xl font-bold text-white mb-2">Your cart is empty</h2>
          <p className="text-slate-400 text-xs mb-6">Add products before proceeding to checkout.</p>
          <Link href="/">
            <AnimeButton variant="primary">Return to Catalog</AnimeButton>
          </Link>
        </div>
      </div>
    );
  }

  const currency = cart.currency || "USD";

  return (
    <PageWrapper className="max-w-6xl mx-auto px-4 md:px-6 py-8">
      {/* Header */}
      <div className="flex items-center justify-between pb-6 mb-8 border-b border-white/10">
        <Link
          href="/cart"
          className="inline-flex items-center text-xs font-bold text-slate-400 hover:text-cyan-400 transition-colors gap-1.5"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Return to Cart
        </Link>
        <div className="flex items-center gap-2 text-xs text-slate-400 font-semibold">
          <Lock className="h-3.5 w-3.5 text-emerald-400" />
          <span>Secure 256-Bit SSL Checkout</span>
        </div>
      </div>

      {error && (
        <div className="glass-panel border border-rose-500/30 bg-rose-950/20 text-rose-300 p-4 rounded-2xl mb-6 text-xs font-semibold">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column: Multi-Step Accordion Form */}
        <div className="lg:col-span-8 space-y-6">
          {/* ── STEP 1: SHIPPING ADDRESS ── */}
          <div className="glass-panel rounded-3xl p-6 sm:p-8 border border-white/[0.08] shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2.5">
                <span className="w-6 h-6 rounded-full bg-cyan-500 text-slate-950 flex items-center justify-center font-bold text-xs">
                  1
                </span>
                <h2 className="text-base font-bold text-white">Shipping Destination</h2>
              </div>
              <span className="text-[11px] text-emerald-400 font-semibold flex items-center gap-1">
                <CheckCircle2 className="h-3.5 w-3.5" /> Destination Verified
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div>
                <label className="block text-slate-400 font-semibold mb-1">Full Name</label>
                <input
                  type="text"
                  value={shippingAddress.fullName}
                  onChange={(e) =>
                    setShippingAddress({ ...shippingAddress, fullName: e.target.value })
                  }
                  className="w-full px-3.5 py-2 rounded-xl bg-slate-800 border border-white/10 text-white focus:outline-none focus:ring-2 focus:ring-cyan-400"
                />
              </div>

              <div>
                <label className="block text-slate-400 font-semibold mb-1">Phone Number</label>
                <input
                  type="text"
                  value={shippingAddress.phoneNumber}
                  onChange={(e) =>
                    setShippingAddress({ ...shippingAddress, phoneNumber: e.target.value })
                  }
                  className="w-full px-3.5 py-2 rounded-xl bg-slate-800 border border-white/10 text-white focus:outline-none focus:ring-2 focus:ring-cyan-400"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-slate-400 font-semibold mb-1">Street Address</label>
                <input
                  type="text"
                  value={shippingAddress.addressLine1}
                  onChange={(e) =>
                    setShippingAddress({ ...shippingAddress, addressLine1: e.target.value })
                  }
                  className="w-full px-3.5 py-2 rounded-xl bg-slate-800 border border-white/10 text-white focus:outline-none focus:ring-2 focus:ring-cyan-400"
                />
              </div>

              <div>
                <label className="block text-slate-400 font-semibold mb-1">City</label>
                <input
                  type="text"
                  value={shippingAddress.city}
                  onChange={(e) =>
                    setShippingAddress({ ...shippingAddress, city: e.target.value })
                  }
                  className="w-full px-3.5 py-2 rounded-xl bg-slate-800 border border-white/10 text-white focus:outline-none focus:ring-2 focus:ring-cyan-400"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-slate-400 font-semibold mb-1">State</label>
                  <input
                    type="text"
                    value={shippingAddress.state}
                    onChange={(e) =>
                      setShippingAddress({ ...shippingAddress, state: e.target.value })
                    }
                    className="w-full px-3.5 py-2 rounded-xl bg-slate-800 border border-white/10 text-white focus:outline-none focus:ring-2 focus:ring-cyan-400"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 font-semibold mb-1">ZIP Code</label>
                  <input
                    type="text"
                    value={shippingAddress.zipCode}
                    onChange={(e) =>
                      setShippingAddress({ ...shippingAddress, zipCode: e.target.value })
                    }
                    className="w-full px-3.5 py-2 rounded-xl bg-slate-800 border border-white/10 text-white focus:outline-none focus:ring-2 focus:ring-cyan-400"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* ── STEP 2: DELIVERY SPEED ── */}
          <div className="glass-panel rounded-3xl p-6 sm:p-8 border border-white/[0.08] shadow-xl">
            <div className="flex items-center gap-2.5 mb-4">
              <span className="w-6 h-6 rounded-full bg-cyan-500 text-slate-950 flex items-center justify-center font-bold text-xs">
                2
              </span>
              <h2 className="text-base font-bold text-white">Choose Delivery Velocity</h2>
            </div>

            <div className="space-y-3">
              {DELIVERY_OPTIONS.map((option) => (
                <label
                  key={option.id}
                  className={`flex items-start justify-between p-4 rounded-2xl border cursor-pointer transition-all ${
                    selectedDelivery === option.id
                      ? "bg-slate-800/90 border-cyan-400 shadow-md ring-1 ring-cyan-400"
                      : "bg-slate-900/50 border-white/5 hover:border-white/20"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <input
                      type="radio"
                      name="deliveryOption"
                      checked={selectedDelivery === option.id}
                      onChange={() => setSelectedDelivery(option.id)}
                      className="mt-1 text-cyan-500 focus:ring-cyan-400 bg-slate-900 border-white/20"
                    />
                    <div>
                      <p className="font-bold text-xs text-white flex items-center gap-1.5">
                        {option.id === "prime" && (
                          <Zap className="h-3.5 w-3.5 fill-cyan-400 text-cyan-400" />
                        )}
                        {option.title}
                      </p>
                      <p className="text-[11px] text-slate-400 mt-0.5">{option.description}</p>
                    </div>
                  </div>
                  <span className="font-bold text-xs text-emerald-400">
                    {option.priceCents === 0
                      ? "FREE"
                      : ((option.priceCents || 0) / 100).toLocaleString("en-US", {
                          style: "currency",
                          currency,
                        })}
                  </span>
                </label>
              ))}
            </div>
          </div>

          {/* ── STEP 3: PAYMENT METHOD ── */}
          <div className="glass-panel rounded-3xl p-6 sm:p-8 border border-white/[0.08] shadow-xl">
            <div className="flex items-center gap-2.5 mb-4">
              <span className="w-6 h-6 rounded-full bg-cyan-500 text-slate-950 flex items-center justify-center font-bold text-xs">
                3
              </span>
              <h2 className="text-base font-bold text-white">Payment Method & Wallet</h2>
            </div>

            {/* Visual Card Mockup */}
            <div className="p-4 rounded-2xl bg-gradient-to-tr from-slate-800 via-indigo-950 to-slate-900 border border-white/10 text-xs text-white space-y-3 mb-4">
              <div className="flex justify-between items-center">
                <span className="font-bold uppercase tracking-wider text-[10px] text-cyan-400">
                  Nexora Visa Cloud Rewards Signature
                </span>
                <CreditCard className="h-5 w-5 text-cyan-300" />
              </div>
              <p className="font-mono text-base tracking-widest">{cardDetails.number}</p>
              <div className="flex justify-between items-end text-[10px] text-slate-400">
                <div>
                  <p className="uppercase">Cardholder</p>
                  <p className="font-bold text-white">{cardDetails.name}</p>
                </div>
                <div>
                  <p className="uppercase">Expires</p>
                  <p className="font-bold text-white">{cardDetails.expiry}</p>
                </div>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-white/5 border border-white/5 text-[11px] text-slate-300 flex items-center gap-2">
              <Radio className="h-4 w-4 text-emerald-400 animate-pulse shrink-0" />
              <span>
                Payment authorized asynchronously via <strong>Kafka Saga + Redis SETNX</strong> upon clicking Place Order.
              </span>
            </div>
          </div>
        </div>

        {/* Right Column: Order Review & Promo Code */}
        <div className="lg:col-span-4 space-y-6">
          {/* Order Summary & Place Order */}
          <div className="glass-panel bg-slate-900/95 rounded-3xl p-6 border border-white/[0.08] shadow-2xl space-y-5">
            <AnimeButton
              onClick={() => checkoutMutation.mutate()}
              disabled={checkoutMutation.isPending}
              variant="primary"
              size="lg"
              className="w-full shadow-cyan-500/25"
            >
              {checkoutMutation.isPending ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" /> Authorizing Saga...
                </>
              ) : (
                `Place your order`
              )}
            </AnimeButton>

            <p className="text-[10px] text-slate-400 text-center leading-tight">
              By placing your order, you agree to Nexora&apos;s conditions of use and privacy notice.
            </p>

            <div className="pt-4 border-t border-white/10 space-y-2.5 text-xs">
              <h3 className="font-bold text-sm text-white mb-2">Order Summary</h3>

              <div className="flex justify-between text-slate-300">
                <span>Items ({cart.items.length}):</span>
                <span>
                  {((itemsTotalCents || 0) / 100).toLocaleString("en-US", {
                    style: "currency",
                    currency,
                  })}
                </span>
              </div>

              <div className="flex justify-between text-slate-300">
                <span>Shipping (Nexora Express):</span>
                <span>
                  {shippingCents === 0
                    ? "FREE"
                    : ((shippingCents || 0) / 100).toLocaleString("en-US", {
                        style: "currency",
                        currency,
                      })}
                </span>
              </div>

              {promoDiscountCents > 0 && (
                <div className="flex justify-between text-emerald-400 font-semibold">
                  <span>Promotion Savings ({promoDiscountPct}%):</span>
                  <span>
                    -
                    {((promoDiscountCents || 0) / 100).toLocaleString("en-US", {
                      style: "currency",
                      currency,
                    })}
                  </span>
                </div>
              )}

              <div className="flex justify-between text-slate-300">
                <span>Estimated Tax:</span>
                <span>$0.00</span>
              </div>

              <div className="pt-3 border-t border-white/10 flex justify-between items-baseline">
                <span className="font-bold text-sm text-white">Order Total:</span>
                <span className="font-black text-2xl text-cyan-400">
                  {((grandTotalPayableCents || 0) / 100).toLocaleString("en-US", {
                    style: "currency",
                    currency,
                  })}
                </span>
              </div>
            </div>

            {/* Promo Code Input */}
            <div className="pt-4 border-t border-white/10">
              <form onSubmit={handleApplyPromo} className="space-y-2">
                <label className="block text-[11px] font-bold uppercase text-slate-400">
                  Gift Cards & Promotional Codes
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={promoCode}
                    onChange={(e) => setPromoCode(e.target.value)}
                    placeholder="Enter code (e.g. NEXORA20)"
                    className="flex-1 px-3 py-1.5 rounded-xl bg-slate-800 border border-white/10 text-white text-xs uppercase focus:outline-none focus:ring-2 focus:ring-cyan-400"
                  />
                  <button
                    type="submit"
                    className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-cyan-400 text-xs font-bold border border-white/10 transition-colors cursor-pointer"
                  >
                    Apply
                  </button>
                </div>
                {promoMessage && (
                  <p
                    className={`text-[11px] font-semibold ${
                      promoDiscountPct > 0 ? "text-emerald-400" : "text-rose-400"
                    }`}
                  >
                    {promoMessage}
                  </p>
                )}
              </form>
            </div>
          </div>
        </div>
      </div>
    </PageWrapper>
  );
}
