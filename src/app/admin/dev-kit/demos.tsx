"use client";

import { Info, Loader2, Pencil, Sparkles, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Callout } from "@/components/callout";
import { CurrencyFlag } from "@/components/currency-flag";
import { EntityDrawer } from "@/components/entity-drawer";
import { InputAddon } from "@/components/input-addon";
import { StatusChip } from "@/components/status-chip";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { compareDecimalStrings, subtractDecimalStrings } from "@/lib/decimal";
import { formatRate } from "@/lib/format";

// Interactive samples for the dev kit. Sample props only; nothing is saved.

const DECIMAL = /^\d+(\.\d+)?$/;

export function DrawerDemo() {
  const saved = { buy: "1365", sell: "1378" };
  const [open, setOpen] = useState(false);
  const [buy, setBuy] = useState(saved.buy);
  const [sell, setSell] = useState(saved.sell);
  const [pending, setPending] = useState(false);

  const valid = DECIMAL.test(buy) && DECIMAL.test(sell);
  const error = !valid
    ? "Enter both rates as numbers."
    : compareDecimalStrings(sell, buy) < 0
      ? "Sell must be the same as or higher than buy."
      : null;

  return (
    <EntityDrawer
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) {
          setBuy(saved.buy);
          setSell(saved.sell);
        }
      }}
      trigger={
        <Button variant="outline">
          <Pencil strokeWidth={1.9} />
          Edit USD rate
        </Button>
      }
      title="Edit USD rate"
      description="Naira per 1 USD"
      submitLabel="Save changes"
      pendingLabel="Saving…"
      pending={pending}
      onSubmit={(event) => {
        event.preventDefault();
        if (error) return;
        setPending(true);
        setTimeout(() => {
          setPending(false);
          setOpen(false);
          toast.success("USD rate saved");
        }, 900);
      }}
    >
      <div className="flex items-center gap-3">
        <CurrencyFlag flagCode="us" currencyCode="USD" size={44} />
        <div>
          <b className="block text-[17px] leading-tight">USD</b>
          <span className="text-[13px] text-text-secondary">US dollar</span>
        </div>
        <div className="ml-auto">
          <StatusChip status="ACTIVE" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3.5">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="dd-buy">We buy</Label>
          <InputAddon
            id="dd-buy"
            prefix="₦"
            inputMode="decimal"
            value={buy}
            onChange={(e) => setBuy(e.target.value)}
            changed={buy !== saved.buy}
            aria-invalid={error ? true : undefined}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="dd-sell">We sell</Label>
          <InputAddon
            id="dd-sell"
            prefix="₦"
            inputMode="decimal"
            value={sell}
            onChange={(e) => setSell(e.target.value)}
            changed={sell !== saved.sell}
            aria-invalid={error ? true : undefined}
          />
        </div>
      </div>
      {error ? (
        <p role="alert" className="text-[13.5px] font-medium text-state-error">
          {error}
        </p>
      ) : (
        <p className="text-[13px] text-text-muted">
          Spread ₦{formatRate(subtractDecimalStrings(sell, buy))}
        </p>
      )}
      <Callout>Saving adds a new entry. Nothing is overwritten.</Callout>
    </EntityDrawer>
  );
}

export function DialogDemo() {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline">
          <Trash2 strokeWidth={1.9} />
          Delete bank…
        </Button>
      </DialogTrigger>
      <DialogContent showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>Delete Acme Bank?</DialogTitle>
          <DialogDescription>
            It has no rate history, so it can be deleted.
          </DialogDescription>
        </DialogHeader>
        <div className="px-6 py-5 text-[15px] text-text-secondary">
          The bank disappears from the POF page and the generator. This
          can&apos;t be undone.
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Cancel</Button>
          </DialogClose>
          <DialogClose asChild>
            <Button
              variant="destructive"
              onClick={() => toast.success("Acme Bank deleted")}
            >
              Delete bank
            </Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function SegmentedDemo() {
  const [value, setValue] = useState("all");
  return (
    <ToggleGroup
      type="single"
      variant="segmented"
      size="segmented"
      spacing={0}
      value={value}
      onValueChange={(next) => next && setValue(next)}
      aria-label="Filter by status"
    >
      <ToggleGroupItem value="all">All</ToggleGroupItem>
      <ToggleGroupItem value="active">Active</ToggleGroupItem>
      <ToggleGroupItem value="inactive">Inactive</ToggleGroupItem>
    </ToggleGroup>
  );
}

export function TabsDemo() {
  return (
    <Tabs defaultValue="forex" className="w-full max-w-sm">
      <TabsList>
        <TabsTrigger value="forex">Forex</TabsTrigger>
        <TabsTrigger value="pof">POF</TabsTrigger>
      </TabsList>
      <TabsContent value="forex" className="text-[13.5px] text-text-secondary">
        Forex board: buy and sell per currency.
      </TabsContent>
      <TabsContent value="pof" className="text-[13.5px] text-text-secondary">
        POF board: one rate per bank, per month.
      </TabsContent>
    </Tabs>
  );
}

export function SelectDemo({ id }: { id: string }) {
  return (
    <Select defaultValue="purple-signal">
      <SelectTrigger id={id}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="purple-signal">Purple Signal</SelectItem>
        <SelectItem value="daylight">Daylight</SelectItem>
        <SelectItem value="soon" disabled>
          More soon
        </SelectItem>
      </SelectContent>
    </Select>
  );
}

export function TooltipDemo() {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="About rate history">
          <Info strokeWidth={1.9} />
        </Button>
      </TooltipTrigger>
      <TooltipContent>Every change is kept in rate history.</TooltipContent>
    </Tooltip>
  );
}

export function ToastDemo() {
  return (
    <Button variant="outline" onClick={() => toast.success("Board generated")}>
      Show toast
    </Button>
  );
}

export function PendingDemo() {
  const [pending, setPending] = useState(false);
  return (
    <Button
      disabled={pending}
      onClick={() => {
        setPending(true);
        setTimeout(() => setPending(false), 1500);
      }}
    >
      {pending ? (
        <Loader2 aria-hidden="true" className="animate-spin" />
      ) : (
        <Sparkles strokeWidth={1.9} />
      )}
      {pending ? "Generating…" : "Generate image"}
    </Button>
  );
}
