import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import QueryProvider from "@/providers/QueryProvider";
import { Navbar } from "@/components/Navbar";
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
  title: "EcoMicro — Microservices Ecommerce Platform",
  description: "Ultra-responsive, event-driven polyglot ecommerce platform powered by Spring Boot, FastAPI, Node.js, and Kafka KRaft.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-[#090d16] text-slate-100 selection:bg-indigo-500/30 selection:text-indigo-300 min-h-screen flex flex-col`}
      >
        <QueryProvider>
          <AnimeBackground />
          <div className="relative z-10 flex min-h-screen flex-col">
            <Navbar />
            <main className="flex-1">
              {children}
            </main>
          </div>
        </QueryProvider>
      </body>
    </html>
  );
}
