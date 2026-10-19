"use client";

import {
  ArrowLeft,
  ExternalLink,
  FileText,
  Loader2,
  MessageCircle,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { type ReactNode, useId, useMemo, useState, useTransition } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import type { TeamCrypto } from "@/features/crypto-deposits/admin-queries";
import {
  CryptoAgreePanel,
  CryptoCheckPanel,
  CryptoDealPanel,
  CryptoPayoutPanel,
  CryptoReviewPanel,
} from "@/features/crypto-deposits/components/admin/CryptoPanels";
import { NETWORKS } from "@/features/crypto-deposits/tokens";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  addDealNote,
  agreeDealRate,
  cancelDeal,
  markDealSent,
  markPaymentReceived,
  setDealOwner,
  sharePaymentDetails,
} from "@/features/deals/actions";
import {
  DealChip,
  KV,
  OwnerAvatar,
  Panel,
  ServiceIcon,
} from "@/features/deals/components/admin/parts";
import {
  INTL_PURPOSE_LABELS,
  POF_PURPOSE_LABELS,
  RECEIVE_METHOD_LABELS,
  SCHOOL_PURPOSE_LABELS,
} from "@/features/deals/content";
import {
  amountToPayText,
  dealAmountText,
  nairaText,
  rateText,
} from "@/features/deals/format";
import { teamMessages } from "@/features/deals/messages";
import {
  CompletePanel,
  type DealReferralView,
  ReferralPanel,
} from "@/features/referrals/components/admin/DealReferral";
import { dealSteps, TEAM_LABELS } from "@/features/deals/progress";
import type { Member, TeamDeal } from "@/features/deals/queries";
import { agreedNairaFor } from "@/features/deals/quote";
import { SERVICE_LABELS } from "@/features/deals/services";
import {
  accountNameDiffers,
  formatAccountNumber,
} from "@/features/deals/settings-schema";
import { Select } from "@/features/settings/components/settings-parts";
import { whatsappLink } from "@/features/public/whatsapp";
import { isDecimalString } from "@/lib/decimal";
import type { ActionResult } from "@/lib/server/action";
import { cn } from "@/lib/utils";

// Time labels in the org's zone, worked out on the server (no hydration drift).
type Labels = { when: Record<string, string>; time: Record<string, string> };

const lbl = (map: Record<string, string>, iso: string) => map[iso] ?? "";

// deal-detail.html: work one deal from request to completed.
export function DealDetail({
  deal,
  members,
  orgName,
  labels,
  crypto = null,
  currentCryptoRate = null,
  referral,
}: {
  deal: TeamDeal;
  members: Member[];
  orgName: string;
  labels: Labels;
  slaMinutes?: number;
  crypto?: TeamCrypto | null; // CRYPTO_SELL deals (deal-detail-crypto.html)
  currentCryptoRate?: string | null; // latest board, for re-quotes
  referral: DealReferralView; // Phase 13c
}) {
  const id = useId();
  const router = useRouter();
  const [busy, startTransition] = useTransition();
  const [dialog, setDialog] = useState<null | "cancel" | "received" | "sent">(
    null,
  );
  const [cancelReason, setCancelReason] = useState("");
  const [sentRef, setSentRef] = useState("");
  const [rate, setRate] = useState(deal.agreedRate ?? deal.quotedRate ?? "");
  const [fee, setFee] = useState(deal.feeNaira ?? "0");
  const [reason, setReason] = useState("");
  const [accountId, setAccountId] = useState(
    deal.paymentAccountId ?? deal.accounts.find((a) => a.active)?.id ?? "",
  );
  const [note, setNote] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});

  const byId = useMemo(() => new Map(members.map((m) => [m.id, m])), [members]);
  const owner = deal.ownerMembershipId
    ? (byId.get(deal.ownerMembershipId) ?? null)
    : null;
  const det = deal.details;
  const months = det?.service === "POF" ? det.months : 1;
  const cleanRate = rate.replace(/,/g, "").trim();
  const cleanFee = fee.replace(/,/g, "").trim() || "0";
  const preview =
    isDecimalString(cleanRate) &&
    Number(cleanRate) > 0 &&
    isDecimalString(cleanFee)
      ? agreedNairaFor(deal.service, deal.amount, cleanRate, cleanFee, months)
      : null;
  const shared = deal.status === "AWAITING_PAYMENT";
  const rateLocked = !["NEW", "AGREED", "AWAITING_PAYMENT"].includes(
    deal.status,
  );
  const chosen =
    deal.accounts.find((a) => a.id === deal.paymentAccountId) ?? null;
  const toPay = amountToPayText(
    deal.service,
    deal.amount,
    deal.currency,
    deal.agreedNaira,
  );
  const amount = dealAmountText(deal.service, deal.amount, deal.currency);

  function run<T>(
    action: () => Promise<ActionResult<T>>,
    success: string,
    after?: () => void,
  ) {
    startTransition(async () => {
      const result = await action();
      if (!result.ok) {
        setErrors(result.fieldErrors ?? {});
        toast.error(result.error);
        return;
      }
      setErrors({});
      setDialog(null);
      after?.();
      toast.success(success);
      router.refresh();
    });
  }

  const agree = () =>
    run(
      () =>
        agreeDealRate({
          ref: deal.ref,
          agreedRate: rate,
          fee,
          reason: reason || undefined,
        }),
      deal.status === "NEW" ? "Rate agreed" : "Rate saved",
      () => setReason(""),
    );

  // The primary action follows the status (deal-detail.html header).
  const primary: {
    label: string;
    onClick: () => void;
    disabled?: boolean;
  } | null =
    deal.status === "NEW"
      ? { label: "Mark agreed", onClick: agree, disabled: !preview }
      : deal.status === "AGREED"
        ? {
            label: "Share payment details",
            onClick: () =>
              run(
                () => sharePaymentDetails(deal.ref, accountId),
                "Payment details shared",
              ),
            disabled: !accountId,
          }
        : deal.status === "AWAITING_PAYMENT"
          ? {
              label: "Mark payment received",
              onClick: () => setDialog("received"),
            }
          : deal.status === "PAYMENT_RECEIVED"
            ? { label: "Mark sent", onClick: () => setDialog("sent") }
            : deal.status === "PROCESSING"
              ? {
                  // With our profit (Phase 13c): the panel below.
                  label: "Mark completed",
                  onClick: () => {
                    const panel = document.getElementById("complete");
                    panel?.scrollIntoView({
                      behavior: "smooth",
                      block: "start",
                    });
                    panel
                      ?.querySelector("input")
                      ?.focus({ preventScroll: true });
                  },
                }
              : null;

  const cryptoPrimary =
    crypto && deal.status === "DEPOSIT_COMPLETE"
      ? {
          label: "Mark paid out",
          onClick: () => {
            const panel = document.getElementById("payout");
            panel?.scrollIntoView({ behavior: "smooth", block: "start" });
            panel?.querySelector("input")?.focus({ preventScroll: true });
          },
        }
      : null;
  const cryptoSteps = crypto
    ? (() => {
        const order = [
          ["Deal created", true],
          [
            "Deposit seen",
            !!crypto.depositSeenAt || !!crypto.depositCompletedAt,
          ],
          ["Deposit complete", !!crypto.depositCompletedAt],
          ["Pay out", deal.status === "PAID_OUT"],
          ["Paid out", deal.status === "PAID_OUT"],
        ] as const;
        const nowIndex = order.findIndex(([, done]) => !done);
        return order.map(([label, done], i) => ({
          status: label,
          label,
          state: (done
            ? "done"
            : i === nowIndex && !["CANCELLED", "EXPIRED"].includes(deal.status)
              ? "now"
              : "todo") as "done" | "now" | "todo",
        }));
      })()
    : null;

  const steps =
    cryptoSteps ??
    dealSteps(
      deal.service,
      deal.status,
      new Date(deal.createdAt),
      deal.events
        .filter((e) => e.type === "STATUS_CHANGED")
        .map((e) => ({ toStatus: e.toStatus, at: new Date(e.createdAt) }))
        .reverse(),
      TEAM_LABELS,
    );

  const requestRows: [string, ReactNode][] = [];
  if (det?.service === "SCHOOL_FEES") {
    requestRows.push(
      ["School", `${det.schoolName}, ${det.country}`],
      [
        "Student",
        `${det.studentName}${det.studentId ? ` · ${det.studentId}` : " · ID not given"}`,
      ],
      ["For", SCHOOL_PURPOSE_LABELS[det.purpose]],
    );
  } else if (det?.service === "INTL_PAYMENT") {
    requestRows.push(
      ["Paying", INTL_PURPOSE_LABELS[det.purpose]],
      ["Country", det.country],
      ["They receive by", RECEIVE_METHOD_LABELS[det.receiveMethod]],
    );
  } else if (det?.service === "POF") {
    requestRows.push(
      ["Bank", det.bankName ?? "—"],
      ["Months", String(det.months)],
      ["Needed by", det.neededBy],
      ["Purpose", POF_PURPOSE_LABELS[det.purpose]],
      ["Destination", det.destinationCountry],
    );
  } else if (deal.service === "FOREX_SELL") {
    requestRows.push(["They send", "Transfer from their banking app"]);
  }
  requestRows.push([
    "Amount",
    <span key="a" className="tabular-nums">
      {amount}
    </span>,
  ]);
  if (det?.service === "INTL_PAYMENT")
    requestRows.push([
      "Customer note",
      det.note ?? <span className="text-text-muted">None</span>,
    ]);

  const messages = teamMessages({
    ref: deal.ref,
    service: deal.service,
    amount: deal.amount,
    currency: deal.currency,
    status: deal.status,
    customerName: deal.customerName,
    agreedRate: deal.agreedRate,
    agreedNaira: deal.agreedNaira ?? (crypto ? deal.quotedNaira : null),
    account: chosen
      ? {
          bank: chosen.bank,
          accountNumber: formatAccountNumber(chosen.accountNumber),
          accountName: chosen.accountName,
        }
      : null,
    trackUrl: null,
  });

  const actor = (e: TeamDeal["events"][number]) =>
    e.actorType === "MEMBER"
      ? e.actorMembershipId
        ? (byId.get(e.actorMembershipId)?.name ?? "A team member")
        : "A team member"
      : e.actorType === "CUSTOMER"
        ? "Customer"
        : "System";

  return (
    <>
      <Link
        href="/admin/deals"
        className="mb-3 inline-flex items-center gap-1.5 text-[14px] font-semibold text-text-secondary"
      >
        <ArrowLeft aria-hidden="true" className="size-4" strokeWidth={1.9} />
        All deals
      </Link>
      <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="flex flex-wrap items-center gap-3 text-[25px] font-[750] tracking-[-0.6px] shell:text-[28px]">
            <ServiceIcon service={deal.service} />
            {deal.ref} · {SERVICE_LABELS[deal.service]}
            <DealChip
              service={deal.service}
              status={deal.status}
              label={
                deal.status === "DEPOSIT_COMPLETE" ? "Payout due" : undefined
              }
            />
          </h1>
          <p className="mt-1 text-text-secondary">
            {deal.customerName}
            {det?.service === "SCHOOL_FEES" ? ` · ${det.schoolName}` : ""}
            {crypto
              ? ` · ${amount} on ${NETWORKS[crypto.network].label}`
              : ""}{" "}
            · {crypto ? "started" : "requested"}{" "}
            {lbl(labels.when, deal.createdAt)}{" "}
            {deal.events.at(-1)?.actorType === "MEMBER"
              ? "by the team"
              : "from the website"}
          </p>
          {deal.status === "CANCELLED" && deal.cancelReason && (
            <p className="mt-1 text-[14px] text-state-error">
              Cancelled: {deal.cancelReason}
            </p>
          )}
        </div>
        <div className="flex w-full flex-wrap gap-2.5 *:flex-1 shell:w-auto shell:*:flex-none">
          {![
            "COMPLETED",
            "CANCELLED",
            "PAYMENT_RECEIVED",
            "PROCESSING",
            "DEPOSIT_SEEN",
            "DEPOSIT_COMPLETE",
            "PAID_OUT",
          ].includes(deal.status) && (
            <Button
              variant="outline"
              onClick={() => setDialog("cancel")}
              disabled={busy}
            >
              Cancel deal
            </Button>
          )}
          {deal.status === "PAYMENT_RECEIVED" && (
            <Button
              variant="outline"
              disabled={busy}
              onClick={() => {
                const panel = document.getElementById("complete");
                panel?.scrollIntoView({ behavior: "smooth", block: "start" });
                panel?.querySelector("input")?.focus({ preventScroll: true });
              }}
            >
              Mark completed
            </Button>
          )}
          {(cryptoPrimary ?? (crypto ? null : primary)) && (
            <Button
              onClick={(cryptoPrimary ?? primary)!.onClick}
              disabled={busy || (!cryptoPrimary && primary?.disabled)}
            >
              {busy && <Loader2 aria-hidden="true" className="animate-spin" />}
              {(cryptoPrimary ?? primary)!.label}
            </Button>
          )}
        </div>
      </div>

      <ol
        className="mb-[22px] flex overflow-x-auto rounded-panel border border-border-default bg-bg-surface p-1.5"
        aria-label="Deal progress"
      >
        {steps.map((s, i) => (
          <li
            key={s.status}
            aria-current={s.state === "now" ? "step" : undefined}
            className={cn(
              "flex min-w-[120px] flex-1 items-center gap-2 rounded-control px-3 py-2.5 text-[13.5px] font-[650] whitespace-nowrap text-text-muted",
              s.state === "done" && "text-text-primary",
              s.state === "now" && "bg-accent-soft text-accent-primary",
            )}
          >
            <span
              className={cn(
                "grid size-[22px] shrink-0 place-items-center rounded-full bg-border-subtle text-[11.5px] font-extrabold",
                s.state === "done" && "bg-state-success text-white",
                s.state === "now" && "bg-accent-primary text-white",
              )}
            >
              {s.state === "done" ? "✓" : i + 1}
            </span>
            {s.label}
          </li>
        ))}
      </ol>

      <div className="grid items-start gap-[22px] wide:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)]">
        {crypto ? (
          <div className="flex flex-col gap-[18px]">
            <CryptoCheckPanel deal={deal} crypto={crypto} labels={labels} />
            {(deal.status === "DEPOSIT_COMPLETE" ||
              deal.status === "PAID_OUT") && (
              <CryptoPayoutPanel
                deal={deal}
                crypto={crypto}
                labels={labels}
                referralCode={referral.code}
              />
            )}
            {deal.status === "RATE_TO_AGREE" && (
              <CryptoAgreePanel
                deal={deal}
                crypto={crypto}
                boardRate={currentCryptoRate}
              />
            )}
            {(deal.status === "FLAGGED" || deal.status === "EXPIRED") && (
              <CryptoReviewPanel
                deal={deal}
                crypto={crypto}
                currentRate={currentCryptoRate}
              />
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-[18px]">
            {(deal.status === "PROCESSING" ||
              deal.status === "PAYMENT_RECEIVED") && (
              <CompletePanel
                dealRef={deal.ref}
                feeNaira={deal.feeNaira}
                code={referral.code}
              />
            )}
            <Panel
              title={
                det?.service === "POF"
                  ? "Proof of funds request"
                  : "Payment request"
              }
            >
              <KV rows={requestRows} />
              {deal.files.length > 0 && (
                <div className="mt-4 grid gap-2">
                  {deal.files.map((f) => (
                    <div
                      key={f.id}
                      className="flex items-center gap-2.5 rounded-control border border-border-default px-3 py-2.5 text-[14px]"
                    >
                      <FileText
                        aria-hidden="true"
                        className="size-4 shrink-0 text-text-muted"
                        strokeWidth={1.9}
                      />
                      <div className="min-w-0">
                        <b className="block truncate font-semibold">
                          {f.originalName}
                        </b>
                        <span className="text-[12.5px] text-text-muted">
                          {f.kind === "RECEIPT" ? "Receipt" : "Invoice"} ·{" "}
                          {Math.max(1, Math.round(f.byteSize / 1024))} KB ·
                          private ·{" "}
                          {f.uploadedBy === "CUSTOMER"
                            ? "from the customer"
                            : "by the team"}{" "}
                          {lbl(labels.time, f.createdAt)}
                        </span>
                      </div>
                      <Button
                        asChild
                        variant="outline"
                        size="sm"
                        className="ml-auto"
                      >
                        <a
                          href={`/api/deals/${deal.ref}/files/${f.id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <ExternalLink strokeWidth={1.9} />
                          Open
                        </a>
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </Panel>

            <Panel
              title="Rate and amount"
              aside={
                <span className="text-[13px] text-text-muted">
                  Both are kept on the deal
                </span>
              }
            >
              <div className="grid gap-3 sheet:grid-cols-2">
                <div className="rounded-[12px] border border-border-default p-3.5">
                  <div className="text-[12.5px] font-[650] tracking-[.04em] text-text-muted uppercase">
                    Website estimate
                  </div>
                  <div className="mt-0.5 text-[22px] font-[750] tracking-[-0.4px] tabular-nums">
                    {deal.quotedNaira
                      ? nairaText(deal.quotedNaira)
                      : "Not quoted"}
                  </div>
                  <div className="text-[13px] text-text-secondary">
                    {deal.quotedRate
                      ? `${rateText(deal.service, deal.quotedRate, deal.currency)}${deal.quotedBoardTime ? ` · board ${deal.quotedBoardTime}` : ""}`
                      : "No rate on the latest board"}
                  </div>
                </div>
                <div
                  className={cn(
                    "rounded-[12px] border p-3.5",
                    deal.agreedRate
                      ? "border-accent-gold bg-accent-gold-soft/40"
                      : "border-border-default",
                  )}
                >
                  <div className="text-[12.5px] font-[650] tracking-[.04em] text-text-muted uppercase">
                    Agreed on WhatsApp
                  </div>
                  <div className="mt-0.5 text-[22px] font-[750] tracking-[-0.4px] tabular-nums">
                    {deal.agreedNaira ? nairaText(deal.agreedNaira) : "Not yet"}
                  </div>
                  <div className="text-[13px] text-text-secondary">
                    {deal.agreedRate
                      ? `${rateText(deal.service, deal.agreedRate, deal.currency)}${deal.agreedById ? ` · by ${byId.get(deal.agreedById)?.name ?? "a team member"}` : ""}${deal.agreedAt ? `, ${lbl(labels.time, deal.agreedAt)}` : ""}`
                      : "Record the rate you agree in the chat"}
                  </div>
                </div>
              </div>
              {!rateLocked && (
                <>
                  <div className="mt-3.5 grid grid-cols-2 gap-3.5">
                    <div className="flex flex-col gap-1.5">
                      <Label htmlFor={`${id}-rate`}>
                        {deal.service === "POF"
                          ? "Agreed rate (% per month)"
                          : "Agreed rate"}
                      </Label>
                      <Input
                        id={`${id}-rate`}
                        inputMode="decimal"
                        value={rate}
                        onChange={(e) => setRate(e.target.value)}
                        aria-invalid={errors.agreedRate ? true : undefined}
                      />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <Label htmlFor={`${id}-fee`}>Fee (₦)</Label>
                      <Input
                        id={`${id}-fee`}
                        inputMode="decimal"
                        value={fee}
                        onChange={(e) => setFee(e.target.value)}
                        aria-invalid={errors.fee ? true : undefined}
                      />
                    </div>
                  </div>
                  {shared && (
                    <div className="mt-3 flex flex-col gap-1.5">
                      <Label htmlFor={`${id}-reason`}>
                        Reason for the change
                      </Label>
                      <Input
                        id={`${id}-reason`}
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                        placeholder="Payment details were already shared"
                        aria-invalid={errors.reason ? true : undefined}
                      />
                    </div>
                  )}
                  <p className="mt-2 text-[13px] text-text-muted">
                    {preview
                      ? `${deal.service === "FOREX_SELL" ? "Customer receives" : "Customer pays"} ${nairaText(preview)}. `
                      : ""}
                    Changing the rate after payment details are shared asks for
                    a reason and is logged.
                  </p>
                  {deal.status !== "NEW" && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-3"
                      disabled={busy || !preview}
                      onClick={agree}
                    >
                      Save rate
                    </Button>
                  )}
                </>
              )}
            </Panel>

            <Panel
              title={
                deal.service === "FOREX_SELL"
                  ? "Our account the customer sends to"
                  : "Payment details shown to the customer"
              }
              aside={
                <Link
                  href="/admin/settings/deal-desk"
                  className="text-[13.5px] font-semibold text-accent-primary"
                >
                  Manage accounts
                </Link>
              }
            >
              {deal.accounts.length === 0 ? (
                <p className="text-[14px] text-text-secondary">
                  No active account is set up for{" "}
                  {SERVICE_LABELS[deal.service].toLowerCase()}. Add one in
                  Settings → Deal desk.
                </p>
              ) : (
                <div
                  className="grid gap-2"
                  role="radiogroup"
                  aria-label="Account to show"
                >
                  {deal.accounts.map((a) => {
                    const differs = accountNameDiffers(a.accountName, orgName);
                    const isChosen = deal.paymentAccountId === a.id;
                    const locked = deal.status !== "AGREED";
                    return (
                      <label
                        key={a.id}
                        className={cn(
                          "flex flex-wrap items-center gap-x-3 gap-y-2 rounded-[12px] border border-border-default px-3.5 py-3",
                          (locked ? isChosen : accountId === a.id) &&
                            "border-accent-primary bg-accent-soft/40",
                          locked ? "cursor-default" : "cursor-pointer",
                        )}
                      >
                        <input
                          type="radio"
                          name={`${id}-acct`}
                          className="size-[18px] accent-accent-primary"
                          checked={locked ? isChosen : accountId === a.id}
                          disabled={locked}
                          onChange={() => setAccountId(a.id)}
                        />
                        <div className="min-w-[160px] flex-1">
                          <b className="block text-[14.5px] tabular-nums">
                            {a.bank} · {formatAccountNumber(a.accountNumber)}
                          </b>
                          <span className="text-[13px] text-text-secondary">
                            {a.accountName} · {a.currency}
                          </span>
                        </div>
                        {isChosen && shared ? (
                          <Badge variant="success">
                            Shown since {lbl(labels.time, deal.statusChangedAt)}
                          </Badge>
                        ) : differs ? (
                          <Badge variant="gold">
                            Name differs: tell the customer
                          </Badge>
                        ) : null}
                      </label>
                    );
                  })}
                </div>
              )}
              <p className="mt-2.5 text-[13px] text-text-muted">
                Only active accounts marked for{" "}
                {SERVICE_LABELS[deal.service].toLowerCase()} appear. The
                customer sees the chosen account on their deal page from
                “Awaiting payment”, with {deal.ref} as the narration.
              </p>
            </Panel>
          </div>
        )}

        <div className="flex flex-col gap-[18px]">
          {crypto && (
            <CryptoDealPanel deal={deal} crypto={crypto} labels={labels} />
          )}
          <ReferralPanel
            dealRef={deal.ref}
            editable={
              deal.status === "NEW" || deal.status === "AWAITING_DEPOSIT"
            }
            view={referral}
          />
          <Panel title="Customer">
            <KV
              rows={[
                ["Name", deal.customerName],
                ["WhatsApp", deal.customerWhatsapp],
                [
                  "Email",
                  deal.customerEmail ?? (
                    <span className="text-text-muted">Not given</span>
                  ),
                ],
                ...(deal.service === "FOREX_SELL" && deal.payoutAccountNumber
                  ? ([
                      [
                        "Pay naira to",
                        `${deal.payoutBank} · ${deal.payoutAccountNumber} (${deal.payoutAccountName})`,
                      ],
                    ] as [string, ReactNode][])
                  : []),
                [
                  "Past deals",
                  deal.pastDeals.length ? (
                    <span className="flex flex-wrap gap-x-2" key="p">
                      {deal.pastDeals.map((p) => (
                        <Link
                          key={p.ref}
                          href={`/admin/deals/${p.ref}`}
                          className="text-accent-primary"
                        >
                          {p.ref}
                        </Link>
                      ))}
                    </span>
                  ) : (
                    "None"
                  ),
                ],
              ]}
            />
            <div className="mt-3.5 flex flex-col gap-1.5">
              <Label htmlFor={`${id}-owner`}>Owner</Label>
              <div className="flex items-center gap-2.5">
                <OwnerAvatar owner={owner} />
                <div className="flex-1">
                  <Select
                    id={`${id}-owner`}
                    value={deal.ownerMembershipId ?? ""}
                    disabled={busy}
                    onChange={(e) =>
                      run(
                        () => setDealOwner(deal.ref, e.target.value || null),
                        "Owner saved",
                      )
                    }
                  >
                    <option value="">Unassigned</option>
                    {members.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name}
                      </option>
                    ))}
                  </Select>
                </div>
              </div>
            </div>
          </Panel>

          <Panel title="WhatsApp">
            <div className="grid grid-cols-[minmax(0,1fr)] gap-2">
              {messages.map((m) => (
                <a
                  key={m.label}
                  href={whatsappLink(deal.customerWhatsapp, m.text)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex min-w-0 items-center gap-2.5 overflow-hidden rounded-control border border-border-default px-3 py-2.5 text-[14px] font-semibold hover:border-state-success hover:bg-state-success-soft/40"
                >
                  <MessageCircle
                    aria-hidden="true"
                    className="size-[18px] shrink-0 text-state-success"
                    strokeWidth={1.9}
                  />
                  <div className="min-w-0 flex-1">
                    {m.label}
                    <span className="block truncate text-[12.5px] font-medium text-text-muted">
                      “{m.text}”
                    </span>
                  </div>
                </a>
              ))}
              <a
                href={whatsappLink(deal.customerWhatsapp, "")}
                target="_blank"
                rel="noopener noreferrer"
                className="flex min-w-0 items-center gap-2.5 overflow-hidden rounded-control border border-border-default px-3 py-2.5 text-[14px] font-semibold hover:border-state-success hover:bg-state-success-soft/40"
              >
                <MessageCircle
                  aria-hidden="true"
                  className="size-[18px] shrink-0 text-state-success"
                  strokeWidth={1.9}
                />
                <div>
                  Open chat
                  <span className="block text-[12.5px] font-medium text-text-muted">
                    Opens WhatsApp with the customer’s number
                  </span>
                </div>
              </a>
            </div>
          </Panel>

          <Panel title="Activity">
            <ol className="relative">
              {deal.events.map((e, i) => {
                const m = e.actorMembershipId
                  ? byId.get(e.actorMembershipId)
                  : null;
                return (
                  <li
                    key={e.id}
                    className="relative grid grid-cols-[30px_1fr] gap-3 pb-4"
                  >
                    {i < deal.events.length - 1 && (
                      <span
                        aria-hidden="true"
                        className="absolute top-[30px] bottom-0 left-[14px] w-0.5 bg-border-subtle"
                      />
                    )}
                    {e.actorType === "MEMBER" && m ? (
                      <OwnerAvatar owner={m} />
                    ) : (
                      <span
                        aria-hidden="true"
                        className="grid size-[30px] place-items-center rounded-full bg-border-subtle text-[11.5px] text-text-secondary"
                      >
                        ✦
                      </span>
                    )}
                    <div className="min-w-0">
                      <b className="text-[14px] font-[650]">
                        {e.type === "NOTE" ? "Internal note" : e.message}
                      </b>
                      {e.type === "NOTE" && (
                        <p className="text-[14px] whitespace-pre-wrap text-text-secondary">
                          {e.message}
                        </p>
                      )}
                      <time className="block text-[12.5px] text-text-muted">
                        {lbl(labels.when, e.createdAt)} · {actor(e)}
                      </time>
                    </div>
                  </li>
                );
              })}
            </ol>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor={`${id}-note`}>Internal note</Label>
              <Textarea
                id={`${id}-note`}
                rows={2}
                placeholder="Only your team sees notes"
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
            </div>
            <Button
              variant="outline"
              size="sm"
              className="mt-2"
              disabled={busy || !note.trim()}
              onClick={() =>
                run(
                  () => addDealNote({ ref: deal.ref, text: note }),
                  "Note added",
                  () => setNote(""),
                )
              }
            >
              Add note
            </Button>
          </Panel>
        </div>
      </div>

      <Dialog
        open={dialog === "received"}
        onOpenChange={(o) => !o && setDialog(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Mark payment received?</DialogTitle>
            <DialogDescription>
              Have you checked {toPay ?? "the payment"} from {deal.customerName}{" "}
              on the bank statement
              {chosen
                ? ` for ${chosen.bank} ••${chosen.accountNumber.slice(-4)}`
                : ""}
              ? The customer’s page will say we received it.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialog(null)}>
              Not yet
            </Button>
            <Button
              disabled={busy}
              onClick={() =>
                run(() => markPaymentReceived(deal.ref), "Payment received")
              }
            >
              Yes, I checked the statement
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={dialog === "sent"}
        onOpenChange={(o) => !o && setDialog(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Mark as sent</DialogTitle>
            <DialogDescription>
              Record the transfer reference if you have it. You mark the deal
              completed once it’s confirmed.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`${id}-sent`}>Transfer reference (optional)</Label>
            <Input
              id={`${id}-sent`}
              value={sentRef}
              onChange={(e) => setSentRef(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialog(null)}>
              Back
            </Button>
            <Button
              disabled={busy}
              onClick={() =>
                run(
                  () =>
                    markDealSent({
                      ref: deal.ref,
                      reference: sentRef || undefined,
                    }),
                  "Marked sent",
                )
              }
            >
              Mark sent
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={dialog === "cancel"}
        onOpenChange={(o) => !o && setDialog(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancel {deal.ref}?</DialogTitle>
            <DialogDescription>
              The customer’s page will show the deal as cancelled. Give the
              reason for your team.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`${id}-cancel`}>Reason</Label>
            <Input
              id={`${id}-cancel`}
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              placeholder="e.g. Customer withdrew"
              aria-invalid={errors.reason ? true : undefined}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialog(null)}>
              Keep the deal
            </Button>
            <Button
              variant="destructive"
              disabled={busy || cancelReason.trim().length < 3}
              onClick={() =>
                run(
                  () => cancelDeal({ ref: deal.ref, reason: cancelReason }),
                  "Deal cancelled",
                )
              }
            >
              Cancel deal
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <span className="sr-only" aria-live="polite">
        {busy ? "Saving" : ""}
      </span>
    </>
  );
}
