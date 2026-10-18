import { MessageCircle } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { EthChecker } from "@/features/crypto-deposits/components/EthChecker";
import { getDealDeskContext } from "@/features/deals/public-queries";
import { checkEthTransfer } from "@/features/deals/public-actions";
import { whatsappLink } from "@/features/public/whatsapp";
import { db } from "@/lib/server/db";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Check your ETH transfer · Stereolinkz",
};

// Customers who sell ETH on WhatsApp can follow their transfer here
// (Phase 13b). Read-only and rate-limited; it never shows our balance or
// anyone else's transfers.
export default async function CheckEthPage() {
  const ctx = await getDealDeskContext();
  if (!ctx || !ctx.org.servicesEnabled.includes("CRYPTO_SELL")) notFound();
  const eth = await db.cryptoWallet.findFirst({
    where: { organizationId: ctx.org.id, network: "ETH", active: true },
    select: { id: true },
  });
  if (!eth) notFound();
  return (
    <main className="page">
      <Link className="crumb" href="/deal/new">
        ← Start a deal
      </Link>
      <h1>Check your ETH transfer</h1>
      <p className="lead">
        Sold ETH with our team on WhatsApp? Paste the transaction hash from your
        wallet or exchange to see when it reaches us and how many confirmations
        it has.
      </p>
      <div className="grid">
        <div>
          <section className="card">
            <EthChecker check={checkEthTransfer} variant="customer" />
          </section>
        </div>
        <aside>
          <section className="card">
            <h2>Next</h2>
            <p className="d">
              Once it’s final, our team confirms your amount on WhatsApp and
              pays you out.
            </p>
            <a
              className="btn vio block"
              style={{ marginTop: 16 }}
              href={whatsappLink(
                ctx.org.contactLine,
                `Hi ${ctx.org.name}, about my ETH transfer`,
              )}
              target="_blank"
              rel="noopener noreferrer"
            >
              <MessageCircle size={20} strokeWidth={2.2} aria-hidden="true" />
              Continue on WhatsApp
            </a>
          </section>
        </aside>
      </div>
    </main>
  );
}
