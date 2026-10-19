import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { CryptoForm } from "@/features/crypto-deposits/components/CryptoForm";
import { getCryptoDesk } from "@/features/crypto-deposits/public-queries";
import { getDealDeskContext } from "@/features/deals/public-queries";
import { whatsappLink } from "@/features/public/whatsapp";

// Cached (ISR): the form fetches its signed timestamp and the live BTC
// price in the browser, so the HTML holds nothing per visitor and no
// price. Refreshed by board generation, Settings and wallet changes
// (revalidatePublicPages); at most an hour old otherwise.
export const revalidate = 3600;
export const metadata: Metadata = { title: "Sell crypto · Stereolinkz" };

// deal-crypto.html. Here only while crypto is switched on, a Crypto board
// exists, and at least one coin has an official token and a wallet.
export default async function CryptoFormPage() {
  const ctx = await getDealDeskContext();
  if (!ctx || !ctx.org.servicesEnabled.includes("CRYPTO_SELL")) notFound();
  const desk = await getCryptoDesk(ctx.org.id, { livePrices: false });
  if (!desk || desk.coins.length === 0) notFound();
  return (
    <CryptoForm
      desk={desk}
      referralOpen={ctx.org.referralServices.includes("CRYPTO_SELL")}
      otherCoinsLink={whatsappLink(
        ctx.org.contactLine,
        `Hi ${ctx.org.name}, I want to sell other crypto`,
      )}
    />
  );
}
