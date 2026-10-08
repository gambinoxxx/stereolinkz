// The public site (architecture.md → Public Landing Page): no admin shell
// and no Clerk UI. Its styles load only on these routes.
export default function PublicLayout({ children }: LayoutProps<"/">) {
  return <>{children}</>;
}
