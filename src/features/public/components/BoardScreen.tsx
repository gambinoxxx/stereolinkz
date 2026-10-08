import Image from "next/image";

import { Wordmark } from "@/features/public/components/Wordmark";

type BoardImage = { url: string; width: number; height: number } | null;

// A phone screen: the board's newest PNG, exactly as posted to WhatsApp, or
// the wordmark on the brand gradient when there is no board yet.
export function BoardScreen({
  image,
  alt,
  label,
  preload = false,
}: {
  image: BoardImage;
  alt: string;
  label: string; // shown on the fallback: "Forex rates"
  preload?: boolean;
}) {
  if (!image)
    return (
      <div className="screen-fallback">
        <Wordmark scale={1.3} />
        <span>{label}</span>
      </div>
    );
  return (
    <Image
      className="board-img"
      src={image.url}
      alt={alt}
      width={image.width}
      height={image.height}
      sizes="(max-width: 860px) 244px, 296px"
      preload={preload}
      fetchPriority={preload ? "high" : undefined}
      loading={preload ? "eager" : "lazy"}
    />
  );
}
