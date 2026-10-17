import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { CryptoForm } from "@/features/crypto-deposits/components/CryptoForm";
import { getCryptoDesk } from "@/features/crypto-deposits/public-queries";
import { getDealDeskContext } from "@/features/deals/public-queries";
import { issueFormToken } from "@/features/deals/security";
import { whatsappLink } from "@/features/public/whatsapp";

// A fresh signed form timestamp per visit; follows Settings at once.
export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Sell crypto · Stereolinkz" };

// deal-crypto.html. Here only while crypto is switched on, a Crypto board
// exists, and at least one coin has an official token and a wallet.
export default async function CryptoFormPage() {
  const ctx = await getDealDeskContext();
  if (!ctx || !ctx.org.servicesEnabled.includes("CRYPTO_SELL")) notFound();
  const desk = await getCryptoDesk(ctx.org.id);
  if (!desk || desk.coins.length === 0) notFound();
  return (
    <CryptoForm
      desk={desk}
      formToken={issueFormToken()}
      otherCoinsLink={whatsappLink(
        ctx.org.contactLine,
        `Hi ${ctx.org.name}, I want to sell other crypto`,
      )}
    />
  );
}
