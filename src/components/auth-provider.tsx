import { ClerkProvider } from "@clerk/nextjs";
import type { ReactNode } from "react";

// Clerk for the signed-in parts of the app only: the admin layout, the
// login page and /not-authorized. The public landing page (/) has no
// provider, so it loads none of Clerk's scripts or cookies (code-standards
// → Public Site budgets). Server-side auth() needs no provider: the proxy
// attaches the session to every request.
export function AuthProvider({ children }: { children: ReactNode }) {
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
      {children}
    </ClerkProvider>
  );
}
