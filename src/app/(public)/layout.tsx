import "./landing.css";

// The public site (architecture.md → Public Landing Page): no admin shell
// and no Clerk UI. Its stylesheet is scoped under .lp and loads only here.
export default function PublicLayout({ children }: LayoutProps<"/">) {
  return <>{children}</>;
}
