import { getPublicLanding } from "@/features/public/queries";

// Static, regenerated when a board is generated or the settings are saved
// (revalidatePath("/") in those actions), and at most an hour old
// otherwise. Saving a rate alone doesn't change this page.
export const revalidate = 3600;

export default async function Home() {
  const landing = await getPublicLanding();
  return (
    <main>
      <h1>{landing.org?.name ?? "Stereolinkz"}</h1>
      <p>
        Forex {landing.forex?.timeLabel ?? "none"} · Crypto{" "}
        {landing.crypto?.timeLabel ?? "none"} · POF{" "}
        {landing.pof?.timeLabel ?? "none"}
      </p>
      <ul>
        {landing.forex?.rows.map((row) => (
          <li key={row.code}>
            {row.code} {row.buy} / {row.sell}
          </li>
        ))}
      </ul>
    </main>
  );
}
