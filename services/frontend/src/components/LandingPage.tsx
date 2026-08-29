"use client";

import { motion } from "framer-motion";
import { ArrowRight, ShoppingBag, ShieldCheck, Zap } from "lucide-react";
import Link from "next/link";

export function LandingPage() {
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.15,
        delayChildren: 0.2,
      },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { type: "spring", stiffness: 300, damping: 24 },
    },
  };

  return (
    <div className="flex flex-col min-h-[calc(100vh-4rem)] items-center justify-center overflow-hidden bg-neutral-50 dark:bg-neutral-950 relative">
      {/* Background gradients */}
      <div className="absolute top-0 -left-4 w-72 h-72 bg-blue-400 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob"></div>
      <div className="absolute top-0 -right-4 w-72 h-72 bg-purple-400 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob animation-delay-2000"></div>
      <div className="absolute -bottom-8 left-20 w-72 h-72 bg-emerald-400 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob animation-delay-4000"></div>

      <motion.div 
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="z-10 container mx-auto px-4 md:px-6 flex flex-col items-center text-center max-w-4xl"
      >
        <motion.div variants={itemVariants} className="inline-flex items-center rounded-full border px-3 py-1 text-sm font-semibold text-blue-600 bg-blue-50 dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-800 mb-8 shadow-sm">
          <span className="flex h-2 w-2 rounded-full bg-blue-600 mr-2 animate-pulse"></span>
          Platform v2.0 is Live
        </motion.div>
        
        <motion.h1 variants={itemVariants} className="text-5xl md:text-7xl font-extrabold tracking-tight text-neutral-900 dark:text-white mb-6">
          The future of <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-purple-600">Ecommerce</span> is here.
        </motion.h1>
        
        <motion.p variants={itemVariants} className="text-lg md:text-xl text-neutral-600 dark:text-neutral-300 mb-10 max-w-2xl leading-relaxed">
          Experience lightning-fast performance, rock-solid security, and a seamless shopping experience powered by microservices architecture.
        </motion.p>
        
        <motion.div variants={itemVariants} className="flex flex-col sm:flex-row gap-4 mb-20 w-full sm:w-auto">
          <Link href="/login" className="inline-flex justify-center items-center gap-2 rounded-full bg-blue-600 px-8 py-4 text-base font-medium text-white shadow-lg hover:bg-blue-700 hover:shadow-xl transition-all active:scale-95">
            Start Shopping <ArrowRight className="h-5 w-5" />
          </Link>
          <Link href="/about" className="inline-flex justify-center items-center gap-2 rounded-full bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 px-8 py-4 text-base font-medium text-neutral-900 dark:text-white shadow-sm hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-all active:scale-95">
            Learn More
          </Link>
        </motion.div>

        <motion.div variants={containerVariants} className="grid grid-cols-1 md:grid-cols-3 gap-8 w-full">
          <motion.div variants={itemVariants} className="flex flex-col items-center text-center p-6 rounded-2xl bg-white/60 dark:bg-neutral-900/60 backdrop-blur-sm border border-neutral-200 dark:border-neutral-800 shadow-sm hover:shadow-md transition-shadow">
            <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-xl mb-4 text-blue-600 dark:text-blue-400">
              <Zap className="h-8 w-8" />
            </div>
            <h3 className="text-xl font-bold mb-2">Lightning Fast</h3>
            <p className="text-neutral-600 dark:text-neutral-400">Optimized microservices ensure instant loading times and real-time updates.</p>
          </motion.div>
          
          <motion.div variants={itemVariants} className="flex flex-col items-center text-center p-6 rounded-2xl bg-white/60 dark:bg-neutral-900/60 backdrop-blur-sm border border-neutral-200 dark:border-neutral-800 shadow-sm hover:shadow-md transition-shadow">
            <div className="p-3 bg-purple-100 dark:bg-purple-900/30 rounded-xl mb-4 text-purple-600 dark:text-purple-400">
              <ShieldCheck className="h-8 w-8" />
            </div>
            <h3 className="text-xl font-bold mb-2">Secure & Reliable</h3>
            <p className="text-neutral-600 dark:text-neutral-400">Bank-grade security protocols keep your data and transactions safe.</p>
          </motion.div>

          <motion.div variants={itemVariants} className="flex flex-col items-center text-center p-6 rounded-2xl bg-white/60 dark:bg-neutral-900/60 backdrop-blur-sm border border-neutral-200 dark:border-neutral-800 shadow-sm hover:shadow-md transition-shadow">
            <div className="p-3 bg-emerald-100 dark:bg-emerald-900/30 rounded-xl mb-4 text-emerald-600 dark:text-emerald-400">
              <ShoppingBag className="h-8 w-8" />
            </div>
            <h3 className="text-xl font-bold mb-2">Vast Selection</h3>
            <p className="text-neutral-600 dark:text-neutral-400">Thousands of products curated just for you. Find exactly what you need.</p>
          </motion.div>
        </motion.div>
      </motion.div>
    </div>
  );
}
