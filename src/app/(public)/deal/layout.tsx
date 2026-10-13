import "./deal.css";

import { ArrowLeft, MessageCircle } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { Wordmark } from "@/features/public/components/Wordmark";
import { content } from "@/features/public/content";
import { whatsappLink } from "@/features/public/whatsapp";
import { DEAL_COPY } from "@/features/deals/content";
import { getDealDeskContext } from "@/features/deals/public-queries";

// Private pages: never indexed, and the tracking token in a link is never
// sent on to another site (Referrer-Policy is also a response header, set in
// next.config.ts for /deal/*).
export const metadata: Metadata = {
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

export default async function DealLayout({ children }: LayoutProps<"/deal">) {
  const ctx = await getDealDeskContext();
  const chat = whatsappLink(
    ctx?.org.contactLine ?? null,
    `Hi ${ctx?.org.name ?? content.brand}`,
  );
  return (
    <div className="dk">
      <div className="bgfx" aria-hidden="true">
        <i />
        <i />
      </div>
      <header className="top">
        <div className="in">
          <Link href="/" aria-label={`${content.brand} home`}>
            <Wordmark />
          </Link>
          <span className="sp" />
          <Link className="tlink" href="/">
            <ArrowLeft size={16} strokeWidth={2.2} aria-hidden="true" />
            <span className="hide-s">Back to website</span>
          </Link>
          <a className="btn vio sm" href={chat} target="_blank" rel="noopener">
            <MessageCircle size={18} strokeWidth={2.2} aria-hidden="true" />
            <span className="hide-s">Chat on WhatsApp</span>
          </a>
        </div>
      </header>
      {children}
      <footer>
        {DEAL_COPY.footer} © {new Date().getFullYear()}{" "}
        {ctx?.org.name ?? content.brand}.
      </footer>
    </div>
  );
}
