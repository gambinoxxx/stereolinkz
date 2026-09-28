import type { Metadata } from "next";
import { Archivo } from "next/font/google";
import "./globals.css";

// ₦ only exists in Archivo's latin-ext subset.
const archivo = Archivo({
  variable: "--font-sans",
  subsets: ["latin", "latin-ext"],
  axes: ["wdth"],
});

export const metadata: Metadata = {
  title: "RateBoard · Stereolinkz",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${archivo.variable} h-full`}>
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
