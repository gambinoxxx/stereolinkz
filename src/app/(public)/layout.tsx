import "./landing.css";

import { RefCapture } from "@/features/referrals/components/RefCapture";

// The public site (architecture.md → Public Landing Page): no admin shell
// and no Clerk UI. Its stylesheet is scoped under .lp and loads only here.
// RefCapture keeps a ?ref= code for the deal forms (Phase 13c).
export default function PublicLayout({ children }: LayoutProps<"/">) {
  return (
    <>
      {children}
      <RefCapture />
    </>
  );
}
