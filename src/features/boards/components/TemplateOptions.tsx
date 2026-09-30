"use client";

import type { BoardContent } from "@/features/boards/build-snapshot";
import type { GeneratorTemplate } from "@/features/boards/queries";
import { boardTheme } from "@/features/templates/theme";
import { cn } from "@/lib/utils";

type TemplateOptionsProps = {
  templates: GeneratorTemplate[];
  value: string;
  brand: BoardContent["brand"];
  onChange: (key: string) => void;
};

// generator.html .tpl-opts: a swatch (the template's colours with the org's
// brand applied), name and description.
export function TemplateOptions({
  templates,
  value,
  brand,
  onChange,
}: TemplateOptionsProps) {
  return (
    <div className="grid grid-cols-1 gap-3 sheet:grid-cols-2">
      {templates.map((template) => {
        const theme = boardTheme(template.theme, brand);
        const selected = template.key === value;
        return (
          <button
            key={template.key}
            type="button"
            aria-pressed={selected}
            onClick={() => onChange(template.key)}
            className={cn(
              "flex items-center gap-3 rounded-xl border-[1.5px] border-border-default bg-bg-surface p-2.5 text-left transition-[border-color,box-shadow] hover:border-border-hover",
              "aria-pressed:border-accent-primary aria-pressed:bg-accent-soft/40 aria-pressed:ring-3 aria-pressed:ring-accent-primary/10",
            )}
          >
            <span
              aria-hidden="true"
              className="relative h-14 w-10 shrink-0 overflow-hidden rounded-md ring-1 ring-border-subtle ring-inset"
              style={{ background: theme.background }}
            >
              <i
                className="absolute top-[9px] left-1.5 h-1.5 w-3.5 rounded-[2px]"
                style={{ background: theme.wordmark }}
              />
              <i
                className="absolute inset-x-1.5 top-[22px] h-[22px] rounded-sm"
                style={{
                  background: theme.card,
                  boxShadow: theme.cardBorder
                    ? `inset 0 0 0 1px ${theme.cardBorder}`
                    : undefined,
                }}
              />
            </span>
            <span className="min-w-0">
              <b className="block text-[14.5px]">{template.name}</b>
              <span className="block text-[12.5px] leading-[1.3] text-text-muted">
                {template.description}
              </span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
