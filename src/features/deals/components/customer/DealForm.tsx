"use client";

import { put } from "@vercel/blob/client";
import { ArrowRight, Info, Loader2, Upload } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent, useEffect, useId, useMemo, useState } from "react";

import { BankMark } from "@/components/bank-mark";
import { useFormToken } from "@/features/deals/components/customer/use-form-token";
import {
  DEAL_COPY,
  INTL_PURPOSE_LABELS,
  PAY_COUNTRIES,
  POF_PURPOSE_LABELS,
  RECEIVE_METHOD_LABELS,
  SCHOOL_COUNTRIES,
  SCHOOL_PURPOSE_LABELS,
} from "@/features/deals/content";
import {
  attachDealFile,
  requestDealUpload,
  submitDeal,
} from "@/features/deals/public-actions";
import type { DealForexRow, DealPofRow } from "@/features/deals/public-queries";
import { type QuoteBoards, quoteDeal } from "@/features/deals/quote";
import {
  amountString,
  type DealDetails,
  INTL_PURPOSES,
  POF_PURPOSES,
  RECEIVE_METHODS,
  SCHOOL_PURPOSES,
  submitDealInput,
} from "@/features/deals/schema";
import type { DealService, FormSlug } from "@/features/deals/services";
import { estimateNaira } from "@/features/public/estimate";
import { formatBoardPrice, formatRate } from "@/lib/format";

type Board<R> = {
  boardId: string;
  timeLabel: string;
  dateLabel: string;
  rows: R[];
} | null;

export type DealFormProps = {
  slug: FormSlug;
  enabled: DealService[];
  forex: Board<DealForexRow>;
  pof: Board<DealPofRow>;
  cashLink: string;
};

// The landing page's calculator links here with ?amount=, ?currency= and
// ?dir=. Read in the browser (the page is cached), checked like any input.
function readPrefill(search: string) {
  const q = new URLSearchParams(search);
  const amount = q.get("amount") ?? undefined;
  const currency = q.get("currency")?.toUpperCase();
  const dir = q.get("dir");
  return {
    amount: amount && /^[\d,.\s]{1,16}$/.test(amount) ? amount : undefined,
    currency: currency && /^[A-Z]{3}$/.test(currency) ? currency : undefined,
    dir: dir === "buy" || dir === "sell" ? dir : undefined,
  } as const;
}

const MAX_FILES = 3;
const MAX_BYTES = 10 * 1024 * 1024;
const FILE_TYPES = ["application/pdf", "image/jpeg", "image/png"];

// Whole naira from an exact decimal string: "8282250.5" → "₦8,282,251".
const naira = (exact: string) =>
  `₦${formatRate(estimateNaira(exact, "1") ?? "0")}`;
const kb = (bytes: number) =>
  bytes >= 1024 * 1024
    ? `${(bytes / 1024 / 1024).toFixed(1)} MB`
    : `${Math.max(1, Math.round(bytes / 1024))} KB`;

// deal-school-fees.html, deal-pay-abroad.html, deal-pof.html,
// deal-forex.html. The estimate here is for display; the server works the
// quote out again from the board it reads itself.
export function DealForm({
  slug,
  enabled,
  forex,
  pof,
  cashLink,
}: DealFormProps) {
  const id = useId();
  const router = useRouter();
  const getFormToken = useFormToken();
  const currencies = forex?.rows ?? [];
  const firstCode =
    currencies[slug === "school-fees" && currencies[1] ? 1 : 0]?.code || "";
  const forexDirs = (["sell", "buy"] as const).filter((d) =>
    enabled.includes(d === "sell" ? "FOREX_SELL" : "FOREX_BUY"),
  );

  const [v, setV] = useState({
    amount: "",
    currency: firstCode,
    country: slug === "pay-abroad" ? PAY_COUNTRIES[0]! : SCHOOL_COUNTRIES[0]!,
    schoolName: "",
    studentName: "",
    studentId: "",
    schoolPurpose: "TUITION" as (typeof SCHOOL_PURPOSES)[number],
    intlPurpose: "SUPPLIER" as (typeof INTL_PURPOSES)[number],
    receiveMethod: "WIRE" as (typeof RECEIVE_METHODS)[number],
    note: "",
    bankId: pof?.rows[0]?.bankId ?? "",
    months: 3,
    neededBy: "",
    pofPurpose: "STUDY_VISA" as (typeof POF_PURPOSES)[number],
    destinationCountry: "",
    dir: (forexDirs[0] ?? "sell") as "sell" | "buy",
    payoutBank: "",
    payoutAccount: "",
    name: "",
    whatsapp: "",
    email: "",
    consent: false,
    website: "",
  });
  const set = <K extends keyof typeof v>(key: K, value: (typeof v)[K]) =>
    setV((s) => ({ ...s, [key]: value }));
  // Apply the calculator's prefill once, after the first render.
  useEffect(() => {
    const timer = window.setTimeout(() => {
      const p = readPrefill(window.location.search);
      setV((s) => ({
        ...s,
        amount: p.amount ?? s.amount,
        currency:
          p.currency && currencies.some((r) => r.code === p.currency)
            ? p.currency
            : s.currency,
        dir: p.dir && forexDirs.includes(p.dir) ? p.dir : s.dir,
      }));
    }, 0);
    return () => window.clearTimeout(timer);
    // Once per page: the boards don't change while it's open.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [files, setFiles] = useState<File[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState<string | null>(null); // "Sending…" / "Uploading invoice…"

  const service: DealService =
    slug === "school-fees"
      ? "SCHOOL_FEES"
      : slug === "pay-abroad"
        ? "INTL_PAYMENT"
        : slug === "pof"
          ? "POF"
          : v.dir === "sell"
            ? "FOREX_SELL"
            : "FOREX_BUY";

  const details: DealDetails = useMemo(() => {
    switch (service) {
      case "SCHOOL_FEES":
        return {
          service,
          country: v.country,
          schoolName: v.schoolName,
          studentName: v.studentName,
          studentId: v.studentId || undefined,
          purpose: v.schoolPurpose,
          invoiceRequired: true,
        };
      case "INTL_PAYMENT":
        return {
          service,
          purpose: v.intlPurpose,
          country: v.country,
          receiveMethod: v.receiveMethod,
          note: v.note || undefined,
        };
      case "POF":
        return {
          service,
          bankId: v.bankId,
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
  }, [service, v]);

  const currency = slug === "pof" ? "NGN" : v.currency;
  const cleanAmount = amountString.safeParse(v.amount);
  const boards: QuoteBoards = useMemo(
    () => ({
      forex: forex && {
        boardId: forex.boardId,
        timeLabel: forex.timeLabel,
        dateLabel: forex.dateLabel,
        rows: forex.rows,
      },
      pof: pof && {
        boardId: pof.boardId,
        timeLabel: pof.timeLabel,
        dateLabel: pof.dateLabel,
        rows: pof.rows.map((r) => ({
          bankId: r.bankId,
          name: r.shortName ?? r.name,
          rate: r.rate,
        })),
      },
    }),
    [forex, pof],
  );
  const quote = cleanAmount.success
    ? quoteDeal(
        { service, currency, amount: cleanAmount.data, details },
        boards,
      )
    : null;
  const shownAmount = cleanAmount.success ? formatRate(cleanAmount.data) : "0";

  const payload = {
    details,
    currency,
    amount: v.amount,
    customer: { name: v.name, whatsapp: v.whatsapp, email: v.email },
    payout:
      service === "FOREX_SELL"
        ? { bank: v.payoutBank, accountNumber: v.payoutAccount }
        : undefined,
    consent: v.consent,
    website: v.website,
  };

  function addFiles(list: FileList | null) {
    if (!list) return;
    const next = [...files];
    for (const file of Array.from(list)) {
      if (!FILE_TYPES.includes(file.type))
        return setErrors((e) => ({ ...e, files: "Upload a PDF, JPG or PNG." }));
      if (file.size > MAX_BYTES)
        return setErrors((e) => ({
          ...e,
          files: `${file.name} is over 10 MB.`,
        }));
      if (next.length >= MAX_FILES)
        return setErrors((e) => ({ ...e, files: "Up to 3 files." }));
      next.push(file);
    }
    setErrors((e) => {
      const rest = { ...e };
      delete rest.files;
      return rest;
    });
    setFiles(next);
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (pending) return;
    setFormError(null);
    const local: Record<string, string> = {};
    const parsed = submitDealInput.safeParse({ ...payload, formToken: "" });
    if (!parsed.success)
      for (const issue of parsed.error.issues)
        local[issue.path.join(".")] ??= issue.message;
    if (slug === "school-fees" && files.length === 0)
      local.files = "Upload the invoice so we can check the details.";
    if (Object.keys(local).length) {
      setErrors(local);
      setFormError("Please check the highlighted fields.");
      return;
    }
    setErrors({});
    setPending("Sending…");
    const result = await submitDeal({
      ...payload,
      formToken: await getFormToken(),
    });
    if (!result.ok) {
      setErrors(result.fieldErrors ?? {});
      setFormError(result.error);
      setPending(null);
      return;
    }
    const { ref, token } = result.data;
    let uploadFailed = false;
    for (const file of files) {
      setPending(`Uploading ${slug === "school-fees" ? "invoice" : "file"}…`);
      try {
        const ticket = await requestDealUpload({
          ref,
          token,
          kind: "INVOICE",
          contentType: file.type,
          size: file.size,
        });
        if (!ticket.ok) throw new Error(ticket.error);
        // A stalled upload gives up after a minute; the deal is already
        // saved, and the deal page offers WhatsApp for the invoice.
        await put(ticket.data.pathname, file, {
          access: "private",
          token: ticket.data.clientToken,
          contentType: file.type,
          abortSignal: AbortSignal.timeout(60_000),
        });
        const attached = await attachDealFile({
          ref,
          token,
          kind: "INVOICE",
          pathname: ticket.data.pathname,
          originalName: file.name,
        });
        if (!attached.ok) throw new Error(attached.error);
      } catch {
        uploadFailed = true;
      }
    }
    router.push(
      `/deal/${ref}?t=${encodeURIComponent(token)}&new=1${uploadFailed ? "&upload=failed" : ""}`,
    );
  }

  const fid = (name: string) => `${id}-${name}`;
  const errId = (key: string) => (errors[key] ? `${fid(key)}-err` : undefined);
  const fieldError = (k: string) =>
    errors[k] ? (
      <span className="ferr" id={`${fid(k)}-err`}>
        {errors[k]}
      </span>
    ) : null;
  const inv = (k: string) => (errors[k] ? true : undefined);

  const copy = DEAL_COPY.forms[slug];
  const isSell = service === "FOREX_SELL";
  const kLabel =
    slug === "pof"
      ? "Estimated fee"
      : isSell
        ? "You receive (estimate)"
        : "You pay (estimate)";
  const pofBank = pof?.rows.find((r) => r.bankId === v.bankId);
  const bigValue = quote ? naira(quote.naira) : DEAL_COPY.noQuote;
  const boardTime = slug === "pof" ? pof?.timeLabel : forex?.timeLabel;

  const sub =
    slug === "pof"
      ? `₦${shownAmount}${pofBank ? ` at ${pofBank.shortName ?? pofBank.name}` : ""} for ${v.months} month${v.months > 1 ? "s" : ""}`
      : slug === "school-fees"
        ? `for ${shownAmount} ${currency} to ${v.schoolName.trim() || "the school"}`
        : slug === "pay-abroad"
          ? `for ${shownAmount} ${currency} to ${v.country}`
          : `for ${shownAmount} ${currency}`;

  const lines: [string, string][] =
    slug === "pof"
      ? [
          [
            "Rate",
            quote
              ? `${formatBoardPrice(quote.rate)}% per month`
              : "Confirmed on WhatsApp",
          ],
          ["Months", String(v.months)],
          ["Statement", "Bank-issued, with stamp"],
        ]
      : slug === "forex"
        ? [
            [
              "Rate",
              quote
                ? `₦${formatRate(quote.rate)} per ${currency} (${isSell ? "we buy" : "we sell"})`
                : "Confirmed on WhatsApp",
            ],
            [
              "Paid to",
              isSell
                ? "Your bank account"
                : "Your foreign account (on WhatsApp)",
            ],
            ["Timing", "Minutes after we receive it"],
          ]
        : [
            [
              "Rate",
              quote
                ? `₦${formatRate(quote.rate)} per ${currency}`
                : "Confirmed on WhatsApp",
            ],
            [
              "Delivery",
              slug === "pay-abroad" ? "Same day · T+1 for China" : "Same day",
            ],
            ["Fee", "Confirmed on WhatsApp"],
          ];

  const money = (label: string) => (
    <div className="fld">
      <label htmlFor={fid("amount")}>{label}</label>
      <div className="money" data-invalid={inv("amount") ?? inv("currency")}>
        {slug === "pof" ? (
          <span className="unit">₦</span>
        ) : currencies.length > 0 ? (
          <select
            aria-label="Currency"
            value={v.currency}
            onChange={(e) => set("currency", e.target.value)}
          >
            {currencies.map((r) => (
              <option key={r.code} value={r.code}>
                {r.code}
              </option>
            ))}
          </select>
        ) : (
          <input
            aria-label="Currency (3 letters)"
            value={v.currency}
            maxLength={3}
            style={{ width: 80, flex: "none", fontSize: 16 }}
            placeholder="USD"
            onChange={(e) => set("currency", e.target.value.toUpperCase())}
          />
        )}
        <input
          id={fid("amount")}
          inputMode="decimal"
          autoComplete="off"
          value={v.amount}
          placeholder="0"
          aria-invalid={inv("amount")}
          aria-describedby={errId("amount")}
          onChange={(e) => set("amount", e.target.value)}
        />
      </div>
      {fieldError("amount")}
      {fieldError("currency")}
    </div>
  );

  const pills = <T extends string>(
    name: string,
    label: string,
    options: Record<T, string>,
    value: T,
    onPick: (v: T) => void,
  ) => (
    <fieldset className="fld">
      <legend className="lbl" style={{ marginBottom: 7 }}>
        {label}
      </legend>
      <div className="pills">
        {(Object.keys(options) as T[]).map((key) => (
          <label className="pill" key={key}>
            <input
              type="radio"
              name={`${id}-${name}`}
              checked={value === key}
              onChange={() => onPick(key)}
            />
            <span>{options[key]}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );

  const dropZone = (required: boolean) => (
    <div className="fld">
      <span className="lbl">
        {slug === "school-fees" ? "Invoice or payment letter" : "Invoice"}{" "}
        {!required && (
          <span style={{ color: "var(--ink3)", fontWeight: 500 }}>
            (optional)
          </span>
        )}
      </span>
      <label className="drop" style={{ position: "relative" }}>
        <span className="ic" aria-hidden="true">
          <Upload size={22} strokeWidth={2} />
        </span>
        <span>
          <b>
            {slug === "school-fees"
              ? "Upload the invoice"
              : "Upload invoice or payment details"}
          </b>
          <small>
            PDF, JPG or PNG, up to 10 MB. Stored privately, seen only by our
            team.
          </small>
        </span>
        <input
          type="file"
          accept="application/pdf,image/jpeg,image/png"
          multiple
          aria-describedby={errId("files")}
          onChange={(e) => {
            addFiles(e.target.files);
            e.target.value = "";
          }}
        />
      </label>
      {files.map((file, i) => (
        <div className="file" key={`${file.name}-${i}`}>
          📄 {file.name} <span className="x">{kb(file.size)}</span>
          <button
            type="button"
            onClick={() => setFiles((f) => f.filter((_, j) => j !== i))}
            aria-label={`Remove ${file.name}`}
          >
            Remove
          </button>
        </div>
      ))}
      {fieldError("files")}
    </div>
  );

  return (
    <main className="page">
      <Link className="crumb" href="/deal/new">
        ← Start a deal
      </Link>
      <h1>{copy.title}</h1>
      <p className="lead">{copy.lead}</p>
      <form className="grid" onSubmit={onSubmit} noValidate id={fid("form")}>
        <div>
          <section className="card">
            <h2>
              <span className="n">1</span>
              {slug === "pof"
                ? "Your proof of funds"
                : slug === "forex"
                  ? "Your forex deal"
                  : "The payment"}
            </h2>
            <div className="fields">
              {slug === "school-fees" && (
                <>
                  <div className="row2">
                    <div className="fld">
                      <label htmlFor={fid("country")}>
                        Country of the school
                      </label>
                      <select
                        className="sel"
                        id={fid("country")}
                        value={v.country}
                        onChange={(e) => set("country", e.target.value)}
                      >
                        {SCHOOL_COUNTRIES.map((c) => (
                          <option key={c}>{c}</option>
                        ))}
                      </select>
                    </div>
                    <div className="fld">
                      <label htmlFor={fid("details.schoolName")}>
                        School name
                      </label>
                      <input
                        className="inp"
                        id={fid("details.schoolName")}
                        value={v.schoolName}
                        placeholder="e.g. University of Leeds"
                        aria-invalid={inv("details.schoolName")}
                        aria-describedby={errId("details.schoolName")}
                        onChange={(e) => set("schoolName", e.target.value)}
                      />
                      {fieldError("details.schoolName")}
                    </div>
                  </div>
                  <div className="row2">
                    <div className="fld">
                      <label htmlFor={fid("details.studentName")}>
                        Student’s full name
                      </label>
                      <input
                        className="inp"
                        id={fid("details.studentName")}
                        value={v.studentName}
                        aria-invalid={inv("details.studentName")}
                        aria-describedby={errId("details.studentName")}
                        onChange={(e) => set("studentName", e.target.value)}
                      />
                      {fieldError("details.studentName")}
                    </div>
                    <div className="fld">
                      <label htmlFor={fid("details.studentId")}>
                        Student ID{" "}
                        <span style={{ color: "var(--ink3)", fontWeight: 500 }}>
                          (optional)
                        </span>
                      </label>
                      <input
                        className="inp"
                        id={fid("details.studentId")}
                        value={v.studentId}
                        placeholder="On the invoice"
                        onChange={(e) => set("studentId", e.target.value)}
                      />
                    </div>
                  </div>
                  {money("Amount on the invoice")}
                  <span className="hint" style={{ marginTop: -8 }}>
                    Pay exactly what the invoice says. Bank charges abroad, if
                    any, are confirmed on WhatsApp.
                  </span>
                  {pills(
                    "what",
                    "What is it for?",
                    SCHOOL_PURPOSE_LABELS,
                    v.schoolPurpose,
                    (p) => set("schoolPurpose", p),
                  )}
                  {dropZone(true)}
                </>
              )}

              {slug === "pay-abroad" && (
                <>
                  {pills(
                    "purpose",
                    "What are you paying?",
                    INTL_PURPOSE_LABELS,
                    v.intlPurpose,
                    (p) => set("intlPurpose", p),
                  )}
                  <div className="row2">
                    <div className="fld">
                      <label htmlFor={fid("country")}>
                        Recipient’s country
                      </label>
                      <select
                        className="sel"
                        id={fid("country")}
                        value={v.country}
                        onChange={(e) => set("country", e.target.value)}
                      >
                        {PAY_COUNTRIES.map((c) => (
                          <option key={c}>{c}</option>
                        ))}
                      </select>
                    </div>
                    <div className="fld">
                      <label htmlFor={fid("method")}>They receive by</label>
                      <select
                        className="sel"
                        id={fid("method")}
                        value={v.receiveMethod}
                        onChange={(e) =>
                          set(
                            "receiveMethod",
                            e.target.value as typeof v.receiveMethod,
                          )
                        }
                      >
                        {RECEIVE_METHODS.map((m) => (
                          <option key={m} value={m}>
                            {RECEIVE_METHOD_LABELS[m]}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  {money("Amount they should receive")}
                  <span className="hint" style={{ marginTop: -8 }}>
                    China and some countries settle T+1 (next working day).
                  </span>
                  <div className="fld">
                    <label htmlFor={fid("details.note")}>
                      Anything we should know?{" "}
                      <span style={{ color: "var(--ink3)", fontWeight: 500 }}>
                        (optional)
                      </span>
                    </label>
                    <textarea
                      className="inp"
                      id={fid("details.note")}
                      maxLength={500}
                      value={v.note}
                      placeholder="Recipient bank details will be collected on WhatsApp."
                      onChange={(e) => set("note", e.target.value)}
                    />
                    {fieldError("details.note")}
                  </div>
                  {dropZone(false)}
                </>
              )}

              {slug === "pof" && (
                <>
                  {money("Amount to show")}
                  <span className="hint" style={{ marginTop: -8 }}>
                    Usually the amount your embassy or school asks for.
                  </span>
                  <fieldset className="fld">
                    <legend className="lbl" style={{ marginBottom: 7 }}>
                      Bank
                    </legend>
                    {pof && pof.rows.length > 0 ? (
                      <div className="banks">
                        {pof.rows.map((r) => (
                          <label
                            className="bank"
                            key={r.bankId}
                            style={{ position: "relative" }}
                          >
                            <input
                              type="radio"
                              name={`${id}-bank`}
                              checked={v.bankId === r.bankId}
                              onChange={() => set("bankId", r.bankId)}
                            />
                            <span>
                              <BankMark
                                name={r.name}
                                slug={r.name.toLowerCase()}
                                logoUrl={r.logoUrl}
                                size={34}
                                className="mark"
                              />
                              <b>{r.shortName ?? r.name}</b>
                              <small>
                                {formatBoardPrice(r.rate)}% / month
                                {r.note ? ` · ${r.note}` : ""}
                              </small>
                            </span>
                          </label>
                        ))}
                      </div>
                    ) : (
                      <p className="hint">
                        Today’s POF rates are shared on WhatsApp. We’ll
                        recommend a bank.
                      </p>
                    )}
                    <span className="hint">
                      Rates from today’s POF board. Some banks need a new
                      account.
                    </span>
                    {fieldError("details.bankId")}
                  </fieldset>
                  <div className="row2">
                    <div className="fld">
                      <label htmlFor={fid("months")}>For how long?</label>
                      <select
                        className="sel"
                        id={fid("months")}
                        value={v.months}
                        onChange={(e) => set("months", Number(e.target.value))}
                      >
                        {Array.from({ length: 12 }, (_, i) => i + 1).map(
                          (m) => (
                            <option key={m} value={m}>
                              {m} month{m > 1 ? "s" : ""}
                            </option>
                          ),
                        )}
                      </select>
                    </div>
                    <div className="fld">
                      <label htmlFor={fid("details.neededBy")}>Needed by</label>
                      <input
                        className="inp"
                        type="date"
                        id={fid("details.neededBy")}
                        value={v.neededBy}
                        aria-invalid={inv("details.neededBy")}
                        aria-describedby={errId("details.neededBy")}
                        onChange={(e) => set("neededBy", e.target.value)}
                      />
                      {fieldError("details.neededBy")}
                    </div>
                  </div>
                  <div className="row2">
                    <div className="fld">
                      <label htmlFor={fid("purpose")}>Purpose</label>
                      <select
                        className="sel"
                        id={fid("purpose")}
                        value={v.pofPurpose}
                        onChange={(e) =>
                          set(
                            "pofPurpose",
                            e.target.value as typeof v.pofPurpose,
                          )
                        }
                      >
                        {POF_PURPOSES.map((p) => (
                          <option key={p} value={p}>
                            {POF_PURPOSE_LABELS[p]}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="fld">
                      <label htmlFor={fid("details.destinationCountry")}>
                        Destination country
                      </label>
                      <input
                        className="inp"
                        id={fid("details.destinationCountry")}
                        value={v.destinationCountry}
                        aria-invalid={inv("details.destinationCountry")}
                        aria-describedby={errId("details.destinationCountry")}
                        onChange={(e) =>
                          set("destinationCountry", e.target.value)
                        }
                      />
                      {fieldError("details.destinationCountry")}
                    </div>
                  </div>
                </>
              )}

              {slug === "forex" && (
                <>
                  {forexDirs.length > 1 && (
                    <div
                      className="seg"
                      role="radiogroup"
                      aria-label="Direction"
                    >
                      <label>
                        <input
                          type="radio"
                          name={`${id}-dir`}
                          checked={v.dir === "sell"}
                          onChange={() => set("dir", "sell")}
                        />
                        <span>I’m selling to us</span>
                      </label>
                      <label>
                        <input
                          type="radio"
                          name={`${id}-dir`}
                          checked={v.dir === "buy"}
                          onChange={() => set("dir", "buy")}
                        />
                        <span>I’m buying from us</span>
                      </label>
                    </div>
                  )}
                  {money(
                    isSell ? "Amount you’re sending" : "Amount you want to buy",
                  )}
                  {isSell && (
                    <>
                      <div className="fld">
                        <span className="lbl">How you’ll send it</span>
                        <div className="pills">
                          <label className="pill">
                            <input type="radio" checked readOnly />
                            <span>Transfer from my banking app</span>
                          </label>
                        </div>
                        <span className="hint">
                          Our account details appear on your deal page after our
                          team confirms the rate. Only send to the account shown
                          there.
                        </span>
                      </div>
                      <div className="fld">
                        <span className="lbl">
                          Where should we pay your naira?
                        </span>
                        <div className="row2">
                          <div className="fld">
                            <label htmlFor={fid("payout.bank")}>Bank</label>
                            <input
                              className="inp"
                              id={fid("payout.bank")}
                              value={v.payoutBank}
                              autoComplete="off"
                              aria-invalid={inv("payout.bank")}
                              aria-describedby={errId("payout.bank")}
                              onChange={(e) =>
                                set("payoutBank", e.target.value)
                              }
                            />
                            {fieldError("payout.bank")}
                          </div>
                          <div className="fld">
                            <label htmlFor={fid("payout.accountNumber")}>
                              Account number
                            </label>
                            <input
                              className="inp"
                              id={fid("payout.accountNumber")}
                              inputMode="numeric"
                              maxLength={13}
                              placeholder="10 digits"
                              value={v.payoutAccount}
                              aria-invalid={inv("payout.accountNumber")}
                              aria-describedby={errId("payout.accountNumber")}
                              onChange={(e) =>
                                set("payoutAccount", e.target.value)
                              }
                            />
                            {fieldError("payout.accountNumber")}
                          </div>
                        </div>
                        <span className="hint">
                          The account must be in your own name.
                        </span>
                      </div>
                    </>
                  )}
                  <div className="note warn">
                    <Info
                      size={18}
                      strokeWidth={2.2}
                      aria-hidden="true"
                      style={{ flexShrink: 0, marginTop: 2 }}
                    />
                    <span>
                      Need cash? Cash is arranged on request for existing
                      customers only.{" "}
                      <a
                        href={cashLink}
                        target="_blank"
                        rel="noopener"
                        style={{
                          fontWeight: 800,
                          color: "inherit",
                          textDecoration: "underline",
                        }}
                      >
                        Ask us on WhatsApp
                      </a>
                      .
                    </span>
                  </div>
                </>
              )}
            </div>
          </section>

          <section className="card">
            <h2>
              <span className="n">2</span>Your details
            </h2>
            <p className="d">
              So our team can confirm the deal with you on WhatsApp.
            </p>
            <div className="fields">
              <div className="fld">
                <label htmlFor={fid("customer.name")}>Full name</label>
                <input
                  className="inp"
                  id={fid("customer.name")}
                  autoComplete="name"
                  placeholder="As it appears on your bank account"
                  value={v.name}
                  aria-invalid={inv("customer.name")}
                  aria-describedby={errId("customer.name")}
                  onChange={(e) => set("name", e.target.value)}
                />
                {fieldError("customer.name")}
              </div>
              <div className="row2">
                <div className="fld">
                  <label htmlFor={fid("customer.whatsapp")}>
                    WhatsApp number
                  </label>
                  <input
                    className="inp"
                    id={fid("customer.whatsapp")}
                    inputMode="tel"
                    autoComplete="tel"
                    placeholder="0803 123 4567"
                    value={v.whatsapp}
                    aria-invalid={inv("customer.whatsapp")}
                    aria-describedby={errId("customer.whatsapp")}
                    onChange={(e) => set("whatsapp", e.target.value)}
                  />
                  {fieldError("customer.whatsapp")}
                </div>
                <div className="fld">
                  <label htmlFor={fid("customer.email")}>
                    Email{" "}
                    <span style={{ color: "var(--ink3)", fontWeight: 500 }}>
                      (optional)
                    </span>
                  </label>
                  <input
                    className="inp"
                    id={fid("customer.email")}
                    type="email"
                    autoComplete="email"
                    placeholder="you@example.com"
                    value={v.email}
                    aria-invalid={inv("customer.email")}
                    aria-describedby={errId("customer.email")}
                    onChange={(e) => set("email", e.target.value)}
                  />
                  {fieldError("customer.email")}
                </div>
              </div>
              {/* Bots fill every field; people never see this one. */}
              <div className="hp" aria-hidden="true">
                <label htmlFor={fid("website")}>Website</label>
                <input
                  id={fid("website")}
                  name="website"
                  tabIndex={-1}
                  autoComplete="off"
                  value={v.website}
                  onChange={(e) => set("website", e.target.value)}
                />
              </div>
              <label className="check">
                <input
                  type="checkbox"
                  checked={v.consent}
                  aria-invalid={inv("consent")}
                  aria-describedby={errId("consent")}
                  onChange={(e) => set("consent", e.target.checked)}
                />
                <span>
                  I agree that my details are used only for this deal, and
                  shared with our team to arrange it.
                </span>
              </label>
              {fieldError("consent")}
            </div>
          </section>
          {formError && (
            <p className="note bad formerr" role="alert">
              {formError}
            </p>
          )}
        </div>

        <aside className="sum hide-m" aria-label="Estimate">
          <div className="k">{kLabel}</div>
          <div className={`big num${quote ? "" : " noq"}`} aria-live="polite">
            {bigValue}
          </div>
          <div className="sub">{sub}</div>
          <div className="lines">
            {lines.map(([k, val]) => (
              <div className="ln" key={k}>
                <span>{k}</span>
                <span className="num">{val}</span>
              </div>
            ))}
          </div>
          <button className="btn gold block" type="submit" disabled={!!pending}>
            {pending ? (
              <>
                <Loader2
                  size={18}
                  className="animate-spin"
                  aria-hidden="true"
                />
                {pending}
              </>
            ) : (
              <>
                Submit deal request{" "}
                <ArrowRight size={18} strokeWidth={2.2} aria-hidden="true" />
              </>
            )}
          </button>
          <p className="fine">
            {quote && boardTime
              ? `Estimate from today’s rates (updated ${boardTime}). `
              : ""}
            {DEAL_COPY.fine}
          </p>
        </aside>
      </form>
      <div className="mbar">
        <div className="t">
          <small>{kLabel}</small>
          <b className={`num${quote ? "" : " noq"}`}>{bigValue}</b>
        </div>
        <button
          className="btn gold"
          type="submit"
          form={fid("form")}
          disabled={!!pending}
        >
          {pending ? "Sending…" : "Submit"}
        </button>
      </div>
    </main>
  );
}
