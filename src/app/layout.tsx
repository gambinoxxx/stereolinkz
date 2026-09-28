import type { Metadata } from "next";
import { Archivo } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
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
    <ClerkProvider
      appearance={{ cssLayerName: "clerk" }}
      localization={{
        signIn: {
          start: {
            title: "Sign in to RateBoard",
            subtitle: "For Stereolinkz team members.",
            // Clerk shows the "combined" copy when sign-in and sign-up share a flow
            titleCombined: "Sign in to RateBoard",
            subtitleCombined: "For Stereolinkz team members.",
          },
        },
        formFieldInputPlaceholder__emailAddress: "you@stereolinkz.com",
      }}
    >
      <html lang="en" className={`${archivo.variable} h-full`}>
        <body className="flex min-h-full flex-col">{children}</body>
      </html>
    </ClerkProvider>
  );
}
