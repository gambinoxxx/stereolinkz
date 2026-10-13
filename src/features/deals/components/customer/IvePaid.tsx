"use client";

import { put } from "@vercel/blob/client";
import { CheckCircle2, Loader2, MessageCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import {
  attachDealFile,
  markDealPaid,
  requestDealUpload,
} from "@/features/deals/public-actions";

const TYPES = ["application/pdf", "image/jpeg", "image/png"];

// "I’ve paid": records a customer event (the team then checks the bank
// statement), with an optional receipt uploaded privately first.
export function IvePaid({
  dealRef,
  token,
  paidAt,
  whatsappHref,
}: {
  dealRef: string;
  token: string;
  paidAt: string | null; // already told us, as a label
  whatsappHref: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (paidAt)
    return (
      <div className="note ok" style={{ marginTop: 18 }}>
        <CheckCircle2
          size={18}
          strokeWidth={2.2}
          aria-hidden="true"
          style={{ flexShrink: 0, marginTop: 2 }}
        />
        <span>
          Thanks. You told us you paid ({paidAt}). We’re checking it on our bank
          statement and this page updates when it’s confirmed.
        </span>
      </div>
    );

  async function confirm() {
    setPending(true);
    setError(null);
    if (file) {
      try {
        const ticket = await requestDealUpload({
          ref: dealRef,
          token,
          kind: "RECEIPT",
          contentType: file.type,
          size: file.size,
        });
        if (!ticket.ok) throw new Error(ticket.error);
        await put(ticket.data.pathname, file, {
          access: "private",
          token: ticket.data.clientToken,
          contentType: file.type,
          abortSignal: AbortSignal.timeout(60_000),
        });
        const attached = await attachDealFile({
          ref: dealRef,
          token,
          kind: "RECEIPT",
          pathname: ticket.data.pathname,
          originalName: file.name,
        });
        if (!attached.ok) throw new Error(attached.error);
      } catch (e) {
        setError(
          `${e instanceof Error && e.message ? e.message : "The receipt didn’t upload."} You can send it on WhatsApp instead.`,
        );
      }
    }
    const result = await markDealPaid({ ref: dealRef, token });
    setPending(false);
    if (!result.ok) return setError(result.error);
    router.refresh();
  }

  return (
    <div style={{ marginTop: 18 }}>
      {!open ? (
        <button
          type="button"
          className="btn vio block"
          onClick={() => setOpen(true)}
        >
          I’ve paid
        </button>
      ) : (
        <div className="fields" style={{ marginTop: 0 }}>
          <div className="fld">
            <label htmlFor="receipt">
              Transfer receipt{" "}
              <span style={{ color: "var(--ink3)", fontWeight: 500 }}>
                (optional)
              </span>
            </label>
            <input
              id="receipt"
              type="file"
              accept="application/pdf,image/jpeg,image/png"
              onChange={(e) => {
                const f = e.target.files?.[0] ?? null;
                if (
                  f &&
                  (!TYPES.includes(f.type) || f.size > 10 * 1024 * 1024)
                ) {
                  setError("Upload a PDF, JPG or PNG up to 10 MB.");
                  e.target.value = "";
                  return;
                }
                setError(null);
                setFile(f);
              }}
            />
          </div>
          <button
            type="button"
            className="btn vio block"
            disabled={pending}
            onClick={confirm}
          >
            {pending && (
              <Loader2 size={18} className="animate-spin" aria-hidden="true" />
            )}
            {pending ? "Sending…" : "Confirm I’ve paid"}
          </button>
        </div>
      )}
      {error && (
        <p className="note bad" role="alert" style={{ marginTop: 12 }}>
          {error}
        </p>
      )}
      <a
        className="btn ghost block"
        style={{ marginTop: 10 }}
        href={whatsappHref}
        target="_blank"
        rel="noopener noreferrer"
      >
        <MessageCircle size={18} strokeWidth={2.2} aria-hidden="true" />
        Send my receipt on WhatsApp
      </a>
    </div>
  );
}
