"use client";

import { Loader2, Upload } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { removeOrgLogo, uploadOrgLogo } from "@/features/settings/actions";
import {
  checkImageBytes,
  LOGO_ERRORS,
  MAX_LOGO_BYTES,
} from "@/lib/image-check";
import { cn } from "@/lib/utils";

const ACCEPT = "image/png,image/svg+xml,image/jpeg";

// settings.html .drop. The logo saves on its own, straight away (not with
// "Save settings"), so the preview is always what new boards will use.
// Each upload is a new file; the old one stays for boards made with it.
export function OrgLogoField({ initialUrl }: { initialUrl: string | null }) {
  const [url, setUrl] = useState(initialUrl);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [pending, startTransition] = useTransition();

  async function upload(file: File) {
    // Fast feedback with the checks the server runs again.
    const check =
      file.size > MAX_LOGO_BYTES
        ? { ok: false as const, error: LOGO_ERRORS.size }
        : checkImageBytes(new Uint8Array(await file.arrayBuffer()));
    if (!check.ok) {
      setError(check.error);
      return;
    }
    setError(null);
    startTransition(async () => {
      const form = new FormData();
      form.set("logo", file);
      const result = await uploadOrgLogo(form);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setUrl(result.data.logoUrl);
      toast.success("Logo uploaded. New boards will use it.");
    });
  }

  function remove() {
    startTransition(async () => {
      const result = await removeOrgLogo();
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setUrl(null);
      toast.success("Logo removed. New boards will use the wordmark.");
    });
  }

  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-[13.5px] font-semibold">Logo</span>
      <label
        htmlFor="org-logo"
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          const dropped = event.dataTransfer.files[0];
          if (dropped && !pending) void upload(dropped);
        }}
        className={cn(
          "flex cursor-pointer items-center gap-3.5 rounded-[12px] border-[1.5px] border-dashed border-border-input bg-bg-subtle p-4 transition-colors hover:border-accent-primary",
          "focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-accent-primary",
          dragging && "border-accent-primary bg-accent-soft",
          error && "border-state-error",
          pending && "pointer-events-none opacity-70",
        )}
      >
        {url ? (
          // eslint-disable-next-line @next/next/no-img-element -- a Blob URL of any size; next/image adds nothing here
          <img
            src={url}
            alt="Current logo"
            className="h-11 max-w-[140px] shrink-0 rounded-md bg-bg-surface object-contain p-1 ring-1 ring-border-default"
          />
        ) : pending ? (
          <Loader2
            aria-hidden="true"
            className="size-[26px] shrink-0 animate-spin text-text-muted"
          />
        ) : (
          <Upload
            aria-hidden="true"
            className="size-[26px] shrink-0 text-text-muted"
            strokeWidth={1.9}
          />
        )}
        <div className="min-w-0">
          <b className="block text-[14px]">
            {pending ? "Uploading…" : url ? "Change logo" : "Upload logo"}
          </b>
          <p id="org-logo-hint" className="text-[13px] text-text-muted">
            {url
              ? "PNG or SVG, at least 512 px wide. New boards use this logo."
              : "PNG or SVG, at least 512 px wide. Until then, boards use the stereolinkz wordmark."}
          </p>
        </div>
        <input
          id="org-logo"
          type="file"
          accept={ACCEPT}
          className="sr-only"
          disabled={pending}
          aria-invalid={error ? true : undefined}
          aria-describedby={
            error ? "org-logo-hint org-logo-error" : "org-logo-hint"
          }
          onChange={(event) => {
            const picked = event.target.files?.[0];
            if (picked) void upload(picked);
            event.target.value = ""; // picking the same file again still fires
          }}
        />
      </label>
      {error && (
        <p
          id="org-logo-error"
          className="text-[13.5px] font-medium text-state-error"
        >
          {error}
        </p>
      )}
      {url && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="self-start"
          onClick={remove}
          disabled={pending}
        >
          Remove logo
        </Button>
      )}
    </div>
  );
}
