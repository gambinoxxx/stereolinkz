"use client";

import { Check, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useId, useState, useTransition } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { markDealCompleted } from "@/features/deals/actions";
import { Panel } from "@/features/deals/components/admin/parts";
import {
  attachDealReferral,
  newReferralPageLink,
  removeDealReferral,
} from "@/features/referrals/actions";
import { STATUS_LABELS } from "@/features/referrals/labels";
import type { RewardDisplayStatus } from "@/features/referrals/rules";
import { formatRate } from "@/lib/format";

export type DealReferralView = {
  code: string | null;
  campaign: string | null;
  profitNaira: string | null;
  reward: {
    amountNaira: string;
    pct: string;
    status: RewardDisplayStatus;
    note: string | null;
  } | null;
  customerCode: { code: string; linkMadeAt: string | null } | null;
};

const naira = (v: string) => `₦${formatRate(v.replace(/\.0+$/, ""))}`;
const VARIANT = {
  PENDING: "default",
  READY: "gold",
  APPROVED: "brand",
  PAID: "success",
  VOID: "destructive",
} as const;

// "Our profit on this deal" (₦), entered when the deal completes or is
// paid out: required when there's a referral code (the reward is a share
// of it), otherwise optional.
export function ProfitInput({
  value,
  onChange,
  code,
  error,
}: {
  value: string;
  onChange: (v: string) => void;
  code: string | null;
  error?: string;
}) {
  const id = useId();
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>
        Our profit on this deal (₦)
        {!code && (
          <span className="font-normal text-text-muted"> optional</span>
        )}
      </Label>
      <Input
        id={id}
        inputMode="decimal"
        placeholder="e.g. 45000"
        value={value}
        aria-invalid={error ? true : undefined}
        aria-describedby={`${id}-hint`}
        onChange={(e) => onChange(e.target.value)}
      />
      <span id={`${id}-hint`} className="text-[13px] text-text-muted">
        {error ??
          (code
            ? `Needed: referral code ${code} earns a share of it.`
            : "What we made on this deal, after costs. Kept for the records.")}
      </span>
    </div>
  );
}

// Non-crypto deals: "Mark completed", with our profit.
export function CompletePanel({
  dealRef,
  feeNaira,
  code,
}: {
  dealRef: string;
  feeNaira: string | null;
  code: string | null;
}) {
  const router = useRouter();
  const [busy, start] = useTransition();
  const [profit, setProfit] = useState(
    feeNaira && feeNaira !== "0" ? feeNaira.replace(/\.0+$/, "") : "",
  );
  const [error, setError] = useState<string | undefined>();
  return (
    <section id="complete">
      <Panel title="Complete the deal">
        <ProfitInput
          value={profit}
          onChange={setProfit}
          code={code}
          error={error}
        />
        <Button
          className="mt-3.5 w-full"
          disabled={busy || (!!code && !profit.trim())}
          onClick={() =>
            start(async () => {
              const r = await markDealCompleted({ ref: dealRef, profit });
              if (!r.ok) {
                setError(r.fieldErrors?.profit);
                toast.error(r.error);
                return;
              }
              toast.success("Deal completed");
              router.refresh();
            })
          }
        >
          {busy ? (
            <Loader2 className="animate-spin" />
          ) : (
            <Check strokeWidth={2.2} />
          )}
          Mark completed
        </Button>
      </Panel>
    </section>
  );
}

// The deal's referral: the code and campaign (a team member may add one
// while the deal is New, or remove it, each with a reason), our profit and
// the reward; and the customer's own code with a one-time private link.
export function ReferralPanel({
  dealRef,
  status,
  view,
}: {
  dealRef: string;
  status: string;
  view: DealReferralView;
}) {
  const id = useId();
  const router = useRouter();
  const [busy, start] = useTransition();
  const [mode, setMode] = useState<"add" | "remove" | null>(null);
  const [code, setCode] = useState("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | undefined>();
  const [link, setLink] = useState<string | null>(null);
  const done = (message: string) => {
    toast.success(message);
    setMode(null);
    setCode("");
    setReason("");
    setError(undefined);
    router.refresh();
  };
  const canAdd = status === "NEW" && !view.code;

  return (
    <Panel
      title="Referral"
      aside={
        view.code ? (
          <Badge variant="brand">Referred by {view.code}</Badge>
        ) : undefined
      }
    >
      <dl className="grid grid-cols-[110px_1fr] gap-x-4 gap-y-2.5 text-[14.5px]">
        <dt className="text-text-secondary">Code</dt>
        <dd className="font-mono font-semibold">{view.code ?? "None"}</dd>
        {view.campaign && (
          <>
            <dt className="text-text-secondary">Campaign</dt>
            <dd className="font-semibold">{view.campaign}</dd>
          </>
        )}
        {view.profitNaira !== null && (
          <>
            <dt className="text-text-secondary">Our profit</dt>
            <dd className="font-semibold tabular-nums">
              {naira(view.profitNaira)}
            </dd>
          </>
        )}
        {view.reward && (
          <>
            <dt className="text-text-secondary">Reward</dt>
            <dd>
              <b className="tabular-nums">{naira(view.reward.amountNaira)}</b>{" "}
              <span className="text-[13px] text-text-muted">
                ({view.reward.pct}% of our profit)
              </span>{" "}
              <Badge variant={VARIANT[view.reward.status]}>
                {STATUS_LABELS[view.reward.status]}
              </Badge>
              {view.reward.note && (
                <span className="mt-1 block text-[13px] text-text-muted">
                  {view.reward.note}
                </span>
              )}
            </dd>
          </>
        )}
        {view.customerCode && (
          <>
            <dt className="text-text-secondary">Their own code</dt>
            <dd className="font-mono font-semibold">
              {view.customerCode.code}
            </dd>
          </>
        )}
      </dl>

      <div className="mt-3.5 flex flex-wrap gap-2">
        {canAdd && mode !== "add" && (
          <Button size="sm" variant="outline" onClick={() => setMode("add")}>
            Add a code
          </Button>
        )}
        {view.code && mode !== "remove" && (
          <Button size="sm" variant="ghost" onClick={() => setMode("remove")}>
            Remove referral
          </Button>
        )}
        {view.customerCode && (
          <Button
            size="sm"
            variant="outline"
            disabled={busy}
            onClick={() => {
              if (
                view.customerCode?.linkMadeAt &&
                !confirm(
                  "Make a new private link? The one the customer has stops working.",
                )
              )
                return;
              start(async () => {
                const r = await newReferralPageLink(dealRef);
                if (!r.ok) return void toast.error(r.error);
                setLink(r.data.url);
                router.refresh();
              });
            }}
          >
            New private link
          </Button>
        )}
      </div>

      {link && (
        <div className="mt-3 rounded-control border border-accent-primary/30 bg-accent-soft px-3.5 py-3 text-[13.5px]">
          <p className="font-semibold text-accent-primary-hover">
            Send this to the customer on WhatsApp. It’s shown only once.
          </p>
          <code className="mt-1.5 block break-all">{link}</code>
          <Button
            size="sm"
            variant="outline"
            className="mt-2"
            onClick={async () => {
              await navigator.clipboard.writeText(link);
              toast.success("Link copied");
            }}
          >
            Copy link
          </Button>
        </div>
      )}

      {mode && (
        <div className="mt-3.5 grid gap-2.5">
          {mode === "add" && (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor={`${id}-code`}>Code</Label>
              <Input
                id={`${id}-code`}
                placeholder="e.g. SLZ7KQ4M"
                autoCapitalize="characters"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
              />
            </div>
          )}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`${id}-why`}>Reason</Label>
            <Input
              id={`${id}-why`}
              placeholder={
                mode === "add"
                  ? "e.g. Customer gave the code on WhatsApp"
                  : "e.g. Customer was referred by mistake"
              }
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </div>
          {error && <p className="text-[13px] text-state-error">{error}</p>}
          <div className="flex gap-2">
            <Button
              size="sm"
              variant={mode === "remove" ? "destructive" : "default"}
              disabled={
                busy ||
                reason.trim().length < 5 ||
                (mode === "add" && !code.trim())
              }
              onClick={() =>
                start(async () => {
                  const r =
                    mode === "add"
                      ? await attachDealReferral({ ref: dealRef, code, reason })
                      : await removeDealReferral({ ref: dealRef, reason });
                  if (!r.ok) {
                    setError(r.error);
                    return void toast.error(r.error);
                  }
                  done(
                    mode === "add"
                      ? `Code ${code} added`
                      : "Referral removed; any pending reward was voided",
                  );
                })
              }
            >
              {mode === "add" ? "Add code" : "Remove referral"}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setMode(null)}>
              Cancel
            </Button>
          </div>
          {mode === "add" && (
            <p className="text-[13px] text-text-muted">
              The same checks as the website apply: a campaign must be on, the
              customer new, and not the code owner’s own number.
            </p>
          )}
        </div>
      )}
    </Panel>
  );
}
