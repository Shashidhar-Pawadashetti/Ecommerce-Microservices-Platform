"use client";

import { X, Printer, Package, ShieldCheck, CheckCircle2 } from "lucide-react";
import { OrderSnapshot } from "@/types";

interface InvoiceModalProps {
  order: OrderSnapshot;
  onClose: () => void;
}

export function InvoiceModal({ order, onClose }: InvoiceModalProps) {
  const handlePrint = () => {
    window.print();
  };

  const invoiceNum = `INV-NEX-${order.orderId.replace(/[^a-zA-Z0-9]/g, "").slice(0, 8).toUpperCase()}`;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-slate-900 border border-white/10 rounded-3xl p-6 sm:p-10 max-w-2xl w-full shadow-2xl text-white my-8 relative">
        {/* Action Bar */}
        <div className="flex items-center justify-between pb-6 border-b border-white/10 no-print">
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="px-4 py-2 rounded-full bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold flex items-center gap-1.5 border border-white/10 cursor-pointer"
            >
              <Printer className="h-4 w-4 text-cyan-400" /> Print Receipt / Invoice
            </button>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full text-slate-400 hover:text-white hover:bg-white/10"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Invoice Document */}
        <div className="py-6 space-y-6">
          {/* Header */}
          <div className="flex justify-between items-start">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <div className="p-1.5 rounded-lg bg-gradient-to-tr from-cyan-500 to-indigo-600 text-slate-950 font-black">
                  <Package className="h-5 w-5" />
                </div>
                <span className="text-xl font-black text-white">
                  NEX<span className="text-cyan-400">ORA</span> <span className="text-xs text-slate-400 font-normal">Cloud Commerce</span>
                </span>
              </div>
              <p className="text-[11px] text-slate-400">Nexora Global Microservices Inc.</p>
              <p className="text-[11px] text-slate-400">410 Terry Ave N, Seattle, WA 98109</p>
            </div>

            <div className="text-right">
              <span className="text-xs font-bold uppercase tracking-wider text-cyan-400">
                Official Commercial Invoice
              </span>
              <p className="text-base font-black text-white font-mono mt-0.5">{invoiceNum}</p>
              <p className="text-xs text-slate-400">
                Date: {new Date(order.createdAt).toLocaleDateString()}
              </p>
            </div>
          </div>

          {/* Order & Address Information */}
          <div className="grid grid-cols-2 gap-4 p-4 rounded-2xl bg-white/5 border border-white/5 text-xs">
            <div>
              <p className="font-bold text-slate-400 uppercase text-[10px] mb-1">Shipping Address</p>
              <p className="font-bold text-white">Verified Customer</p>
              <p className="text-slate-300">1234 Commerce Blvd, Suite 400</p>
              <p className="text-slate-300">Seattle, WA 98101, United States</p>
            </div>
            <div>
              <p className="font-bold text-slate-400 uppercase text-[10px] mb-1">Payment & Saga Protocol</p>
              <p className="font-bold text-white">Kafka KRaft Outbox Authorization</p>
              <p className="text-slate-300">Status: <span className="text-emerald-400 font-bold">{order.status}</span></p>
              <p className="text-slate-300 font-mono text-[11px]">Order #{order.orderId}</p>
            </div>
          </div>

          {/* Items Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-white/10 text-slate-400 uppercase text-[10px]">
                  <th className="py-2.5">Item Description</th>
                  <th className="py-2.5 text-center">Qty</th>
                  <th className="py-2.5 text-right">Unit Price</th>
                  <th className="py-2.5 text-right">Line Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {order.items?.map((item, i) => (
                  <tr key={i} className="text-slate-200">
                    <td className="py-3 font-medium">
                      {item.nameSnapshot || item.name || `Product #${item.productId}`}
                    </td>
                    <td className="py-3 text-center">{item.quantity}</td>
                    <td className="py-3 text-right">
                      {((item.unitPriceCents || 0) / 100).toLocaleString("en-US", {
                        style: "currency",
                        currency: order.currency || "USD",
                      })}
                    </td>
                    <td className="py-3 text-right font-bold text-white">
                      {(((item.unitPriceCents || 0) * item.quantity) / 100).toLocaleString("en-US", {
                        style: "currency",
                        currency: order.currency || "USD",
                      })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Financial Summary */}
          <div className="pt-4 border-t border-white/10 flex justify-end">
            <div className="w-64 space-y-2 text-xs">
              <div className="flex justify-between text-slate-400">
                <span>Items Subtotal:</span>
                <span className="font-bold text-white">
                  {((order.totalCents || 0) / 100).toLocaleString("en-US", {
                    style: "currency",
                    currency: order.currency || "USD",
                  })}
                </span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Shipping (Nexora Express):</span>
                <span className="font-bold text-emerald-400">FREE ($0.00)</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Estimated Tax (0%):</span>
                <span>$0.00</span>
              </div>
              <div className="flex justify-between items-center pt-2 border-t border-white/10 text-sm font-black text-white">
                <span>Grand Total:</span>
                <span className="text-xl text-cyan-400">
                  {((order.totalCents || 0) / 100).toLocaleString("en-US", {
                    style: "currency",
                    currency: order.currency || "USD",
                  })}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
