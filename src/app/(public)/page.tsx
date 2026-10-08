import type { Metadata } from "next";

import { Landing } from "@/features/public/components/Landing";
import { content } from "@/features/public/content";
import { getPublicLanding } from "@/features/public/queries";

// Static, regenerated when a board is generated or the settings are saved
// (revalidatePath("/") in those actions), and at most an hour old
// otherwise. Saving a rate alone doesn't change this page.
export const revalidate = 3600;

// Share previews show the newest Forex board, as posted to WhatsApp.
export async function generateMetadata(): Promise<Metadata> {
  const { forex } = await getPublicLanding();
  const image = forex?.image
    ? [
        {
          url: forex.image.url,
          width: forex.image.width,
          height: forex.image.height,
          alt: `Today’s forex rates, ${forex.dateLabel}`,
        },
      ]
    : undefined;
  const { title, description } = content.meta;
  return {
    title: { absolute: title },
    description,
    alternates: { canonical: "/" },
    openGraph: {
      type: "website",
      url: "/",
      siteName: content.brand,
      title,
      description,
      images: image,
    },
    twitter: { card: "summary_large_image", title, description, images: image },
  };
}

export default async function Home() {
  return <Landing data={await getPublicLanding()} />;
}
