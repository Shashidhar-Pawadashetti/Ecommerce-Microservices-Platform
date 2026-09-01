import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Suspense } from "react";
import QueryProvider from "@/providers/QueryProvider";
import { StoreProvider } from "@/providers/StoreContext";
import { AmazonMegaNavbar } from "@/components/amazon/AmazonMegaNavbar";
import { AmazonFooter } from "@/components/amazon/AmazonFooter";
import { ToastNotification } from "@/components/amazon/ToastNotification";
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
  title: "EcoPrime — Event-Driven Microservices Commerce",
  description: "Amazon-grade e-commerce marketplace powered by Spring Boot, FastAPI, Node.js, and Kafka KRaft.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-[#090d16] text-slate-100 selection:bg-amber-500/30 selection:text-amber-300 min-h-screen flex flex-col`}
      >
        <QueryProvider>
          <StoreProvider>
            <AnimeBackground />
            <div className="relative z-10 flex min-h-screen flex-col justify-between">
              <div>
                <Suspense fallback={<div className="h-16 bg-[#0d131f]" />}>
                  <AmazonMegaNavbar />
                </Suspense>
                <ToastNotification />
                <main className="flex-1">
                  {children}
                </main>
              </div>
              <AmazonFooter />
            </div>
          </StoreProvider>
        </QueryProvider>
      </body>
    </html>
  );
}
