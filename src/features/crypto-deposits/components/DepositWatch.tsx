"use client";

import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useId, useState } from "react";

import type { ClaimResult } from "@/features/crypto-deposits/watch";
import { checkMyDeposit } from "@/features/deals/public-actions";

const POLL_MS = 15_000;
const txKey = (ref: string) => `slz-txid:${ref}`;

function savedTx(ref: string): string | undefined {
  try {
    return window.sessionStorage.getItem(txKey(ref)) ?? undefined;
  } catch {
    return undefined;
  }
}

// Checks the deposit every 15 s while the page is open and visible, with
// the pasted TxID if there is one, then re-reads the page.
export function DepositPoller({
  dealRef,
  token,
}: {
  dealRef: string;
  token: string;
}) {
  const router = useRouter();
  useEffect(() => {
    let id: number | undefined;
    const run = async () => {
      await checkMyDeposit({ ref: dealRef, token, txHash: savedTx(dealRef) });
      router.refresh();
    };
    const start = () => {
      if (id === undefined && document.visibilityState === "visible")
        id = window.setInterval(run, POLL_MS);
    };
    const stop = () => {
      if (id !== undefined) window.clearInterval(id);
      id = undefined;
    };
    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        void run();
        start();
      } else stop();
    };
    void run();
    start();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      stop();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [dealRef, token, router]);
  return null;
}

const CLAIM_TEXT: Record<ClaimResult, { tone: "ok" | "warn"; text: string }> = {
  LINKED: { tone: "ok", text: "Found it. We’re checking your deposit now." },
  NOT_FOUND: {
    tone: "warn",
    text: "We haven’t seen that transaction arrive at our address yet. We’ll keep checking.",
  },
  TAKEN: {
    tone: "warn",
    text: "That transaction is linked to another deal. Message us on WhatsApp if it’s yours.",
  },
  HAS_TRANSFER: { tone: "ok", text: "We already have your deposit." },
};

// "Already sent it?" (deal-crypto-deposit.html). The TxID is kept in this
// tab only and sent with each check; the server uses it only to look up a
// transfer already seen at our address.
export function TxIdBox({
  dealRef,
  token,
}: {
  dealRef: string;
  token: string;
}) {
  const id = useId();
  const router = useRouter();
  const [tx, setTx] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{
    tone: "ok" | "warn" | "bad";
    text: string;
  } | null>(null);

  async function check(retry = true) {
    setBusy(true);
    setMsg(null);
    const value = tx.trim();
    const result = await checkMyDeposit({
      ref: dealRef,
      token,
      txHash: value || undefined,
    });
    if (!result.ok) {
      setMsg({ tone: "bad", text: result.error });
      setBusy(false);
      return;
    }
    if (value)
      try {
        window.sessionStorage.setItem(txKey(dealRef), value);
      } catch {
        // private mode: the poll just won't resend it
      }
    if (!result.data.checked && retry) {
      // Checked a moment ago: once more after the 10 s spacing.
      window.setTimeout(() => void check(false), 10_500);
      return;
    }
    setBusy(false);
    if (result.data.claim) setMsg(CLAIM_TEXT[result.data.claim]);
    else if (!value)
      setMsg({ tone: "ok", text: "Checked. We’ll keep watching." });
    router.refresh();
  }

  return (
    <div className="fields">
      <div className="fld">
        <label htmlFor={`${id}-tx`}>Transaction ID</label>
        <input
          className="inp"
          id={`${id}-tx`}
          placeholder="e.g. 9f3c…a71b"
          autoComplete="off"
          spellCheck={false}
          value={tx}
          style={{ fontFamily: "ui-monospace, monospace" }}
          onChange={(e) => setTx(e.target.value)}
        />
      </div>
      <button
        className="btn dark"
        type="button"
        disabled={busy}
        onClick={() => void check()}
      >
        {busy && (
          <Loader2 size={18} className="animate-spin" aria-hidden="true" />
        )}
        Check my deposit
      </button>
      {msg && (
        <p className={`note ${msg.tone}`} role="status">
          {msg.text}
        </p>
      )}
    </div>
  );
}
