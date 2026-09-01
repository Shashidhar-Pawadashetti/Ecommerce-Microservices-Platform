"use client";

import { useEffect, useRef, useState } from "react";
import anime from "animejs";
import {
  Layers,
  Shield,
  ShoppingBag,
  ShoppingCart,
  Receipt,
  CreditCard,
  Mail,
  Zap,
  CheckCircle2,
  Database,
  Radio,
} from "lucide-react";

export function AnimeArchitectureVisualizer() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [activeStep, setActiveStep] = useState<number>(0);
  const [sagaTriggered, setSagaTriggered] = useState(false);

  const steps = [
    { title: "API Gateway", desc: "Spring Cloud Gateway handles JWT & rate limiting", color: "#6366f1" },
    { title: "Order Service", desc: "Spring Boot creates order in PostgreSQL outbox", color: "#3b82f6" },
    { title: "Kafka KRaft", desc: "Event bus broadcasts order.created event", color: "#f59e0b" },
    { title: "Payment Service", desc: "FastAPI checks Redis idempotency & authorizes", color: "#ec4899" },
    { title: "Payment Completed", desc: "Kafka broadcasts payment.completed (APPROVED)", color: "#10b981" },
    { title: "Notification Worker", desc: "Node.js sends confirmation email to Mailpit", color: "#06b6d4" },
  ];

  useEffect(() => {
    if (!containerRef.current) return;

    // Pulse connection lines
    anime({
      targets: ".kafka-pulse-dot",
      translateX: [0, 260],
      opacity: [0, 1, 0],
      easing: "easeInOutSine",
      duration: 2200,
      delay: anime.stagger(400),
      loop: true,
    });

    // Node glowing float
    anime({
      targets: ".service-node",
      translateY: () => anime.random(-4, 4),
      duration: () => anime.random(2500, 4000),
      direction: "alternate",
      loop: true,
      easing: "easeInOutSine",
    });
  }, []);

  const triggerSimulation = () => {
    setSagaTriggered(true);
    setActiveStep(0);

    const timeline = anime.timeline({
      easing: "easeOutQuad",
      complete: () => {
        setTimeout(() => setSagaTriggered(false), 2000);
      },
    });

    steps.forEach((_, idx) => {
      timeline.add({
        duration: 800,
        begin: () => setActiveStep(idx),
      });
    });
  };

  return (
    <div
      ref={containerRef}
      className="glass-panel rounded-3xl p-6 md:p-10 border border-slate-700/60 shadow-2xl relative overflow-hidden"
    >
      {/* Background ambient lighting */}
      <div className="absolute -top-16 -right-16 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-16 -left-16 w-64 h-64 bg-pink-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold tracking-wider uppercase bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 mb-2">
            <Radio className="h-3.5 w-3.5 animate-pulse text-indigo-400" /> Live Event-Driven Architecture
          </div>
          <h2 className="text-2xl md:text-3xl font-black text-white">
            Polyglot Microservices Topology
          </h2>
          <p className="text-slate-400 text-sm mt-1">
            Spring Cloud Gateway · FastAPI · Express · Spring Boot · Apache Kafka KRaft
          </p>
        </div>

        <button
          onClick={triggerSimulation}
          disabled={sagaTriggered}
          className="glow-btn-primary px-5 py-2.5 rounded-full text-white font-bold text-sm flex items-center gap-2 shadow-lg disabled:opacity-50 cursor-pointer"
        >
          <Zap className="h-4 w-4 fill-current" />
          {sagaTriggered ? `Simulating Step ${activeStep + 1}/6...` : "Trigger Purchase Saga"}
        </button>
      </div>

      {/* Interactive Microservices Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 mb-8">
        {/* Gateway */}
        <div
          className={`service-node glass-card p-4 rounded-2xl border transition-all duration-300 ${
            activeStep === 0 && sagaTriggered
              ? "border-indigo-500 bg-indigo-950/40 shadow-lg shadow-indigo-500/20 scale-105"
              : "border-slate-800"
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <div className="p-2 rounded-xl bg-indigo-500/20 text-indigo-400">
              <Layers className="h-5 w-5" />
            </div>
            <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-slate-800 text-slate-300">
              :8080
            </span>
          </div>
          <h3 className="font-bold text-sm text-white">API Gateway</h3>
          <p className="text-[11px] text-slate-400">Spring Cloud Gateway</p>
        </div>

        {/* Auth Service */}
        <div className="service-node glass-card p-4 rounded-2xl border border-slate-800">
          <div className="flex items-center justify-between mb-2">
            <div className="p-2 rounded-xl bg-purple-500/20 text-purple-400">
              <Shield className="h-5 w-5" />
            </div>
            <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-slate-800 text-slate-300">
              Postgres
            </span>
          </div>
          <h3 className="font-bold text-sm text-white">Auth Service</h3>
          <p className="text-[11px] text-slate-400">Spring Boot 3.5 (JWT)</p>
        </div>

        {/* Catalog Service */}
        <div className="service-node glass-card p-4 rounded-2xl border border-slate-800">
          <div className="flex items-center justify-between mb-2">
            <div className="p-2 rounded-xl bg-teal-500/20 text-teal-400">
              <ShoppingBag className="h-5 w-5" />
            </div>
            <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-slate-800 text-slate-300">
              MongoDB 8.0
            </span>
          </div>
          <h3 className="font-bold text-sm text-white">Catalog Service</h3>
          <p className="text-[11px] text-slate-400">FastAPI + PyMongo</p>
        </div>

        {/* Cart Service */}
        <div className="service-node glass-card p-4 rounded-2xl border border-slate-800">
          <div className="flex items-center justify-between mb-2">
            <div className="p-2 rounded-xl bg-amber-500/20 text-amber-400">
              <ShoppingCart className="h-5 w-5" />
            </div>
            <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-slate-800 text-slate-300">
              Redis 8
            </span>
          </div>
          <h3 className="font-bold text-sm text-white">Cart Service</h3>
          <p className="text-[11px] text-slate-400">Express 5 + ioredis</p>
        </div>

        {/* Order Service */}
        <div
          className={`service-node glass-card p-4 rounded-2xl border transition-all duration-300 ${
            (activeStep === 1 || activeStep === 4) && sagaTriggered
              ? "border-blue-500 bg-blue-950/40 shadow-lg shadow-blue-500/20 scale-105"
              : "border-slate-800"
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <div className="p-2 rounded-xl bg-blue-500/20 text-blue-400">
              <Receipt className="h-5 w-5" />
            </div>
            <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-slate-800 text-slate-300">
              Postgres Outbox
            </span>
          </div>
          <h3 className="font-bold text-sm text-white">Order Service</h3>
          <p className="text-[11px] text-slate-400">Spring Boot Saga</p>
        </div>

        {/* Kafka KRaft */}
        <div
          className={`service-node glass-card p-4 rounded-2xl border transition-all duration-300 ${
            (activeStep === 2 || activeStep === 4) && sagaTriggered
              ? "border-amber-500 bg-amber-950/40 shadow-lg shadow-amber-500/20 scale-105"
              : "border-slate-800"
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <div className="p-2 rounded-xl bg-amber-500/20 text-amber-400">
              <Radio className="h-5 w-5" />
            </div>
            <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-slate-800 text-slate-300">
              KRaft :9092
            </span>
          </div>
          <h3 className="font-bold text-sm text-white">Apache Kafka</h3>
          <p className="text-[11px] text-slate-400">Kafka 4.2.1 Event Bus</p>
        </div>

        {/* Payment Service */}
        <div
          className={`service-node glass-card p-4 rounded-2xl border transition-all duration-300 ${
            activeStep === 3 && sagaTriggered
              ? "border-pink-500 bg-pink-950/40 shadow-lg shadow-pink-500/20 scale-105"
              : "border-slate-800"
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <div className="p-2 rounded-xl bg-pink-500/20 text-pink-400">
              <CreditCard className="h-5 w-5" />
            </div>
            <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-slate-800 text-slate-300">
              FastAPI Saga
            </span>
          </div>
          <h3 className="font-bold text-sm text-white">Payment Service</h3>
          <p className="text-[11px] text-slate-400">aiokafka + Redis Idempotent</p>
        </div>

        {/* Notification Service */}
        <div
          className={`service-node glass-card p-4 rounded-2xl border transition-all duration-300 ${
            activeStep === 5 && sagaTriggered
              ? "border-cyan-500 bg-cyan-950/40 shadow-lg shadow-cyan-500/20 scale-105"
              : "border-slate-800"
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <div className="p-2 rounded-xl bg-cyan-500/20 text-cyan-400">
              <Mail className="h-5 w-5" />
            </div>
            <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-slate-800 text-slate-300">
              Mailpit :1025
            </span>
          </div>
          <h3 className="font-bold text-sm text-white">Notification Worker</h3>
          <p className="text-[11px] text-slate-400">Node.js + kafkajs SMTP</p>
        </div>
      </div>

      {/* Active Saga Step Banner */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div className="flex items-center gap-3">
          <div
            className="w-3 h-3 rounded-full animate-ping"
            style={{ backgroundColor: steps[activeStep].color }}
          />
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              Step {activeStep + 1} of 6: {steps[activeStep].title}
            </p>
            <p className="text-sm font-semibold text-white mt-0.5">
              {steps[activeStep].desc}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          {steps.map((_, i) => (
            <div
              key={i}
              className={`h-2 rounded-full transition-all duration-300 ${
                i === activeStep
                  ? "w-6 bg-indigo-500"
                  : i < activeStep
                  ? "w-2 bg-emerald-500"
                  : "w-2 bg-slate-800"
              }`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
