"use client";

import { CheckCircle2, Clock, Truck, PackageCheck, Box, ArrowRight } from "lucide-react";

interface OrderTrackingStepperProps {
  status: string;
  createdAt: string;
  trackingNumber?: string;
}

export function OrderTrackingStepper({
  status,
  createdAt,
  trackingNumber = "ECM-894210-US",
}: OrderTrackingStepperProps) {
  const isPaid = status === "PAID";
  const isPending = status === "PENDING_PAYMENT";
  const isFailed = status === "PAYMENT_FAILED" || status === "FAILED" || status === "CANCELLED";

  // Compute active step (0 to 4)
  let activeStep = 1;
  if (isPending) activeStep = 0;
  if (isPaid) activeStep = 3; // In demo, mark as out for delivery when paid

  const steps = [
    { title: "Ordered", desc: new Date(createdAt).toLocaleDateString(), icon: Box },
    { title: "Payment Verified", desc: isPaid ? "Kafka Saga Approved" : "Processing", icon: CheckCircle2 },
    { title: "Dispatched", desc: "Seattle Fulfillment Hub", icon: PackageCheck },
    { title: "Out for Delivery", desc: `Carrier Track #${trackingNumber}`, icon: Truck },
    { title: "Delivered", desc: "Estimated by 8:00 PM", icon: CheckCircle2 },
  ];

  return (
    <div className="glass-card p-6 sm:p-8 rounded-3xl border border-white/10 my-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 mb-8 pb-4 border-b border-white/5">
        <div>
          <span className="text-[10px] font-bold uppercase tracking-wider text-cyan-400">
            Real-Time Shipment Progress
          </span>
          <h3 className="text-lg font-black text-white mt-0.5">
            {isPaid ? "Arriving Tomorrow by 8 PM" : isPending ? "Confirming Order Payment..." : "Order Cancelled"}
          </h3>
        </div>
        <div className="text-right">
          <span className="text-[10px] text-slate-400">Tracking Number:</span>
          <p className="font-mono text-xs font-bold text-amber-400">{trackingNumber}</p>
        </div>
      </div>

      {/* Progress Bar & Nodes */}
      <div className="relative">
        {/* Connecting Line */}
        <div className="absolute top-5 left-6 right-6 h-1 bg-slate-800 -z-0 hidden sm:block">
          <div
            className="h-full bg-gradient-to-r from-emerald-500 via-cyan-500 to-amber-500 transition-all duration-700"
            style={{ width: `${(activeStep / (steps.length - 1)) * 100}%` }}
          />
        </div>

        {/* Steps Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-5 gap-6 sm:gap-2 relative z-10">
          {steps.map((step, idx) => {
            const Icon = step.icon;
            const isCompleted = idx <= activeStep;
            const isCurrent = idx === activeStep;

            return (
              <div key={idx} className="flex sm:flex-col items-center sm:text-center gap-3 sm:gap-2">
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-xs transition-all shadow-md shrink-0 ${
                    isCompleted
                      ? "bg-gradient-to-tr from-emerald-500 to-teal-500 text-slate-950 shadow-emerald-500/20 scale-105"
                      : "bg-slate-800 text-slate-500 border border-slate-700"
                  } ${isCurrent ? "ring-4 ring-amber-400/30 animate-pulse" : ""}`}
                >
                  <Icon className="h-5 w-5" />
                </div>

                <div>
                  <p
                    className={`text-xs font-bold ${
                      isCompleted ? "text-white" : "text-slate-500"
                    }`}
                  >
                    {step.title}
                  </p>
                  <p className="text-[10px] text-slate-400 leading-tight mt-0.5">{step.desc}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
