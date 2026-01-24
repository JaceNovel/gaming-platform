import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/components/auth/AuthProvider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "BADBOYSHOP - Gaming Platform",
  description: "Plateforme gaming panafricaine - Comptes, recharges, tournois",
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
};

import BottomNavigation from "@/components/BottomNavigation";
import AppHeader from "@/components/layout/AppHeader";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr" className="dark" suppressHydrationWarning>
      <body
        suppressHydrationWarning
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-gray-900 text-white min-h-[100dvh] overflow-x-hidden pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]`}
      >
        <AuthProvider>
          <AppHeader />
          {children}
          <BottomNavigation />
        </AuthProvider>
      </body>
    </html>
  );
}
