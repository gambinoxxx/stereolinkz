import type { Metadata } from "next";
import { Archivo } from "next/font/google";
import "./globals.css";

import { SpeedInsights } from "@/components/speed-insights";
import { siteUrl } from "@/lib/site-url";

// ₦ only exists in Archivo's latin-ext subset.
const archivo = Archivo({
  variable: "--font-sans",
  subsets: ["latin", "latin-ext"],
  axes: ["wdth"],
});

export const metadata: Metadata = {
  metadataBase: siteUrl(),
  title: "RateBoard · Stereolinkz",
  // Meta Business domain verification for stereolinkz.com.
  other: {
    "facebook-domain-verification": "me7nlar2eqmx9u5oh202gcz3m3k7kh",
  },
};

// Clerk is added by the signed-in sections (AuthProvider), not here, so
// the public page stays free of it.
export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${archivo.variable} h-full`}>
      <body className="flex min-h-full flex-col">
        {children}
        <SpeedInsights />
      </body>
    </html>
  );
}
