import type { Metadata } from "next";

import { PageHeader } from "@/components/shell/page-header";
import { checkEthTransferForTeam } from "@/features/crypto-deposits/actions";
import { EthChecker } from "@/features/crypto-deposits/components/EthChecker";
import { WalletBalances } from "@/features/crypto-deposits/components/admin/WalletBalances";
import { NETWORKS } from "@/features/crypto-deposits/tokens";
import { Panel } from "@/features/deals/components/admin/parts";
import { requireMember } from "@/lib/server/auth";
import { db } from "@/lib/server/db";

export const metadata: Metadata = { title: "Wallets · RateBoard" };

// Our watched wallets' live balances and the ETH transfer checker
// (Phase 13b). Read-only: nothing here can move funds.
export default async function WalletsPage() {
  const { organizationId } = await requireMember();
  const [wallets, org] = await Promise.all([
    db.cryptoWallet.findMany({
      where: { organizationId, active: true },
      orderBy: { createdAt: "asc" },
      select: { id: true, ticker: true, network: true, address: true },
    }),
    db.organization.findUniqueOrThrow({
      where: { id: organizationId },
      select: { timezone: true },
    }),
  ]);
  const hasEth = wallets.some((w) => w.network === "ETH");
  return (
    <>
      <PageHeader
        title="Wallets"
        description="Live balances of the receiving addresses the app watches. Read-only: the app never holds keys or sends crypto."
      />
      <WalletBalances
        timeZone={org.timezone}
        wallets={wallets.map((w) => ({
          id: w.id,
          ticker: w.ticker,
          network: w.network,
          networkLabel: NETWORKS[w.network].label,
          address: w.address,
          explorerAddress: NETWORKS[w.network].explorerAddress(w.address),
        }))}
      />
      <div className="mt-6 max-w-[720px]">
        <Panel
          title="Check an ETH transfer"
          aside={
            <span className="text-[13px] text-text-muted">
              ETH deals are arranged on WhatsApp
            </span>
          }
        >
          {hasEth ? (
            <EthChecker check={checkEthTransferForTeam} variant="team" />
          ) : (
            <p className="text-[14px] text-text-secondary">
              Add our ETH receiving address in Settings → Deal desk → Crypto
              wallets to check transfers.
            </p>
          )}
        </Panel>
      </div>
    </>
  );
}
