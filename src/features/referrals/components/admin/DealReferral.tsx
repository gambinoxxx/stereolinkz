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
import { setDealReferralCode } from "@/features/referrals/actions";
import { STATUS_LABELS } from "@/features/referrals/labels";
import type { RewardDisplayStatus } from "@/features/referrals/rules";
import { formatRate } from "@/lib/format";

export type DealReferralView = {
  code: string | null;
  profitNaira: string | null;
  reward: {
    amountNaira: string;
    pct: string;
    status: RewardDisplayStatus;
    note: string | null;
  } | null;
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

// The deal's referral: its code (changeable while NEW or AWAITING_DEPOSIT),
// our profit and the reward, once completed.
export function ReferralPanel({
  dealRef,
  editable,
  view,
}: {
  dealRef: string;
  editable: boolean;
  view: DealReferralView;
}) {
  const id = useId();
  const router = useRouter();
  const [busy, start] = useTransition();
  const [code, setCode] = useState(view.code ?? "");
  const [error, setError] = useState<string | undefined>();
  const save = (next: string) =>
    start(async () => {
      const r = await setDealReferralCode({ ref: dealRef, code: next });
      if (!r.ok) {
        setError(r.error);
        toast.error(r.error);
        return;
      }
      setError(undefined);
      toast.success(
        r.data.code ? `Code ${r.data.code} applied` : "Code removed",
      );
      router.refresh();
    });

  if (!editable && !view.code && !view.profitNaira) return null;
  return (
    <Panel title="Referral">
      <dl className="grid grid-cols-[110px_1fr] gap-x-4 gap-y-2.5 text-[14.5px]">
        <dt className="text-text-secondary">Code</dt>
        <dd className="font-mono font-semibold">{view.code ?? "None"}</dd>
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
                ({view.reward.pct}%)
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
      </dl>
      {editable && (
        <div className="mt-3.5 flex flex-wrap items-end gap-2.5">
          <div className="flex min-w-[160px] flex-1 flex-col gap-1.5">
            <Label htmlFor={`${id}-code`}>
              {view.code ? "Change the code" : "Add a code"}
            </Label>
            <Input
              id={`${id}-code`}
              placeholder="e.g. LYDIA"
              autoCapitalize="characters"
              value={code}
              aria-invalid={error ? true : undefined}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
            />
          </div>
          <Button
            variant="outline"
            disabled={busy || !code.trim() || code === view.code}
            onClick={() => save(code)}
          >
            Apply
          </Button>
          {view.code && (
            <Button variant="ghost" disabled={busy} onClick={() => save("")}>
              Remove
            </Button>
          )}
          {error && (
            <p className="w-full text-[13px] text-state-error">{error}</p>
          )}
          <p className="w-full text-[13px] text-text-muted">
            Locked once the rate is agreed (or a deposit arrives).
          </p>
        </div>
      )}
    </Panel>
  );
}
