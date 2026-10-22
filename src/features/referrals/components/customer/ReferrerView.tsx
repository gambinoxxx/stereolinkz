import { Check, MessageCircle, Share2 } from "lucide-react";

import { CopyButton } from "@/features/deals/components/customer/CopyButton";
import { nairaText } from "@/features/deals/format";
import { whatsappLink } from "@/features/public/whatsapp";
import { dayLabel } from "@/features/referrals/labels";
import {
  referralQuestionMessage,
  referralShareMessage,
} from "@/features/referrals/messages";
import type {
  ReferredDeal,
  ReferrerView as View,
} from "@/features/referrals/referrer-queries";

const REWARD_WORDS: Record<
  NonNullable<ReferredDeal["reward"]>["status"],
  string
> = {
  pending: "reward pending",
  approved: "reward approved",
  paid: "reward paid",
  void: "no reward",
};

function line(d: ReferredDeal): string {
  const reward = !d.reward
    ? "no reward"
    : d.reward.status === "void"
      ? REWARD_WORDS.void
      : `${REWARD_WORDS[d.reward.status]} ${nairaText(d.reward.amountNaira)}`;
  return `${d.ref} · ${d.progress} · ${reward}`;
}

// The referrer's own page (/referrals/[token] and /deal/[ref]/referrals):
// their code and link, the campaign, totals and the masked list of deals
// they referred. Nothing here names or identifies the people referred.
export function ReferrerView({ view }: { view: View }) {
  const pct = view.campaign?.pct ?? null;
  return (
    <main className="page">
      <div className="dhead">
        <div>
          <span className="ref">Your referrals</span>
          <h1 style={{ marginTop: 16 }}>Earn with {view.brand}</h1>
          <p className="lead">
            Share your link. When a friend’s first deal completes, you earn{" "}
            {pct ? `${pct}% of our profit` : "a share of our profit"} on it.
          </p>
        </div>
        <span className={`status ${view.campaign ? "ok" : "off"}`}>
          <i />
          {view.campaign ? "Campaign on" : "No campaign"}
        </span>
      </div>
      <div className="grid">
        <div>
          <section className="card">
            <h2>Your link</h2>
            <div className="copyrow" style={{ marginTop: 18 }}>
              <div className="v">
                <small>Your code</small>
                <span className="num">{view.code}</span>
              </div>
              <CopyButton value={view.code} />
            </div>
            <div className="copyrow">
              <div className="v" style={{ overflowWrap: "anywhere" }}>
                <small>Your link</small>
                {view.shareUrl}
              </div>
              <CopyButton value={view.shareUrl} label="Copy link" />
            </div>
            <a
              className="btn vio block"
              style={{ marginTop: 18 }}
              href={whatsappLink(
                null,
                referralShareMessage(view.brand, view.shareUrl),
              )}
              target="_blank"
              rel="noopener noreferrer"
            >
              <Share2 size={18} strokeWidth={2.2} aria-hidden="true" />
              Share on WhatsApp
            </a>
            <p
              className={`note ${view.campaign ? "ok" : "warn"}`}
              style={{ marginTop: 14 }}
            >
              {view.campaign
                ? `Active until ${dayLabel(view.campaign.endsOn)}.`
                : "No active campaign: links still work, rewards resume when the next campaign starts."}
            </p>
          </section>
          <section className="card">
            <h2>Your rewards</h2>
            <div className="kv">
              <div>
                <span>Referred deals</span>
                <span className="num">{view.totals.deals}</span>
              </div>
              <div>
                <span>Pending</span>
                <span className="num">{nairaText(view.totals.pending)}</span>
              </div>
              <div>
                <span>Approved</span>
                <span className="num">{nairaText(view.totals.approved)}</span>
              </div>
              <div>
                <span>Paid</span>
                <span className="num">{nairaText(view.totals.paid)}</span>
              </div>
            </div>
            {view.deals.length > 0 ? (
              <ul className="rlist">
                {view.deals.map((d) => (
                  <li key={d.ref}>
                    {d.reward?.status === "paid" && (
                      <Check size={16} strokeWidth={3} aria-hidden="true" />
                    )}
                    <span className="num">{line(d)}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="d" style={{ marginTop: 14 }}>
                No referred deals yet. Share your link to get started.
              </p>
            )}
            <p className="d" style={{ marginTop: 14 }}>
              We pay rewards to the account you used for your deal. Questions?
              Message us on WhatsApp.
            </p>
            <a
              className="btn ghost block"
              style={{ marginTop: 14 }}
              href={whatsappLink(
                view.contactLine,
                referralQuestionMessage(view.brand, view.code),
              )}
              target="_blank"
              rel="noopener noreferrer"
            >
              <MessageCircle size={18} strokeWidth={2.2} aria-hidden="true" />
              Message us on WhatsApp
            </a>
          </section>
        </div>
        <aside>
          <section className="card">
            <h2>How it works</h2>
            <ol className="tl">
              {[
                ["Share your link", "Send it to friends on WhatsApp."],
                [
                  "Your friend starts a deal",
                  "Your code fills in for them on our deal form.",
                ],
                [
                  "The deal completes",
                  "Your reward shows here as pending, then approved.",
                ],
                ["We pay you", "To the account you used for your deal."],
              ].map(([b, small], i) => (
                <li key={b} className="todo">
                  <span className="dot">{i + 1}</span>
                  <span>
                    <b>{b}</b>
                    <small>{small}</small>
                  </span>
                </li>
              ))}
            </ol>
            <h2 style={{ marginTop: 8 }}>Terms</h2>
            <ul className="terms">
              <li>
                {pct ? `${pct}%` : "A share"} of our profit on the deal, set by
                the campaign running when your friend starts it.
              </li>
              <li>Your friend’s first deal with us only.</li>
              <li>New customers only: they can’t have dealt with us before.</li>
              <li>No self-referral: your own deals never earn a reward.</li>
              <li>Paid after the deal completes, once we’ve checked it.</li>
              <li>
                Only during a campaign
                {view.campaign
                  ? ` (this one runs until ${dayLabel(view.campaign.endsOn)})`
                  : ""}
                .
              </li>
            </ul>
          </section>
        </aside>
      </div>
    </main>
  );
}
