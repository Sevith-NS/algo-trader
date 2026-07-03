import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { PortfolioProvider } from "../context/PortfolioContext";
import AuthProvider from "../components/AuthProvider";

const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Vanguard Screener",
  description: "Advanced 3D Stock Screener",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${inter.variable}`}>
        <AuthProvider>
          <PortfolioProvider>
            {children}
          </PortfolioProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
