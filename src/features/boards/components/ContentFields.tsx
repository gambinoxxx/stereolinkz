"use client";

import { useId } from "react";
import type { UseFormRegister } from "react-hook-form";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { BoardType } from "@/features/boards/defaults";
import type { GeneratorFormValues } from "@/features/boards/generator-form";
import { CONTENT_LIMITS } from "@/features/boards/schema";

type ContentFieldsProps = {
  type: BoardType;
  register: UseFormRegister<GeneratorFormValues>;
  fieldErrors: Record<string, string>;
};

// Step 4. The first error shows above Generate; fields only turn red.
export function ContentFields({
  type,
  register,
  fieldErrors,
}: ContentFieldsProps) {
  const id = useId();
  const invalid = (field: string) =>
    fieldErrors[`content.${field}`] ? true : undefined;

  return (
    <div className="flex flex-col gap-3.5">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`${id}-headline`}>Headline</Label>
        <Textarea
          id={`${id}-headline`}
          rows={2}
          aria-invalid={invalid("headline")}
          aria-describedby={`${id}-headline-hint`}
          className="min-h-0 resize-none"
          {...register("content.headline")}
        />
        <span
          id={`${id}-headline-hint`}
          className="text-[13px] text-text-muted"
        >
          Press Enter for a second line. Up to {CONTENT_LIMITS.headlineLine}{" "}
          characters a line.
        </span>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`${id}-sub`}>Subheading</Label>
        <Input
          id={`${id}-sub`}
          autoComplete="off"
          aria-invalid={invalid("subheading")}
          {...register("content.subheading")}
        />
      </div>
      {type !== "POF" && (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`${id}-note`}>
            {type === "CRYPTO" ? "Note in the card" : "Note under the rates"}
          </Label>
          <Input
            id={`${id}-note`}
            autoComplete="off"
            aria-invalid={invalid("note")}
            aria-describedby={type === "CRYPTO" ? `${id}-note-hint` : undefined}
            {...register("content.note")}
          />
          {type === "CRYPTO" && (
            <span
              id={`${id}-note-hint`}
              className="text-[13px] text-text-muted"
            >
              Use it for coins that aren’t on the board.
            </span>
          )}
        </div>
      )}
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`${id}-fine`}>Small print</Label>
        <Input
          id={`${id}-fine`}
          autoComplete="off"
          aria-invalid={invalid("finePrint")}
          {...register("content.finePrint")}
        />
      </div>
    </div>
  );
}
