import { AuthProvider } from "@/components/auth-provider";

export default function NotAuthorizedLayout({
  children,
}: LayoutProps<"/not-authorized">) {
  return <AuthProvider>{children}</AuthProvider>;
}
