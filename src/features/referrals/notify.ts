import "server-only";

// Emails a customer their new referral code (after the response; a failed
// or skipped email never affects the deal). Logs only the outcome, never
// the address, code or link.
import { customerReferralCodeEmail } from "@/features/deals/emails";
import { campaignInForceNow } from "@/features/referrals/attach";
import { bpsToPct } from "@/features/referrals/rules";
import type { NewCustomerCode } from "@/features/referrals/rewards";
import { customerEmailReady, sendEmail } from "@/lib/server/email";
import { db } from "@/lib/server/db";
import { siteUrl } from "@/lib/site-url";

export async function notifyReferralCode(
  dealId: string,
  created: NonNullable<NewCustomerCode>,
) {
  try {
    const d = await db.deal.findUnique({
      where: { id: dealId },
      select: {
        customerEmail: true,
        organizationId: true,
        organization: { select: { name: true } },
      },
    });
    if (!d?.customerEmail) return;
    if (!customerEmailReady()) {
      console.warn("[referrals] code email skipped: no sending domain");
      return;
    }
    const campaign = await campaignInForceNow(db, d.organizationId, new Date());
    const ok = await sendEmail({
      to: [d.customerEmail],
      ...customerReferralCodeEmail({
        brand: d.organization.name,
        code: created.code,
        shareUrl: new URL(`/r/${created.code}`, siteUrl()).href,
        pageUrl: new URL(`/referrals/${created.pageToken}`, siteUrl()).href,
        pct: campaign ? bpsToPct(campaign.rewardBps) : null,
      }),
    });
    if (!ok) console.error("[referrals] code email failed");
  } catch (error) {
    console.error(
      `[referrals] code email failed: ${error instanceof Error ? error.name : "error"}`,
    );
  }
}
