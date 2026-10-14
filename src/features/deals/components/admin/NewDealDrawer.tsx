"use client";

import { Copy, Plus } from "lucide-react";
import Link from "next/link";
import { useId, useState } from "react";
import { toast } from "sonner";

import { EntityDrawer } from "@/components/entity-drawer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { createTeamDeal } from "@/features/deals/actions";
import {
  INTL_PURPOSE_LABELS,
  PAY_COUNTRIES,
  POF_PURPOSE_LABELS,
  RECEIVE_METHOD_LABELS,
  SCHOOL_COUNTRIES,
  SCHOOL_PURPOSE_LABELS,
} from "@/features/deals/content";
import type { DealForexRow, DealPofRow } from "@/features/deals/public-queries";
import type { DealDetails } from "@/features/deals/schema";
import {
  PHASE12_SERVICES,
  type Phase12Service,
  SERVICE_LABELS,
} from "@/features/deals/services";
import {
  FieldError,
  Select,
} from "@/features/settings/components/settings-parts";

type Boards = {
  forex: { rows: DealForexRow[] } | null;
  pof: { rows: DealPofRow[] } | null;
};

// deals.html "New deal": a deal that started on WhatsApp, with the same
// fields as the website (no bot checks; the member is the actor and owner).
export function NewDealButton({ boards }: { boards: Boards }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}>
        <Plus strokeWidth={1.9} />
        New deal
      </Button>
      <NewDealDrawer open={open} onOpenChange={setOpen} boards={boards} />
    </>
  );
}

const EMPTY = {
  service: "SCHOOL_FEES" as Phase12Service,
  name: "",
  whatsapp: "",
  email: "",
  currency: "",
  amount: "",
  country: "",
  schoolName: "",
  studentName: "",
  studentId: "",
  schoolPurpose: "TUITION" as keyof typeof SCHOOL_PURPOSE_LABELS,
  intlPurpose: "SUPPLIER" as keyof typeof INTL_PURPOSE_LABELS,
  receiveMethod: "WIRE" as keyof typeof RECEIVE_METHOD_LABELS,
  note: "",
  bankId: "",
  months: 3,
  neededBy: "",
  pofPurpose: "STUDY_VISA" as keyof typeof POF_PURPOSE_LABELS,
  destinationCountry: "",
  payoutBank: "",
  payoutAccount: "",
};

function NewDealDrawer({
  open,
  onOpenChange,
  boards,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  boards: Boards;
}) {
  const id = useId();
  const [v, setV] = useState(EMPTY);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, setPending] = useState(false);
  const [created, setCreated] = useState<{ ref: string; link: string } | null>(
    null,
  );
  const set = <K extends keyof typeof v>(k: K, value: (typeof v)[K]) =>
    setV((s) => ({ ...s, [k]: value }));
  const codes = boards.forex?.rows.map((r) => r.code) ?? [];
  const currency = v.service === "POF" ? "NGN" : v.currency || codes[0] || "";

  const details = (): DealDetails => {
    switch (v.service) {
      case "SCHOOL_FEES":
        return {
          service: "SCHOOL_FEES",
          country: v.country || SCHOOL_COUNTRIES[0]!,
          schoolName: v.schoolName,
          studentName: v.studentName,
          studentId: v.studentId || undefined,
          purpose: v.schoolPurpose,
          invoiceRequired: false,
        };
      case "INTL_PAYMENT":
        return {
          service: "INTL_PAYMENT",
          purpose: v.intlPurpose,
          country: v.country || PAY_COUNTRIES[0]!,
          receiveMethod: v.receiveMethod,
          note: v.note || undefined,
        };
      case "POF":
        return {
          service: "POF",
          bankId: v.bankId || boards.pof?.rows[0]?.bankId || "",
          months: v.months,
          neededBy: v.neededBy,
          purpose: v.pofPurpose,
          destinationCountry: v.destinationCountry,
        };
      case "FOREX_SELL":
        return { service: "FOREX_SELL", method: "TRANSFER" };
      default:
        return { service: "FOREX_BUY", method: "TRANSFER" };
    }
  };

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    const result = await createTeamDeal({
      details: details(),
      currency,
      amount: v.amount,
      customer: { name: v.name, whatsapp: v.whatsapp, email: v.email },
      payout:
        v.service === "FOREX_SELL"
          ? { bank: v.payoutBank, accountNumber: v.payoutAccount }
          : undefined,
    });
    setPending(false);
    if (!result.ok) {
      setErrors({ ...(result.fieldErrors ?? {}), root: result.error });
      return;
    }
    setErrors({});
    setCreated({
      ref: result.data.ref,
      link: `${window.location.origin}/deal/${result.data.ref}?t=${encodeURIComponent(result.data.token)}`,
    });
    toast.success(`${result.data.ref} added`);
  }

  const field = (key: string, label: string, input: React.ReactNode) => (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={`${id}-${key}`}>{label}</Label>
      {input}
      <FieldError id={`${id}-${key}-err`} message={errors[key]} />
    </div>
  );
  const text = (
    key: keyof typeof v,
    errKey: string,
    props: React.ComponentProps<"input"> = {},
  ) => (
    <Input
      id={`${id}-${errKey}`}
      value={String(v[key])}
      autoComplete="off"
      aria-invalid={errors[errKey] ? true : undefined}
      onChange={(e) => set(key, e.target.value as never)}
      {...props}
    />
  );

  return (
    <EntityDrawer
      open={open}
      onOpenChange={(next) => {
        if (pending) return;
        onOpenChange(next);
        if (!next) {
          setV(EMPTY);
          setErrors({});
          setCreated(null);
        }
      }}
      title={created ? `${created.ref} added` : "New deal"}
      description={
        created
          ? "Send the customer their private deal link. It is shown only now."
          : "A deal that started on WhatsApp. Same details as the website form."
      }
      submitLabel={created ? "Done" : "Add deal"}
      pendingLabel="Adding…"
      pending={pending}
      onSubmit={
        created
          ? (e) => {
              e.preventDefault();
              onOpenChange(false);
              setV(EMPTY);
              setCreated(null);
            }
          : submit
      }
    >
      {created ? (
        <div className="flex flex-col gap-3">
          <div className="rounded-control border border-border-default bg-bg-subtle px-3 py-2.5 text-[13px] break-all">
            {created.link}
          </div>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={async () => {
                await navigator.clipboard
                  .writeText(created.link)
                  .catch(() => {});
                toast.success("Deal link copied");
              }}
            >
              <Copy strokeWidth={1.9} />
              Copy link
            </Button>
            <Button asChild variant="outline">
              <Link href={`/admin/deals/${created.ref}`}>Open deal</Link>
            </Button>
          </div>
        </div>
      ) : (
        <>
          {field(
            "service",
            "Service",
            <Select
              id={`${id}-service`}
              value={v.service}
              onChange={(e) => set("service", e.target.value as Phase12Service)}
            >
              {PHASE12_SERVICES.map((s) => (
                <option key={s} value={s}>
                  {SERVICE_LABELS[s]}
                </option>
              ))}
            </Select>,
          )}
          {field(
            "customer.name",
            "Customer’s full name",
            text("name", "customer.name"),
          )}
          <div className="grid grid-cols-2 gap-3.5">
            {field(
              "customer.whatsapp",
              "WhatsApp number",
              text("whatsapp", "customer.whatsapp", { inputMode: "tel" }),
            )}
            {field(
              "customer.email",
              "Email (optional)",
              text("email", "customer.email", { type: "email" }),
            )}
          </div>
          <div className="grid grid-cols-[110px_minmax(0,1fr)] gap-3.5">
            {field(
              "currency",
              "Currency",
              v.service === "POF" ? (
                <Input id={`${id}-currency`} value="NGN" disabled readOnly />
              ) : codes.length ? (
                <Select
                  id={`${id}-currency`}
                  value={currency}
                  onChange={(e) => set("currency", e.target.value)}
                >
                  {codes.map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </Select>
              ) : (
                text("currency", "currency", {
                  maxLength: 3,
                  className: "uppercase",
                })
              ),
            )}
            {field(
              "amount",
              v.service === "POF" ? "Amount to show" : "Amount",
              text("amount", "amount", { inputMode: "decimal" }),
            )}
          </div>

          {v.service === "SCHOOL_FEES" && (
            <>
              {field(
                "details.schoolName",
                "School name",
                text("schoolName", "details.schoolName"),
              )}
              <div className="grid grid-cols-2 gap-3.5">
                {field(
                  "details.studentName",
                  "Student’s name",
                  text("studentName", "details.studentName"),
                )}
                {field(
                  "details.studentId",
                  "Student ID (optional)",
                  text("studentId", "details.studentId"),
                )}
              </div>
              <div className="grid grid-cols-2 gap-3.5">
                {field(
                  "country",
                  "Country",
                  <Select
                    id={`${id}-country`}
                    value={v.country || SCHOOL_COUNTRIES[0]}
                    onChange={(e) => set("country", e.target.value)}
                  >
                    {SCHOOL_COUNTRIES.map((c) => (
                      <option key={c}>{c}</option>
                    ))}
                  </Select>,
                )}
                {field(
                  "purpose",
                  "For",
                  <Select
                    id={`${id}-purpose`}
                    value={v.schoolPurpose}
                    onChange={(e) =>
                      set(
                        "schoolPurpose",
                        e.target.value as typeof v.schoolPurpose,
                      )
                    }
                  >
                    {Object.entries(SCHOOL_PURPOSE_LABELS).map(([k, l]) => (
                      <option key={k} value={k}>
                        {l}
                      </option>
                    ))}
                  </Select>,
                )}
              </div>
            </>
          )}
          {v.service === "INTL_PAYMENT" && (
            <>
              <div className="grid grid-cols-2 gap-3.5">
                {field(
                  "purpose",
                  "Paying",
                  <Select
                    id={`${id}-purpose`}
                    value={v.intlPurpose}
                    onChange={(e) =>
                      set("intlPurpose", e.target.value as typeof v.intlPurpose)
                    }
                  >
                    {Object.entries(INTL_PURPOSE_LABELS).map(([k, l]) => (
                      <option key={k} value={k}>
                        {l}
                      </option>
                    ))}
                  </Select>,
                )}
                {field(
                  "country",
                  "Recipient’s country",
                  <Select
                    id={`${id}-country`}
                    value={v.country || PAY_COUNTRIES[0]}
                    onChange={(e) => set("country", e.target.value)}
                  >
                    {PAY_COUNTRIES.map((c) => (
                      <option key={c}>{c}</option>
                    ))}
                  </Select>,
                )}
              </div>
              {field(
                "method",
                "They receive by",
                <Select
                  id={`${id}-method`}
                  value={v.receiveMethod}
                  onChange={(e) =>
                    set(
                      "receiveMethod",
                      e.target.value as typeof v.receiveMethod,
                    )
                  }
                >
                  {Object.entries(RECEIVE_METHOD_LABELS).map(([k, l]) => (
                    <option key={k} value={k}>
                      {l}
                    </option>
                  ))}
                </Select>,
              )}
              {field(
                "details.note",
                "Note (optional)",
                <Textarea
                  id={`${id}-details.note`}
                  value={v.note}
                  maxLength={500}
                  onChange={(e) => set("note", e.target.value)}
                />,
              )}
            </>
          )}
          {v.service === "POF" && (
            <>
              {field(
                "details.bankId",
                "Bank",
                boards.pof?.rows.length ? (
                  <Select
                    id={`${id}-details.bankId`}
                    value={v.bankId || boards.pof.rows[0]!.bankId}
                    onChange={(e) => set("bankId", e.target.value)}
                  >
                    {boards.pof.rows.map((r) => (
                      <option key={r.bankId} value={r.bankId}>
                        {r.shortName ?? r.name} · {r.rate}% / month
                      </option>
                    ))}
                  </Select>
                ) : (
                  <p className="text-[13.5px] text-text-secondary">
                    No POF board yet: generate one first.
                  </p>
                ),
              )}
              <div className="grid grid-cols-2 gap-3.5">
                {field(
                  "months",
                  "Months",
                  <Select
                    id={`${id}-months`}
                    value={v.months}
                    onChange={(e) => set("months", Number(e.target.value))}
                  >
                    {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </Select>,
                )}
                {field(
                  "details.neededBy",
                  "Needed by",
                  text("neededBy", "details.neededBy", { type: "date" }),
                )}
              </div>
              <div className="grid grid-cols-2 gap-3.5">
                {field(
                  "purpose",
                  "Purpose",
                  <Select
                    id={`${id}-purpose`}
                    value={v.pofPurpose}
                    onChange={(e) =>
                      set("pofPurpose", e.target.value as typeof v.pofPurpose)
                    }
                  >
                    {Object.entries(POF_PURPOSE_LABELS).map(([k, l]) => (
                      <option key={k} value={k}>
                        {l}
                      </option>
                    ))}
                  </Select>,
                )}
                {field(
                  "details.destinationCountry",
                  "Destination",
                  text("destinationCountry", "details.destinationCountry"),
                )}
              </div>
            </>
          )}
          {v.service === "FOREX_SELL" && (
            <div className="grid grid-cols-2 gap-3.5">
              {field(
                "payout.bank",
                "Customer’s bank",
                text("payoutBank", "payout.bank"),
              )}
              {field(
                "payout.accountNumber",
                "Account number",
                text("payoutAccount", "payout.accountNumber", {
                  inputMode: "numeric",
                }),
              )}
            </div>
          )}
          {errors.root && (
            <p
              role="alert"
              className="text-[13.5px] font-medium text-state-error"
            >
              {errors.root}
            </p>
          )}
        </>
      )}
    </EntityDrawer>
  );
}
