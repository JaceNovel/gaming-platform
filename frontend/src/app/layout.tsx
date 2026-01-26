import type { Metadata } from "next";
import Script from "next/script";
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
  description: "Plateforme gaming panafricaine - Comptes, recharges et services premium",
  icons: {
    icon: "/images/badboyshop-logo.png",
    shortcut: "/images/badboyshop-logo.png",
    apple: "/images/badboyshop-logo.png",
  },
  openGraph: {
    title: "BADBOYSHOP - Gaming Platform",
    description: "Plateforme gaming panafricaine - Comptes, recharges et services premium",
    url: "https://badboyshop.com",
    siteName: "BADBOYSHOP",
    images: [
      {
        url: "/images/badboyshop-logo.png",
        width: 512,
        height: 512,
        alt: "BADBOYSHOP",
      },
    ],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "BADBOYSHOP - Gaming Platform",
    description: "Plateforme gaming panafricaine - Comptes, recharges et services premium",
    images: ["/images/badboyshop-logo.png"],
  },
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
      <head>
        <Script async src="https://www.googletagmanager.com/gtag/js?id=G-66BKKJ3F7B" />
        <Script id="gtag-init">
          {`window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('js', new Date());
gtag('config', 'G-66BKKJ3F7B');`}
        </Script>
      </head>
      <body
        suppressHydrationWarning
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-gray-900 text-white min-h-[100dvh] overflow-x-hidden pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]`}
      >
        <AuthProvider>
          <AppHeader />
          {children}
          <BottomNavigation />
        </AuthProvider>
        <Script src="//code.tidio.co/txhqas6mr4cvgvb9rm4hbz7rdvye2cjw.js" strategy="afterInteractive" async />
      </body>
    </html>
  );
}
