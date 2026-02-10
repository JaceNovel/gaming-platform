import type { Metadata } from "next";
import Script from "next/script";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/components/auth/AuthProvider";

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "https://primegaming.space").replace(/\/$/, "");
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
  title: "PRIME Gaming",
  description: "Plateforme gaming panafricaine - Comptes, recharges et services premium",
  metadataBase: new URL(SITE_URL),
  alternates: {
    canonical: "/",
  },
  manifest: "/manifest.json",
  icons: {
    icon: [
      { url: `/images/Capture_d_écran_2026-02-10_115245-removebg-preview.png?v=${ASSET_VERSION}`, type: "image/png" },
    ],
    apple: [{ url: `/images/Capture_d_écran_2026-02-10_115245-removebg-preview.png?v=${ASSET_VERSION}`, type: "image/png" }],
    shortcut: [{ url: `/images/Capture_d_écran_2026-02-10_115245-removebg-preview.png?v=${ASSET_VERSION}` }],
  },
  openGraph: {
    title: "PRIME Gaming",
    description: "Plateforme gaming panafricaine - Comptes, recharges et services premium",
    url: SITE_URL,
    siteName: "PRIME Gaming",
    images: [
      {
        url: "/images/Capture_d_écran_2026-02-10_115245-removebg-preview.png",
        alt: "PRIME Gaming",
      },
    ],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "PRIME Gaming",
    description: "Plateforme gaming panafricaine - Comptes, recharges et services premium",
    images: ["/images/Capture_d_écran_2026-02-10_115245-removebg-preview.png"],
  },
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
};

import BottomNavigation from "@/components/BottomNavigation";
import AppHeader from "@/components/layout/AppHeader";
import ChunkErrorReload from "@/components/system/ChunkErrorReload";
import CartDrawer from "@/components/cart/CartDrawer";
import ServiceWorkerBootstrap from "@/components/system/ServiceWorkerBootstrap";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const orgJsonLd = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "PRIME Gaming",
    url: SITE_URL,
    logo: `${SITE_URL}/images/Capture_d_écran_2026-02-10_115245-removebg-preview.png`,
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
        className={`${geistSans.variable} ${geistMono.variable} antialiased text-white min-h-[100dvh] overflow-x-hidden pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]`}
      >
        <ChunkErrorReload />
        <ServiceWorkerBootstrap />
        <AuthProvider>
          <AppHeader />
          {children}
          <BottomNavigation />
          <CartDrawer />
        </AuthProvider>
        <Script src="//code.tidio.co/txhqas6mr4cvgvb9rm4hbz7rdvye2cjw.js" strategy="afterInteractive" async />
      </body>
    </html>
  );
}
