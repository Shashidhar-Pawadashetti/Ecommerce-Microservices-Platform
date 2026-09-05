"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
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
  ShieldCheck,
  MapPin,
  Gift,
  LogOut,
} from "lucide-react";
import { AnimeButton } from "@/components/anime/AnimeButton";
import { useStore } from "@/providers/StoreContext";
import { User as UserType } from "@/types";

const REGIONAL_HUBS = [
  { id: "seattle", city: "Seattle", zipCode: "98101", label: "Seattle, WA (US-West Main Hub)" },
  { id: "sanfrancisco", city: "San Francisco", zipCode: "94105", label: "San Francisco, CA (Silicon Valley)" },
  { id: "newyork", city: "New York", zipCode: "10001", label: "New York, NY (US-East Hub)" },
  { id: "austin", city: "Austin", zipCode: "78701", label: "Austin, TX (US-Central Hub)" },
  { id: "london", city: "London", zipCode: "EC1A 1BB", label: "London, UK (Europe Hub)" },
];

export default function SignupPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { setLocation, setUserProfile, showToast } = useStore();

  // Guard against authenticated users accessing signup form
  const { data: authUser, isLoading: isCheckingAuth } = useQuery<UserType | null>({
    queryKey: ["auth-user"],
    queryFn: async () => {
      const res = await fetch("/api/gateway/auth/me");
      if (!res.ok) return null;
      return res.json();
    },
    retry: false,
  });

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [selectedHub, setSelectedHub] = useState("seattle");
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [subscribeNewsletter, setSubscribeNewsletter] = useState(true);

  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  // Live password strength calculation
  const passwordStrength = useMemo(() => {
    if (!password) return { score: 0, label: "", color: "bg-slate-700", text: "text-slate-500" };
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

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    setUserProfile(null);
    queryClient.setQueryData(["auth-user"], null);
    queryClient.setQueryData(["cart"], null);
    queryClient.invalidateQueries();
    router.refresh();
  };

  if (authUser) {
    return (
      <div className="relative min-h-[calc(100vh-4rem)] flex items-center justify-center p-4 py-12">
        <div className="relative z-10 w-full max-w-md p-8 sm:p-10 glass-panel bg-slate-900/95 rounded-3xl shadow-2xl border border-white/[0.08] text-center animate-in fade-in">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-emerald-500 to-cyan-500 flex items-center justify-center mx-auto mb-4 text-slate-950 shadow-lg shadow-cyan-500/30">
            <CheckCircle2 className="h-8 w-8" />
          </div>
          <h1 className="text-2xl font-black text-white mb-2">Already Signed In</h1>
          <p className="text-xs text-slate-400 mb-2">
            You currently have an active authenticated session as:
          </p>
          <p className="font-bold text-cyan-300 text-sm mb-6 bg-slate-800/80 py-2.5 px-4 rounded-xl border border-cyan-500/20 truncate">
            {authUser.email}
          </p>
          <div className="space-y-3">
            <Link href="/profile" className="block w-full">
              <AnimeButton variant="primary" className="w-full">
                Go to My Profile <ArrowRight className="h-4 w-4 ml-1" />
              </AnimeButton>
            </Link>
            <Link href="/" className="block w-full">
              <AnimeButton variant="secondary" className="w-full">
                Continue Shopping
              </AnimeButton>
            </Link>
            <button
              onClick={handleLogout}
              className="w-full py-2.5 px-4 text-xs font-bold text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 rounded-2xl border border-rose-500/20 transition-all cursor-pointer flex items-center justify-center gap-1.5"
            >
              <LogOut className="h-3.5 w-3.5" /> Sign Out to Create Different Account
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-[calc(100vh-4rem)] flex items-center justify-center p-4 py-12">
      <div className="relative z-10 w-full max-w-lg p-8 sm:p-10 glass-panel bg-slate-900/95 rounded-3xl shadow-2xl border border-white/[0.08]">
        {/* Brand header */}
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-2 mb-3 group">
            <div className="p-2 rounded-xl bg-gradient-to-tr from-cyan-500 via-indigo-500 to-pink-500 shadow-lg shadow-cyan-500/20 group-hover:scale-105 transition-transform">
              <Package className="h-6 w-6 text-white" />
            </div>
            <span className="text-2xl font-black text-white tracking-tight">
              NEX<span className="text-cyan-400">ORA</span>
            </span>
          </Link>

          {/* Highly Visible Title */}
          <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight mb-2">
            Create Your{" "}
            <span className="bg-gradient-to-r from-cyan-400 via-indigo-300 to-pink-400 bg-clip-text text-transparent">
              Nexora Account
            </span>
          </h1>

          <p className="text-xs text-slate-400">
            Join the next-generation microservices cloud commerce platform
          </p>
        </div>

        {error && (
          <div className="mb-6 p-3.5 bg-rose-950/40 border border-rose-500/40 rounded-2xl text-rose-300 text-xs text-center font-semibold animate-in fade-in">
            {error}
          </div>
        )}

        <form onSubmit={handleSignup} className="space-y-5">
          {/* ── PERSONAL DETAILS ── */}
          <div className="space-y-4">
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
                    className="block w-full pl-10 pr-4 py-2.5 bg-slate-800/90 border border-white/10 rounded-2xl text-white placeholder-slate-500 focus:ring-2 focus:ring-cyan-400/40 focus:border-cyan-400 transition-all text-xs outline-none font-medium"
                    placeholder="Alex Johnson"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 mb-1.5 ml-1">
                  Phone Number (SMS Alerts)
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                    <Phone className="h-4 w-4 text-slate-400" />
                  </div>
                  <input
                    type="tel"
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    className="block w-full pl-10 pr-4 py-2.5 bg-slate-800/90 border border-white/10 rounded-2xl text-white placeholder-slate-500 focus:ring-2 focus:ring-cyan-400/40 focus:border-cyan-400 transition-all text-xs outline-none font-medium"
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
                  className="block w-full pl-10 pr-4 py-2.5 bg-slate-800/90 border border-white/10 rounded-2xl text-white placeholder-slate-500 focus:ring-2 focus:ring-cyan-400/40 focus:border-cyan-400 transition-all text-xs outline-none font-medium"
                  placeholder="shopper@domain.com"
                  required
                />
              </div>
            </div>
          </div>

          {/* ── REGIONAL LOGISTICS HUB ── */}
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
                className="block w-full pl-10 pr-4 py-2.5 bg-slate-800/90 border border-white/10 rounded-2xl text-white focus:ring-2 focus:ring-cyan-400/40 focus:border-cyan-400 transition-all text-xs outline-none cursor-pointer font-medium"
              >
                {REGIONAL_HUBS.map((hub) => (
                  <option key={hub.id} value={hub.id} className="bg-slate-900 text-white">
                    {hub.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* ── SECURITY & PASSWORD ── */}
          <div className="space-y-4 pt-1">
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
                  className="block w-full pl-10 pr-10 py-2.5 bg-slate-800/90 border border-white/10 rounded-2xl text-white placeholder-slate-500 focus:ring-2 focus:ring-cyan-400/40 focus:border-cyan-400 transition-all text-xs outline-none font-medium"
                  placeholder="Min 8 chars, 1 number, 1 symbol"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-white cursor-pointer"
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
                  className={`block w-full pl-10 pr-10 py-2.5 bg-slate-800/90 border rounded-2xl text-white placeholder-slate-500 focus:ring-2 focus:ring-cyan-400/40 transition-all text-xs outline-none font-medium ${
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
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-white cursor-pointer"
                >
                  {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
          </div>

          {/* ── PERKS & AGREEMENTS ── */}
          <div className="space-y-3 pt-2">
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
