"use client";

import { Upload } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { BankMark } from "@/components/bank-mark";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type LogoFieldProps = {
  id: string;
  name: string; // for the monogram
  slug: string;
  currentUrl: string | null; // the bank's saved logo
  file: File | null; // a newly picked file
  removed: boolean;
  error?: string;
  onPick: (file: File) => void;
  onClear: () => void;
};

const ACCEPT = "image/png,image/svg+xml,image/jpeg";

// bank-add.html .drop: click or drag a PNG, SVG or JPEG. The preview shows
// the picked file, else the saved logo, else the monogram.
export function LogoField({
  id,
  name,
  slug,
  currentUrl,
  file,
  removed,
  error,
  onPick,
  onClear,
}: LogoFieldProps) {
  const [dragging, setDragging] = useState(false);
  const previewUrl = useMemo(
    () => (file ? URL.createObjectURL(file) : null),
    [file],
  );
  useEffect(
    () => () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    },
    [previewUrl],
  );

  const shownUrl = previewUrl ?? (removed ? null : currentUrl);
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;

  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-[13.5px] font-semibold">Logo</span>
      <label
        htmlFor={id}
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          const dropped = event.dataTransfer.files[0];
          if (dropped) onPick(dropped);
        }}
        className={cn(
          "flex cursor-pointer items-center gap-3.5 rounded-[12px] border-[1.5px] border-dashed border-border-input bg-bg-subtle p-4 transition-colors hover:border-accent-primary",
          "focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-accent-primary",
          dragging && "border-accent-primary bg-accent-soft",
          error && "border-state-error",
        )}
      >
        <BankMark
          name={name.trim() || "?"}
          slug={slug}
          logoUrl={shownUrl}
          size={44}
        />
        <div className="min-w-0">
          <b className="flex items-center gap-1.5 text-[14px]">
            <Upload aria-hidden="true" className="size-4" strokeWidth={1.9} />
            {file ? "Replace logo" : shownUrl ? "Change logo" : "Upload logo"}
          </b>
          {file && (
            <span className="block truncate text-[13px] text-text-secondary">
              {file.name}
            </span>
          )}
          <p id={hintId} className="text-[13px] text-text-muted">
            Square PNG or SVG, at least 256 px. Without one, boards show the
            first letter.
          </p>
        </div>
        <input
          id={id}
          type="file"
          accept={ACCEPT}
          className="sr-only"
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${hintId} ${errorId}` : hintId}
          onChange={(event) => {
            const picked = event.target.files?.[0];
            if (picked) onPick(picked);
            event.target.value = ""; // picking the same file again still fires
          }}
        />
      </label>
      {error && (
        <p id={errorId} className="text-[13.5px] font-medium text-state-error">
          {error}
        </p>
      )}
      {shownUrl && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="self-start"
          onClick={onClear}
        >
          Remove logo
        </Button>
      )}
    </div>
  );
}
