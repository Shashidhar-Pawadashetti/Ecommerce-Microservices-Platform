"use client";

import { useQuery } from "@tanstack/react-query";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useEffect, useState } from "react";

interface Order {
  orderId: string;
  userId: string;
  status: string; // PENDING_PAYMENT, PAID, PAYMENT_FAILED
  totalCents: number;
  currency: string;
  createdAt: string;
}

export default function OrderStatusPage() {
  const { id } = useParams();
  const [shouldPoll, setShouldPoll] = useState(true);

  const { data: order, isLoading, error } = useQuery<Order>({
    queryKey: ["order", id],
    queryFn: async () => {
      const res = await fetch(`/api/gateway/orders/${id}`);
      if (!res.ok) {
        throw new Error("Order not found or unauthorized");
      }
      return res.json();
    },
    enabled: !!id,
    refetchInterval: shouldPoll ? 3000 : false, // Poll every 3 seconds if needed
  });

  // Stop polling once the order reaches a final state
  useEffect(() => {
    if (order && (order.status === "PAID" || order.status === "PAYMENT_FAILED" || order.status === "CANCELLED" || order.status === "FAILED")) {
      setShouldPoll(false);
    }
  }, [order]);

  if (isLoading) return <div className="p-8 text-center text-gray-500">Loading order details...</div>;
  if (error) return <div className="p-8 text-center text-red-500">Error: {(error as Error).message}</div>;
  if (!order) return <div className="p-8 text-center">Order not found.</div>;

  return (
    <div className="container mx-auto p-4 max-w-2xl">
      <div className="bg-white rounded shadow-lg p-8 text-center">
        <h1 className="text-3xl font-bold mb-2">Order Status</h1>
        <p className="text-gray-500 mb-8">Order ID: {order.orderId}</p>
        
        <div className="mb-8">
          <div className="text-sm text-gray-500 uppercase tracking-wide mb-1">Status</div>
          <div className={`text-2xl font-bold ${
            order.status === "PENDING_PAYMENT" ? "text-yellow-500" :
            order.status === "PAID" ? "text-green-500" :
            "text-red-500"
          }`}>
            {order.status}
          </div>
          {order.status === "PENDING_PAYMENT" && (
            <p className="text-sm text-gray-500 mt-2">Waiting for payment confirmation... This page will auto-refresh.</p>
          )}
        </div>

        <div className="mb-8 p-4 bg-gray-50 rounded text-left">
          <div className="flex justify-between items-center border-b pb-2 mb-2">
            <span className="font-semibold">Total Amount</span>
            <span className="font-bold text-lg">
              {(order.totalCents / 100).toLocaleString("en-US", {
                style: "currency",
                currency: order.currency,
              })}
            </span>
          </div>
          <div className="flex justify-between items-center text-gray-600 text-sm">
            <span>Date</span>
            <span>{new Date(order.createdAt).toLocaleString()}</span>
          </div>
        </div>

        {order.status === "PENDING_PAYMENT" && (
          <div className="mt-4 p-4 border rounded border-blue-200 bg-blue-50 text-blue-800 text-sm text-left">
            <strong>Payment Processing</strong> <br />
            Payment is simulated automatically in the background based on the PAYMENT_MODE configuration. Keep this page open to see the result.
          </div>
        )}

        <div className="mt-8">
          <Link href="/" className="text-blue-500 hover:underline">
            Return to Catalog
          </Link>
        </div>
      </div>
    </div>
  );
}
