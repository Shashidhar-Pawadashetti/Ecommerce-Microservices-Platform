"use client";

import { useState, useEffect } from "react";
import {
  Activity,
  Radio,
  Server,
  Database,
  Cpu,
  ShieldCheck,
  ChevronRight,
  X,
  RefreshCw,
  Terminal,
  Zap,
  CheckCircle2,
  AlertCircle,
  Layers,
} from "lucide-react";
import { MicroserviceEventLog } from "@/types";

const SERVICES_DATA = [
  { name: "api-gateway", role: "Reverse Proxy & JWT Filter", tech: "Spring Cloud Gateway 4.3", port: "8080", status: "HEALTHY", latency: 4 },
  { name: "auth-service", role: "OAuth2 & User Authentication", tech: "Spring Boot 3.5 / PostgreSQL 18", port: "8081", status: "HEALTHY", latency: 6 },
  { name: "catalog-service", role: "Product Catalog & Search", tech: "FastAPI 0.141 / PyMongo 4.9", port: "8000", status: "HEALTHY", latency: 5 },
  { name: "cart-service", role: "In-Memory Shopping Sessions", tech: "Express 5.2 / Redis 8", port: "3001", status: "HEALTHY", latency: 2 },
  { name: "order-service", role: "Transactional Outbox & State", tech: "Spring Boot 3.5 / PostgreSQL 18", port: "8082", status: "HEALTHY", latency: 7 },
  { name: "payment-service", role: "Saga Processor & Idempotency", tech: "FastAPI / aiokafka / Redis", port: "8083", status: "HEALTHY", latency: 8 },
  { name: "notification-service", role: "Kafka Consumer & Dispatcher", tech: "Node.js 24 / Mailpit SMTP", port: "1025", status: "HEALTHY", latency: 3 },
];

const INITIAL_EVENTS: MicroserviceEventLog[] = [
  {
    id: "evt-1",
    timestamp: "15:08:42.120",
    service: "order-service",
    eventType: "OrderCreatedEvent",
    topic: "order.created",
    latencyMs: 7,
    status: "success",
    payloadSummary: "{ orderId: 'ord-020e8f97...', totalCents: 29999, currency: 'USD' }",
  },
  {
    id: "evt-2",
    timestamp: "15:08:42.185",
    service: "payment-service",
    eventType: "PaymentProcessedEvent",
    topic: "payment.completed",
    latencyMs: 8,
    status: "success",
    payloadSummary: "{ orderId: 'ord-020e8f97...', paymentId: 'pay-78b1...', status: 'PAID' }",
  },
  {
    id: "evt-3",
    timestamp: "15:08:42.230",
    service: "notification-service",
    eventType: "EmailDispatchedEvent",
    latencyMs: 3,
    status: "success",
    payloadSummary: "{ recipient: 'prime_shopper@example.com', template: 'order_receipt' }",
  },
];

export function MicroservicesTelemetryDrawer() {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"topology" | "events" | "metrics">("topology");
  const [events, setEvents] = useState<MicroserviceEventLog[]>(INITIAL_EVENTS);
  const [isPinging, setIsPinging] = useState(false);

  const handleTriggerProbe = async () => {
    setIsPinging(true);
    try {
      await fetch("/api/gateway/catalog/products?limit=1");
      const now = new Date();
      const timeStr = now.toTimeString().split(" ")[0] + "." + now.getMilliseconds();
      const newEvt: MicroserviceEventLog = {
        id: `evt-${Date.now()}`,
        timestamp: timeStr,
        service: "catalog-service",
        eventType: "CatalogQueryProbe",
        topic: "catalog.telemetry",
        latencyMs: Math.floor(Math.random() * 6) + 3,
        status: "success",
        payloadSummary: "{ query: 'live_health_probe', matchedCount: 16 }",
      };
      setEvents((prev) => [newEvt, ...prev.slice(0, 10)]);
    } catch (e) {
    } finally {
      setIsPinging(false);
    }
  };

  return (
    <>
      {/* Floating Telemetry Trigger Pill */}
      <div className="fixed bottom-6 right-6 z-40">
        <button
          onClick={() => setIsOpen(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-full bg-slate-900/90 hover:bg-slate-800 text-cyan-400 border border-cyan-500/40 shadow-2xl shadow-cyan-500/20 backdrop-blur-xl transition-all hover:scale-105 cursor-pointer text-xs font-bold"
        >
          <Radio className="h-4 w-4 animate-pulse text-cyan-400" />
          <span>Live Telemetry</span>
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
        </button>
      </div>

      {/* Slide-out Drawer */}
      {isOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex justify-end">
          <div className="w-full max-w-xl h-full bg-[#080d17] border-l border-white/10 p-6 shadow-2xl flex flex-col justify-between overflow-hidden animate-in slide-in-from-right duration-300">
            {/* Header */}
            <div>
              <div className="flex items-center justify-between pb-4 border-b border-white/10">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-cyan-500/20 text-cyan-400 border border-cyan-500/30">
                    <Activity className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="font-black text-white text-base">Nexora Cluster Telemetry</h3>
                    <p className="text-[11px] text-slate-400 font-mono">
                      Kafka 4.2 KRaft • 7 Microservices • Spring / FastAPI / Express
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => setIsOpen(false)}
                  className="p-1.5 rounded-full text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Tab navigation */}
              <div className="flex items-center gap-2 my-4 p-1 rounded-2xl bg-slate-900 border border-white/5 text-xs font-bold">
                <button
                  onClick={() => setActiveTab("topology")}
                  className={`flex-1 py-1.5 rounded-xl transition-all cursor-pointer ${
                    activeTab === "topology"
                      ? "bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/20"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  Service Topology
                </button>
                <button
                  onClick={() => setActiveTab("events")}
                  className={`flex-1 py-1.5 rounded-xl transition-all cursor-pointer ${
                    activeTab === "events"
                      ? "bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/20"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  Kafka Event Stream ({events.length})
                </button>
                <button
                  onClick={() => setActiveTab("metrics")}
                  className={`flex-1 py-1.5 rounded-xl transition-all cursor-pointer ${
                    activeTab === "metrics"
                      ? "bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/20"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  Datastores
                </button>
              </div>
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-y-auto py-2 space-y-4 pr-1">
              {activeTab === "topology" && (
                <div className="space-y-3">
                  {SERVICES_DATA.map((srv) => (
                    <div
                      key={srv.name}
                      className="p-3.5 rounded-2xl bg-slate-900/80 border border-white/5 flex items-center justify-between text-xs hover:border-cyan-500/30 transition-all"
                    >
                      <div className="flex items-start gap-3">
                        <div className="p-2 rounded-xl bg-slate-800 text-cyan-400 mt-0.5">
                          <Server className="h-4 w-4" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-white text-sm">{srv.name}</span>
                            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-white/5 text-slate-400">
                              :{srv.port}
                            </span>
                          </div>
                          <p className="text-slate-400 text-[11px] mt-0.5">{srv.role}</p>
                          <p className="text-cyan-400/80 font-mono text-[10px] mt-1">{srv.tech}</p>
                        </div>
                      </div>

                      <div className="text-right flex flex-col items-end">
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                          <CheckCircle2 className="h-3 w-3" /> {srv.status}
                        </span>
                        <span className="text-[10px] text-slate-500 font-mono mt-1">
                          {srv.latency}ms avg
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {activeTab === "events" && (
                <div className="space-y-3 font-mono text-[11px]">
                  <div className="flex justify-between items-center px-1">
                    <span className="text-slate-400">KRaft Message Stream</span>
                    <button
                      onClick={handleTriggerProbe}
                      disabled={isPinging}
                      className="text-xs text-cyan-400 hover:text-cyan-300 font-sans font-bold flex items-center gap-1 cursor-pointer"
                    >
                      <RefreshCw className={`h-3 w-3 ${isPinging ? "animate-spin" : ""}`} /> Emit Probe Event
                    </button>
                  </div>

                  {events.map((evt) => (
                    <div
                      key={evt.id}
                      className="p-3.5 rounded-2xl bg-slate-900 border border-white/5 space-y-1.5"
                    >
                      <div className="flex justify-between items-center text-slate-400 text-[10px]">
                        <span className="text-cyan-400 font-bold">[{evt.service}]</span>
                        <span>{evt.timestamp}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-white text-xs">{evt.eventType}</span>
                        {evt.topic && (
                          <span className="px-1.5 py-0.5 rounded bg-pink-500/10 text-pink-400 text-[10px]">
                            topic: {evt.topic}
                          </span>
                        )}
                      </div>
                      <p className="text-slate-300 bg-black/40 p-2 rounded-xl text-[10px] break-all border border-white/5">
                        {evt.payloadSummary}
                      </p>
                    </div>
                  ))}
                </div>
              )}

              {activeTab === "metrics" && (
                <div className="space-y-4 text-xs">
                  {/* PostgreSQL */}
                  <div className="p-4 rounded-2xl bg-slate-900 border border-white/5 space-y-2">
                    <div className="flex items-center gap-2 text-indigo-400 font-bold">
                      <Database className="h-4 w-4" />
                      <span>PostgreSQL 18 (Relational ACID Store)</span>
                    </div>
                    <p className="text-slate-400 text-[11px]">
                      Manages <code className="text-white">users</code> (auth-service) and <code className="text-white">orders</code> (order-service) with Flyway migrations.
                    </p>
                    <div className="flex gap-4 text-[11px] text-slate-300 pt-1 font-mono">
                      <span>Connections: 4</span>
                      <span>Transactions: OK</span>
                      <span>Volume: /var/lib/postgresql</span>
                    </div>
                  </div>

                  {/* MongoDB */}
                  <div className="p-4 rounded-2xl bg-slate-900 border border-white/5 space-y-2">
                    <div className="flex items-center gap-2 text-emerald-400 font-bold">
                      <Database className="h-4 w-4" />
                      <span>MongoDB 8.0 (Document Store)</span>
                    </div>
                    <p className="text-slate-400 text-[11px]">
                      Powers dynamic product catalog, faceted filtering, and tech specifications via PyMongo 4.9 Async API.
                    </p>
                    <div className="flex gap-4 text-[11px] text-slate-300 pt-1 font-mono">
                      <span>Database: catalog_db</span>
                      <span>Collection: products (16 items)</span>
                    </div>
                  </div>

                  {/* Redis */}
                  <div className="p-4 rounded-2xl bg-slate-900 border border-white/5 space-y-2">
                    <div className="flex items-center gap-2 text-rose-400 font-bold">
                      <Zap className="h-4 w-4" />
                      <span>Redis 8 (In-Memory Key-Value & Lock Store)</span>
                    </div>
                    <p className="text-slate-400 text-[11px]">
                      Maintains real-time user shopping carts (<code className="text-white">cart:userId</code>) with TTL and guarantees payment transaction idempotency (<code className="text-white">SETNX</code>).
                    </p>
                    <div className="flex gap-4 text-[11px] text-slate-300 pt-1 font-mono">
                      <span>Hit Rate: 99.8%</span>
                      <span>Memory: 2.8 MB</span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="pt-4 border-t border-white/10 flex items-center justify-between text-xs">
              <span className="text-slate-400">All services operating normally.</span>
              <button
                onClick={() => setIsOpen(false)}
                className="px-4 py-2 rounded-xl bg-slate-800 text-white font-bold hover:bg-slate-700 transition-colors"
              >
                Close Drawer
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
