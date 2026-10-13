"use client";

import { Check, Copy } from "lucide-react";
import { useState } from "react";

// Copies a value (or, with `link`, the page's own address plus a path) and
// says "Copied" for a moment.
export function CopyButton({
  value,
  link,
  label = "Copy",
  className = "",
  ariaLabel,
}: {
  value?: string;
  link?: string; // a path, made absolute with the current origin
  label?: string;
  className?: string;
  ariaLabel?: string;
}) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className={className}
      aria-label={ariaLabel}
      onClick={async () => {
        const text = link ? `${window.location.origin}${link}` : (value ?? "");
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          setTimeout(() => setCopied(false), 1400);
        } catch {
          window.prompt("Copy this:", text);
        }
      }}
    >
      {copied ? (
        <Check size={16} strokeWidth={2.4} aria-hidden="true" />
      ) : (
        <Copy size={16} strokeWidth={2.2} aria-hidden="true" />
      )}
      {label && <span>{copied ? "Copied" : label}</span>}
    </button>
  );
}
