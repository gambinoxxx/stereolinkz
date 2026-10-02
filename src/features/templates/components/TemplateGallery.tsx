"use client";

import { Layers, LayoutTemplate } from "lucide-react";
import Link from "next/link";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { BoardFrame } from "@/components/board/BoardFrame";
import { EmptyState } from "@/components/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { setDefaultTemplate } from "@/features/templates/actions";
import { ROW_NOUN } from "@/features/boards/schema";
import type { TemplateCard } from "@/features/templates/queries";
import type { TemplateType } from "@/features/templates/types";

type Tab = TemplateType | "CUSTOM";

// "forex", "POF", "crypto" in sentences.
const TYPE_WORD: Record<TemplateType, string> = {
  FOREX: "forex",
  POF: "POF",
  CRYPTO: "crypto",
};

// templates.html: tabs, then a card per template with a live thumbnail
// (the top of the board) built from the org's current rates.
export function TemplateGallery({ cards }: { cards: TemplateCard[] }) {
  const [tab, setTab] = useState<Tab>("FOREX");
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  function makeDefault(card: TemplateCard) {
    setPendingKey(card.key);
    startTransition(async () => {
      const result = await setDefaultTemplate(card.type, card.key);
      setPendingKey(null);
      if (result.ok)
        toast.success(
          `${result.data.name} is now the default ${TYPE_WORD[result.data.type]} template`,
        );
      else toast.error(result.error);
    });
  }

  const shown = cards.filter((card) => card.type === tab);

  return (
    <>
      <div className="mb-3.5">
        <ToggleGroup
          type="single"
          variant="segmented"
          size="segmented"
          value={tab}
          onValueChange={(next) => next && setTab(next as Tab)}
          aria-label="Board type"
        >
          <ToggleGroupItem value="FOREX">Forex</ToggleGroupItem>
          <ToggleGroupItem value="POF">POF</ToggleGroupItem>
          <ToggleGroupItem value="CRYPTO">Crypto</ToggleGroupItem>
          <ToggleGroupItem value="CUSTOM">Custom</ToggleGroupItem>
        </ToggleGroup>
      </div>

      {tab === "CUSTOM" ? (
        <EmptyState
          icon={LayoutTemplate}
          title="No custom templates yet"
          description="Custom boards aren’t available yet. Forex and POF templates are in the other tabs."
        />
      ) : (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(250px,1fr))] gap-[22px]">
          {shown.map((card) => (
            <article
              key={card.key}
              className="flex flex-col overflow-hidden rounded-2xl border border-border-default bg-bg-surface"
            >
              {/* The top of the board, as in the design (.tthumb). */}
              <div className="h-[330px] overflow-hidden bg-board-stage px-[38px] pt-[22px]">
                {card.sample ? (
                  <BoardFrame
                    templateKey={card.key}
                    snapshot={card.sample}
                    label={`${card.name} ${TYPE_WORD[card.type]} template preview`}
                    className="rounded-b-none shadow-[0_12px_30px_rgb(31_11_63/0.2)]"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center text-center text-[13.5px] text-text-secondary">
                    Add a rate to see a preview
                  </div>
                )}
              </div>
              <div className="flex flex-1 flex-col gap-2.5 px-[18px] pt-4 pb-[18px]">
                <h3 className="flex flex-wrap items-center gap-2 text-[16.5px] font-bold">
                  {card.name}
                  {card.isDefault && <Badge variant="brand">Default</Badge>}
                </h3>
                <p className="text-[13.5px] text-text-secondary">
                  {card.description}
                </p>
                <p className="text-[12.5px] text-text-muted">
                  1080 × 1920, fits up to {card.maxRows}{" "}
                  {ROW_NOUN[card.type].many}, version {card.version}
                </p>
                <div className="mt-auto flex flex-wrap gap-2 pt-1">
                  <Button asChild size="sm">
                    <Link
                      href={`/admin/generator?type=${card.type}&template=${card.key}`}
                    >
                      Use in generator
                    </Link>
                  </Button>
                  {!card.isDefault && (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={pendingKey !== null}
                      onClick={() => makeDefault(card)}
                    >
                      {pendingKey === card.key ? "Saving…" : "Set as default"}
                    </Button>
                  )}
                </div>
              </div>
            </article>
          ))}
          <div className="flex min-h-[300px] flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-border-input p-8 text-center text-text-secondary">
            <Layers
              aria-hidden="true"
              className="size-[26px] text-text-muted"
              strokeWidth={1.9}
            />
            <b className="text-text-primary">More designs</b>
            <span className="text-[13.5px]">
              New templates are added in code and appear here automatically.
            </span>
          </div>
        </div>
      )}
    </>
  );
}
