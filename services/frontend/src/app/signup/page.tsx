"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Mail,
  Lock,
  User,
  Phone,
  ArrowRight,
  Loader2,
  Sparkles,
  Package,
  Eye,
  EyeOff,
  CheckCircle2,
  XCircle,
  ShieldCheck,
  Building,
  Briefcase,
  Cpu,
  MapPin,
  Gift,
  Check,
} from "lucide-react";
import { AnimeButton } from "@/components/anime/AnimeButton";
import { AnimeText } from "@/components/anime/AnimeText";
import { useStore } from "@/providers/StoreContext";

const ACCOUNT_TIERS = [
  {
    id: "personal",
    title: "Personal Buyer",
    desc: "Everyday retail, Prime express delivery & personal deals",
    icon: User,
  },
  {
    id: "business",
    title: "Business & Enterprise",
    desc: "Tax-exempt commercial invoicing & bulk order discounts",
    icon: Building,
  },
  {
    id: "developer",
    title: "Developer / Pro",
    desc: "Kafka event telemetry access & API sandbox credentials",
    icon: Cpu,
  },
];

const REGIONAL_HUBS = [
  { id: "seattle", city: "Seattle", zipCode: "98101", label: "Seattle, WA (US-West Main Hub)" },
  { id: "sanfrancisco", city: "San Francisco", zipCode: "94105", label: "San Francisco, CA (Silicon Valley)" },
  { id: "newyork", city: "New York", zipCode: "10001", label: "New York, NY (US-East Hub)" },
  { id: "austin", city: "Austin", zipCode: "78701", label: "Austin, TX (US-Central Hub)" },
  { id: "london", city: "London", zipCode: "EC1A 1BB", label: "London, UK (Europe Hub)" },
];

export default function SignupPage() {
  const router = useRouter();
  const { setLocation, setUserProfile, showToast } = useStore();

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [accountTier, setAccountTier] = useState("personal");
  const [selectedHub, setSelectedHub] = useState("seattle");
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [subscribeNewsletter, setSubscribeNewsletter] = useState(true);

  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  // Live password strength calculation
  const passwordStrength = useMemo(() => {
    if (!password) return { score: 0, label: "", color: "bg-slate-700" };
    let score = 0;
    if (password.length >= 8) score += 1;
    if (/[A-Z]/.test(password) && /[a-z]/.test(password)) score += 1;
    if (/[0-9]/.test(password)) score += 1;
    if (/[^A-Za-z0-9]/.test(password)) score += 1;

    switch (score) {
      case 1:
        return { score: 1, label: "Weak", color: "bg-rose-500", text: "text-rose-400" };
      case 2:
        return { score: 2, label: "Fair", color: "bg-amber-500", text: "text-amber-400" };
      case 3:
        return { score: 3, label: "Good", color: "bg-cyan-500", text: "text-cyan-400" };
      case 4:
        return { score: 4, label: "Strong & Secure", color: "bg-emerald-500", text: "text-emerald-400" };
      default:
        return { score: 0, label: "Too Short", color: "bg-rose-500", text: "text-rose-400" };
    }
  }, [password]);

  const passwordsMatch = password && confirmPassword && password === confirmPassword;

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!acceptTerms) {
      setError("Please accept the Terms of Service & Privacy Policy to continue.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match. Please verify your password confirmation.");
      return;
    }

    if (password.length < 8) {
      setError("Password must be at least 8 characters long.");
      return;
    }

    setIsLoading(true);

    try {
      // Step 1: Create user in Auth Service via Spring Cloud Gateway
      const signupRes = await fetch("/api/gateway/auth/signup", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, password }),
      });

      if (!signupRes.ok) {
        if (signupRes.status === 409) {
          throw new Error("An account with this email address already exists. Please sign in.");
        }

        try {
          const errorData = await signupRes.json();
          throw new Error(errorData.message || "Failed to create account");
        } catch (e: any) {
          throw new Error(e?.message || "Failed to create account");
        }
      }

      // Step 2: Auto login to create httpOnly session cookie
      const loginRes = await fetch("/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, password }),
      });

      if (!loginRes.ok) {
        throw new Error("Account created but failed to log in automatically");
      }

      // Step 3: Save user profile & location to StoreContext
      const chosenHub = REGIONAL_HUBS.find((h) => h.id === selectedHub) || REGIONAL_HUBS[0];
      setLocation({
        city: chosenHub.city,
        zipCode: chosenHub.zipCode,
        country: "United States",
      });

      setUserProfile({
        fullName: fullName || "Nexora Shopper",
        email,
        phoneNumber: phoneNumber || undefined,
        accountType: accountTier,
        preferredRegion: chosenHub.label,
      });

      // Show welcome toast with promo code
      showToast({
        title: "Welcome to Nexora!",
        productName: `Account created for ${fullName || email}. Promo code NEXORA20 is ready!`,
        priceCents: 0,
        quantity: 1,
        cartTotalCents: 0,
        currency: "USD",
      });

      router.push("/");
      router.refresh();
    } catch (err: any) {
      setError(err.message || "An error occurred during signup");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="relative min-h-[calc(100vh-4rem)] flex items-center justify-center p-4 py-12">
      <div className="relative z-10 w-full max-w-xl p-8 sm:p-10 glass-panel bg-slate-900/90 rounded-3xl shadow-2xl border border-white/[0.08]">
        {/* Brand header */}
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-2 mb-3 group">
            <div className="p-2 rounded-xl bg-gradient-to-tr from-cyan-500 via-indigo-500 to-pink-500 shadow-lg shadow-cyan-500/20">
              <Package className="h-6 w-6 text-white" />
            </div>
            <span className="text-2xl font-black text-white tracking-tight">
              NEX<span className="text-cyan-400">ORA</span>
            </span>
          </Link>

          <h1 className="text-2xl sm:text-3xl font-black text-white mb-1.5">
            Create Your <AnimeText text="Nexora Account" gradient="neon" delay={100} />
          </h1>
          <p className="text-xs text-slate-400">
            Join the next-generation microservices commerce ecosystem
          </p>
        </div>

        {error && (
          <div className="mb-6 p-3.5 bg-rose-950/40 border border-rose-500/40 rounded-2xl text-rose-300 text-xs text-center font-semibold animate-in fade-in">
            {error}
          </div>
        )}

        <form onSubmit={handleSignup} className="space-y-6">
          {/* ── 1. ACCOUNT TIER SELECTOR ── */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
              Select Account Tier
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              {ACCOUNT_TIERS.map((tier) => {
                const Icon = tier.icon;
                const isSelected = accountTier === tier.id;
                return (
                  <button
                    type="button"
                    key={tier.id}
                    onClick={() => setAccountTier(tier.id)}
                    className={`p-3 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                      isSelected
                        ? "bg-cyan-500/10 border-cyan-400 shadow-md ring-1 ring-cyan-400 text-white"
                        : "bg-slate-800/60 border-white/5 text-slate-400 hover:border-white/20 hover:text-slate-200"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <Icon className={`h-4 w-4 ${isSelected ? "text-cyan-400" : "text-slate-400"}`} />
                      {isSelected && <CheckCircle2 className="h-3.5 w-3.5 text-cyan-400" />}
                    </div>
                    <div>
                      <p className="font-bold text-xs leading-tight">{tier.title}</p>
                      <p className="text-[10px] text-slate-500 mt-1 leading-tight">{tier.desc}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* ── 2. PERSONAL DETAILS ── */}
          <div className="space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 pb-1 border-b border-white/5">
              Personal Information
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-400 mb-1.5 ml-1">
                  Full Name <span className="text-rose-400">*</span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                    <User className="h-4 w-4 text-slate-400" />
                  </div>
                  <input
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="block w-full pl-10 pr-4 py-2.5 bg-slate-800/90 border border-white/10 rounded-2xl text-white placeholder-slate-500 focus:ring-2 focus:ring-cyan-400/40 focus:border-cyan-400 transition-all text-xs outline-none"
                    placeholder="Alex Johnson"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 mb-1.5 ml-1">
                  Phone Number (For SMS Delivery Alerts)
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                    <Phone className="h-4 w-4 text-slate-400" />
                  </div>
                  <input
                    type="tel"
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    className="block w-full pl-10 pr-4 py-2.5 bg-slate-800/90 border border-white/10 rounded-2xl text-white placeholder-slate-500 focus:ring-2 focus:ring-cyan-400/40 focus:border-cyan-400 transition-all text-xs outline-none"
                    placeholder="+1 (555) 382-9104"
                  />
                </div>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-400 mb-1.5 ml-1">
                Email Address <span className="text-rose-400">*</span>
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                  <Mail className="h-4 w-4 text-slate-400" />
                </div>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="block w-full pl-10 pr-4 py-2.5 bg-slate-800/90 border border-white/10 rounded-2xl text-white placeholder-slate-500 focus:ring-2 focus:ring-cyan-400/40 focus:border-cyan-400 transition-all text-xs outline-none"
                  placeholder="shopper@domain.com"
                  required
                />
              </div>
            </div>
          </div>

          {/* ── 3. REGIONAL FULFILLMENT HUB ── */}
          <div>
            <label className="block text-xs font-bold text-slate-400 mb-1.5 ml-1">
              Preferred Regional Logistics Hub
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                <MapPin className="h-4 w-4 text-cyan-400" />
              </div>
              <select
                value={selectedHub}
                onChange={(e) => setSelectedHub(e.target.value)}
                className="block w-full pl-10 pr-4 py-2.5 bg-slate-800/90 border border-white/10 rounded-2xl text-white focus:ring-2 focus:ring-cyan-400/40 focus:border-cyan-400 transition-all text-xs outline-none cursor-pointer"
              >
                {REGIONAL_HUBS.map((hub) => (
                  <option key={hub.id} value={hub.id} className="bg-slate-900 text-white">
                    {hub.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* ── 4. SECURITY & PASSWORDS ── */}
          <div className="space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 pb-1 border-b border-white/5">
              Security & Credentials
            </h3>

            {/* Password */}
            <div>
              <div className="flex justify-between items-center mb-1.5 ml-1">
                <label className="block text-xs font-bold text-slate-400">
                  Password <span className="text-rose-400">*</span>
                </label>
                {password && (
                  <span className={`text-[10px] font-bold ${passwordStrength.text}`}>
                    Strength: {passwordStrength.label}
                  </span>
                )}
              </div>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                  <Lock className="h-4 w-4 text-slate-400" />
                </div>
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  minLength={8}
                  onChange={(e) => setPassword(e.target.value)}
                  className="block w-full pl-10 pr-10 py-2.5 bg-slate-800/90 border border-white/10 rounded-2xl text-white placeholder-slate-500 focus:ring-2 focus:ring-cyan-400/40 focus:border-cyan-400 transition-all text-xs outline-none"
                  placeholder="Min 8 chars, 1 number, 1 symbol"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-white"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>

              {/* Password Strength Progress Bar */}
              {password && (
                <div className="mt-2 space-y-1.5">
                  <div className="w-full h-1.5 rounded-full bg-slate-800 overflow-hidden flex gap-1">
                    {[1, 2, 3, 4].map((step) => (
                      <div
                        key={step}
                        className={`h-full flex-1 rounded-full transition-all duration-300 ${
                          passwordStrength.score >= step ? passwordStrength.color : "bg-slate-700/50"
                        }`}
                      />
                    ))}
                  </div>

                  <div className="grid grid-cols-2 gap-1 text-[10px] text-slate-400">
                    <span className={password.length >= 8 ? "text-emerald-400 font-semibold" : ""}>
                      {password.length >= 8 ? "✓" : "○"} 8+ Characters
                    </span>
                    <span
                      className={
                        /[A-Z]/.test(password) && /[a-z]/.test(password)
                          ? "text-emerald-400 font-semibold"
                          : ""
                      }
                    >
                      {/[A-Z]/.test(password) && /[a-z]/.test(password) ? "✓" : "○"} Upper & lowercase
                    </span>
                    <span className={/[0-9]/.test(password) ? "text-emerald-400 font-semibold" : ""}>
                      {/[0-9]/.test(password) ? "✓" : "○"} Number (0-9)
                    </span>
                    <span
                      className={
                        /[^A-Za-z0-9]/.test(password) ? "text-emerald-400 font-semibold" : ""
                      }
                    >
                      {/[^A-Za-z0-9]/.test(password) ? "✓" : "○"} Special Symbol
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Confirm Password */}
            <div>
              <div className="flex justify-between items-center mb-1.5 ml-1">
                <label className="block text-xs font-bold text-slate-400">
                  Confirm Password <span className="text-rose-400">*</span>
                </label>
                {confirmPassword && (
                  <span
                    className={`text-[10px] font-bold ${
                      passwordsMatch ? "text-emerald-400" : "text-amber-400"
                    }`}
                  >
                    {passwordsMatch ? "✓ Passwords match" : "⚠ Passwords do not match"}
                  </span>
                )}
              </div>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                  <ShieldCheck className="h-4 w-4 text-slate-400" />
                </div>
                <input
                  type={showConfirmPassword ? "text" : "password"}
                  value={confirmPassword}
                  minLength={8}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className={`block w-full pl-10 pr-10 py-2.5 bg-slate-800/90 border rounded-2xl text-white placeholder-slate-500 focus:ring-2 focus:ring-cyan-400/40 transition-all text-xs outline-none ${
                    confirmPassword && !passwordsMatch
                      ? "border-amber-500/50"
                      : "border-white/10 focus:border-cyan-400"
                  }`}
                  placeholder="Re-enter your password"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-white"
                >
                  {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
          </div>

          {/* ── 5. PERKS & AGREEMENTS ── */}
          <div className="space-y-3 pt-2">
            {/* Promo opt-in */}
            <label className="flex items-start gap-2.5 text-xs text-slate-300 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={subscribeNewsletter}
                onChange={(e) => setSubscribeNewsletter(e.target.checked)}
                className="mt-0.5 rounded border-white/20 bg-slate-800 text-cyan-500 focus:ring-cyan-400"
              />
              <span className="leading-snug">
                <strong className="text-cyan-300 font-semibold flex items-center gap-1">
                  <Gift className="h-3.5 w-3.5 text-pink-400" /> Claim Welcome Promo Code (NEXORA20)
                </strong>
                Receive exclusive flash deals, price drop alerts, and microservice release updates.
              </span>
            </label>

            {/* Terms of Service */}
            <label className="flex items-start gap-2.5 text-xs text-slate-300 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={acceptTerms}
                onChange={(e) => setAcceptTerms(e.target.checked)}
                className="mt-0.5 rounded border-white/20 bg-slate-800 text-cyan-500 focus:ring-cyan-400"
                required
              />
              <span className="leading-snug">
                I agree to Nexora&apos;s{" "}
                <Link href="/" className="text-cyan-400 underline hover:text-cyan-300">
                  Terms of Service
                </Link>{" "}
                and{" "}
                <Link href="/" className="text-cyan-400 underline hover:text-cyan-300">
                  Privacy Policy
                </Link>
                .
              </span>
            </label>
          </div>

          {/* Submit Button */}
          <AnimeButton
            type="submit"
            disabled={isLoading || !acceptTerms}
            variant="primary"
            size="lg"
            className="w-full shadow-cyan-500/20"
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Provisioning Account & Session...
              </>
            ) : (
              <>
                Create Account & Join Nexora <ArrowRight className="h-4 w-4" />
              </>
            )}
          </AnimeButton>
        </form>

        <p className="mt-8 text-center text-xs text-slate-400">
          Already have a registered account?{" "}
          <Link href="/login" className="font-bold text-cyan-400 hover:text-cyan-300 underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
