import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Suspense } from "react";
import QueryProvider from "@/providers/QueryProvider";
import { StoreProvider } from "@/providers/StoreContext";
import { MarketplaceNavbar } from "@/components/marketplace/MarketplaceNavbar";
import { MarketplaceFooter } from "@/components/marketplace/MarketplaceFooter";
import { ToastNotification } from "@/components/marketplace/ToastNotification";
import { MicroservicesTelemetryDrawer } from "@/components/marketplace/MicroservicesTelemetryDrawer";
import { AnimeBackground } from "@/components/anime/AnimeBackground";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Nexora — Event-Driven Cloud Commerce Platform",
  description: "Enterprise e-commerce marketplace powered by Spring Boot 3.5, FastAPI, Node.js 24, and Kafka 4.2 KRaft.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-[#070b13] text-slate-100 selection:bg-cyan-500/30 selection:text-cyan-300 min-h-screen flex flex-col`}
      >
        <QueryProvider>
          <StoreProvider>
            <AnimeBackground />
            <div className="relative z-10 flex min-h-screen flex-col justify-between">
              <div>
                <Suspense fallback={<div className="h-16 bg-[#0b101b]" />}>
                  <MarketplaceNavbar />
                </Suspense>
                <ToastNotification />
                <main className="flex-1">
                  {children}
                </main>
              </div>
              <MicroservicesTelemetryDrawer />
              <MarketplaceFooter />
            </div>
          </StoreProvider>
        </QueryProvider>
      </body>
    </html>
  );
}
