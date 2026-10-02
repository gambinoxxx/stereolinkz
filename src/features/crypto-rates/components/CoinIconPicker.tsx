"use client";

import { Loader2 } from "lucide-react";
import { useTransition } from "react";

import { uploadCoinIcon } from "@/features/crypto-rates/actions";
import {
  checkImageBytes,
  LOGO_ERRORS,
  MAX_LOGO_BYTES,
} from "@/lib/image-check";
import { cn } from "@/lib/utils";

const ACCEPT = "image/png,image/svg+xml,image/jpeg";

// Uploads a coin icon at once (a new Blob path every time; old icons stay)
// and hands back its URL. The bank-logo byte checks run here for fast
// feedback and again on the server.
export function CoinIconPicker({
  id,
  children,
  onUploaded,
  onError,
  className,
}: {
  id: string;
  children: React.ReactNode; // the drop zone's or link's content
  onUploaded: (iconUrl: string) => void;
  onError: (message: string) => void;
  className?: string;
}) {
  const [pending, startTransition] = useTransition();

  async function upload(file: File) {
    const check =
      file.size > MAX_LOGO_BYTES
        ? { ok: false as const, error: LOGO_ERRORS.size }
        : checkImageBytes(new Uint8Array(await file.arrayBuffer()));
    if (!check.ok) {
      onError(check.error);
      return;
    }
    startTransition(async () => {
      const form = new FormData();
      form.set("icon", file);
      const result = await uploadCoinIcon(form);
      if (result.ok) onUploaded(result.data.iconUrl);
      else onError(result.error);
    });
  }

  return (
    <label
      htmlFor={id}
      className={cn(
        "cursor-pointer",
        pending && "pointer-events-none opacity-70",
        className,
      )}
    >
      {pending ? (
        <span className="inline-flex items-center gap-2 text-[13.5px] text-text-secondary">
          <Loader2 aria-hidden="true" className="size-4 animate-spin" />
          Uploading…
        </span>
      ) : (
        children
      )}
      <input
        id={id}
        type="file"
        accept={ACCEPT}
        className="sr-only"
        disabled={pending}
        onChange={(event) => {
          const picked = event.target.files?.[0];
          if (picked) void upload(picked);
          event.target.value = ""; // picking the same file again still fires
        }}
      />
    </label>
  );
}
