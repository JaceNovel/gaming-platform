import type { Metadata } from "next";
import Script from "next/script";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/components/auth/AuthProvider";

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "https://www.badboyshop.online").replace(/\/$/, "");
const ASSET_VERSION = "20260201";

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
  metadataBase: new URL(SITE_URL),
  alternates: {
    canonical: "/",
  },
  manifest: "/manifest.json",
  icons: {
    icon: [
      { url: `/favicon.ico?v=${ASSET_VERSION}` },
      { url: `/favicon-16x16.png?v=${ASSET_VERSION}`, sizes: "16x16", type: "image/png" },
      { url: `/favicon-32x32.png?v=${ASSET_VERSION}`, sizes: "32x32", type: "image/png" },
    ],
    apple: [{ url: `/apple-touch-icon.png?v=${ASSET_VERSION}`, sizes: "180x180", type: "image/png" }],
    shortcut: [{ url: `/favicon.ico?v=${ASSET_VERSION}` }],
  },
  openGraph: {
    title: "BADBOYSHOP - Gaming Platform",
    description: "Plateforme gaming panafricaine - Comptes, recharges et services premium",
    url: SITE_URL,
    siteName: "BADBOYSHOP",
    images: [
      {
        url: "/logo-512.png",
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
    images: ["/logo-512.png"],
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
  const orgJsonLd = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "BADBOYSHOP",
    url: "https://www.badboyshop.online",
    logo: "https://www.badboyshop.online/logo-512.png",
  };

  return (
    <html lang="fr" className="dark" suppressHydrationWarning>
      <head>
        <meta name="theme-color" content="#0B0F19" />
        <Script async src="https://www.googletagmanager.com/gtag/js?id=G-66BKKJ3F7B" />
        <Script id="gtag-init">
          {`window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('js', new Date());
gtag('config', 'G-66BKKJ3F7B');`}
        </Script>
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(orgJsonLd) }} />
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
