import { ChevronRight, Share2 } from "lucide-react";
import Link from "next/link";

import { CopyButton } from "@/features/deals/components/customer/CopyButton";
import { whatsappLink } from "@/features/public/whatsapp";
import { referralShareMessage } from "@/features/referrals/messages";

// The tracking page's card on a completed deal: the customer's own code,
// share buttons and the way into their referrals (authorised by this
// deal's tracking token).
export function ReferralCard({
  brand,
  code,
  shareUrl,
  pct,
  viewHref,
}: {
  brand: string;
  code: string;
  shareUrl: string;
  pct: string | null;
  viewHref: string;
}) {
  return (
    <section className="card" style={{ textAlign: "left" }}>
      <h2>Earn with {brand}</h2>
      <p className="d">
        {pct
          ? `Share your link and earn ${pct}% of our profit on your friends’ first deal.`
          : "Share your link. Rewards resume when the next campaign starts."}
      </p>
      <div className="copyrow" style={{ marginTop: 18 }}>
        <div className="v">
          <small>Your code</small>
          <span className="num">{code}</span>
        </div>
        <CopyButton value={shareUrl} label="Copy link" />
      </div>
      <a
        className="btn vio block"
        style={{ marginTop: 14 }}
        href={whatsappLink(null, referralShareMessage(brand, shareUrl))}
        target="_blank"
        rel="noopener noreferrer"
      >
        <Share2 size={18} strokeWidth={2.2} aria-hidden="true" />
        Share on WhatsApp
      </a>
      <Link
        className="btn ghost block"
        style={{ marginTop: 10 }}
        href={viewHref}
      >
        View my referrals{" "}
        <ChevronRight size={18} strokeWidth={2.2} aria-hidden="true" />
      </Link>
    </section>
  );
}
