import type { Metadata } from "next";
import Script from "next/script";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/components/auth/AuthProvider";
import { LanguageProvider } from "@/components/i18n/LanguageProvider";

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
  description: "Pan-African gaming platform - Accounts, top-ups, and premium services",
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
    description: "Pan-African gaming platform - Accounts, top-ups, and premium services",
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
    description: "Pan-African gaming platform - Accounts, top-ups, and premium services",
    images: ["/images/Capture_d_écran_2026-02-10_115245-removebg-preview.png"],
  },
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
};

import BottomNavigation from "@/components/BottomNavigation";
import AppHeader from "@/components/layout/AppHeader";
import Footer from "@/components/layout/Footer";
import ChunkErrorReload from "@/components/system/ChunkErrorReload";
import CartDrawer from "@/components/cart/CartDrawer";
import ServiceWorkerBootstrap from "@/components/system/ServiceWorkerBootstrap";
import AndroidAppDownloadPrompt from "@/components/system/AndroidAppDownloadPrompt";
import NativeBridge from "./NativeBridge";

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
    <html lang="en" className="dark" suppressHydrationWarning>
      <head>
        <meta name="theme-color" content="#0B0F19" />
        <Script id="sentry-blocker" strategy="beforeInteractive">
          {`(() => {
  try {
    if (typeof window === 'undefined') return;
    if (window.__primeSentryBlocked) return;

    const isSentryUrl = (value) => {
      try {
        const raw = typeof value === 'string' ? value : (value && value.url) ? value.url : '';
        if (!raw) return false;
        const u = new URL(raw, window.location.href);
        return typeof u.hostname === 'string' && u.hostname.endsWith('sentry.io');
      } catch {
        return false;
      }
    };

    const originalFetch = window.fetch;
    if (typeof originalFetch === 'function') {
      window.fetch = function (input, init) {
        try {
          if (isSentryUrl(input)) {
            if (typeof Response === 'function') {
              return Promise.resolve(new Response(null, { status: 204 }));
            }
            return Promise.resolve({ ok: true, status: 204 });
          }
        } catch {
          // ignore
        }
        return originalFetch.call(this, input, init);
      };
    }

    const nav = window.navigator;
    const originalSendBeacon = nav && typeof nav.sendBeacon === 'function' ? nav.sendBeacon.bind(nav) : null;
    if (originalSendBeacon) {
      nav.sendBeacon = function (url, data) {
        try {
          if (isSentryUrl(url)) return true;
        } catch {
          // ignore
        }
        return originalSendBeacon(url, data);
      };
    }

    window.__primeSentryBlocked = true;
  } catch {
    // ignore
  }
})();`}
        </Script>
        <Script async src="https://www.googletagmanager.com/gtag/js?id=G-57FLWN4ZND" />
        <Script id="gtag-init">
          {`window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('js', new Date());
      gtag('config', 'G-57FLWN4ZND');`}
        </Script>
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(orgJsonLd) }} />
      </head>
      <body
        suppressHydrationWarning
        className={`${geistSans.variable} ${geistMono.variable} antialiased text-white min-h-[100dvh] overflow-x-hidden pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]`}
      >
        <ChunkErrorReload />
        <ServiceWorkerBootstrap />
        <NativeBridge />
        <AuthProvider>
          <LanguageProvider>
            <AppHeader />
            <AndroidAppDownloadPrompt />
            {children}
            <Footer />
            <BottomNavigation />
            <CartDrawer />
          </LanguageProvider>
        </AuthProvider>
        <Script src="https://code.tidio.co/txhqas6mr4cvgvb9rm4hbz7rdvye2cjw.js" strategy="afterInteractive" async />
      </body>
    </html>
  );
}
