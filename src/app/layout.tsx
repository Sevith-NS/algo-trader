import type { Metadata } from "next";
import { Suspense } from "react";
import { Inter, JetBrains_Mono } from "next/font/google";
import "locomotive-scroll/dist/locomotive-scroll.css";
import "./globals.css";
import { PortfolioProvider } from "../context/PortfolioContext";
import AuthProvider from "../components/AuthProvider";
import AIAssistant from "../components/AIAssistant";

const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Vanguard OS — Screener & Portfolio Intelligence",
  description: "Quant-grade stock screener, portfolio management, global news sentiment and AI copilot",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${inter.variable} ${jetbrainsMono.variable}`}>
        <AuthProvider>
          <PortfolioProvider>
            {children}
            <Suspense fallback={null}>
              <AIAssistant />
            </Suspense>
          </PortfolioProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
