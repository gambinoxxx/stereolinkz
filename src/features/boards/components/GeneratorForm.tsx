"use client";

import { Sparkles } from "lucide-react";
import {
  type ReactNode,
  useDeferredValue,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useForm, useWatch } from "react-hook-form";

import { Callout } from "@/components/callout";
import { Button } from "@/components/ui/button";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { ContentFields } from "@/features/boards/components/ContentFields";
import { PreviewPanel } from "@/features/boards/components/PreviewPanel";
import { RateRows } from "@/features/boards/components/RateRows";
import { TemplateOptions } from "@/features/boards/components/TemplateOptions";
import type { BoardType } from "@/features/boards/defaults";
import {
  changedFieldsByRow,
  defaultContent,
  type GeneratorFormValues,
  initialFormValues,
  rowLabels,
  validateGenerator,
} from "@/features/boards/generator-form";
import { buildPreviewSnapshot } from "@/features/boards/preview-snapshot";
import type { GeneratorData } from "@/features/boards/queries";

type GeneratorFormProps = {
  data: GeneratorData;
  type: BoardType;
  templateKey: string;
  renderedAt: string;
  onTypeRequest: (type: BoardType, dirty: boolean) => void;
  onTemplateChange: (key: string) => void;
  onStartOver: () => void;
};

function Step({
  n,
  title,
  aside,
  children,
}: {
  n: number;
  title: string;
  aside?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="border-b border-border-subtle px-4 py-[18px] sheet:px-[22px] sheet:py-5">
      <div className="mb-3.5 flex items-center gap-2.5">
        <span
          aria-hidden="true"
          className="grid size-6 shrink-0 place-items-center rounded-full bg-accent-soft text-[12.5px] font-bold text-accent-primary"
        >
          {n}
        </span>
        <h3 className="text-[15.5px] font-bold">{title}</h3>
        {aside && (
          <div className="ml-auto text-[13px] text-text-muted">{aside}</div>
        )}
      </div>
      {children}
    </section>
  );
}

// The four steps (generator.html) beside the live preview. The preview is
// built in the browser from the form on every keystroke: no network.
export function GeneratorForm({
  data,
  type,
  templateKey,
  renderedAt,
  onTypeRequest,
  onTemplateChange,
}: GeneratorFormProps) {
  const templates = data.templates.filter((t) => t.type === type);
  const template =
    templates.find((t) => t.key === templateKey) ?? templates[0]!;
  const entities = useMemo(
    () => ({ currencies: data.currencies, banks: data.banks }),
    [data.currencies, data.banks],
  );

  const { control, register, setValue, formState } =
    useForm<GeneratorFormValues>({
      defaultValues: initialFormValues(
        type,
        entities,
        data.org,
        template.key,
        template.maxRows,
      ),
    });
  const watched = useWatch({ control }) as GeneratorFormValues;
  const values = useMemo(
    () => ({ ...watched, templateKey: template.key }),
    [watched, template.key],
  );

  // The board's "Updated 10:25 AM" follows the clock; it starts from the
  // server's time so the first render matches.
  const [now, setNow] = useState(() => new Date(renderedAt));
  useEffect(() => {
    // Tick on the minute, as a clock would.
    let interval: ReturnType<typeof setInterval> | undefined;
    const tick = () => setNow(new Date());
    const timeout = setTimeout(
      () => {
        tick();
        interval = setInterval(tick, 60_000);
      },
      60_000 - (Date.now() % 60_000),
    );
    return () => {
      clearTimeout(timeout);
      clearInterval(interval);
    };
  }, []);

  const labels = useMemo(() => rowLabels(type, entities), [type, entities]);
  const errors = useMemo(
    () => validateGenerator(type, values, labels),
    [type, values, labels],
  );
  const changed = useMemo(
    () => changedFieldsByRow(type, entities, values.rows),
    [type, entities, values.rows],
  );
  const editedCount = values.rows.filter(
    (row) => row.included && changed.has(row.id),
  ).length;

  // Typing stays smooth on phones: the board re-renders at low priority.
  const deferred = useDeferredValue(values);
  const snapshot = useMemo(
    () => buildPreviewSnapshot(data.org, type, deferred, entities, now),
    [data.org, type, deferred, entities, now],
  );

  function resetContent() {
    const content = defaultContent(type, data.org);
    for (const field of Object.keys(content) as (keyof typeof content)[])
      setValue(`content.${field}`, content[field], { shouldDirty: true });
  }

  return (
    <div className="grid items-start gap-6 shell:grid-cols-[minmax(0,1fr)_400px]">
      <div className="rounded-panel border border-border-default bg-bg-surface">
        <Step n={1} title="Board type">
          <ToggleGroup
            type="single"
            variant="segmented"
            size="segmented"
            value={type}
            onValueChange={(next) =>
              next && onTypeRequest(next as BoardType, formState.isDirty)
            }
            aria-label="Board type"
          >
            <ToggleGroupItem value="FOREX">Forex</ToggleGroupItem>
            <ToggleGroupItem value="POF">POF</ToggleGroupItem>
          </ToggleGroup>
        </Step>

        <Step n={2} title="Template">
          <TemplateOptions
            templates={templates}
            value={template.key}
            brand={snapshot.content.brand}
            onChange={onTemplateChange}
          />
        </Step>

        <Step n={3} title="Rates" aside="Edited values turn gold">
          <RateRows
            type={type}
            rows={values.rows}
            entities={entities}
            control={control}
            register={register}
            changed={changed}
            fieldErrors={errors.fieldErrors}
            maxRows={template.maxRows}
          />
        </Step>

        <Step
          n={4}
          title="Content"
          aside={
            <Button
              type="button"
              variant="link"
              className="text-[13px]"
              onClick={resetContent}
            >
              Use default text
            </Button>
          }
        >
          <ContentFields
            type={type}
            register={register}
            fieldErrors={errors.fieldErrors}
          />
        </Step>

        <div className="sticky bottom-[calc(62px+env(safe-area-inset-bottom))] z-20 -mt-px flex flex-col gap-2.5 rounded-b-panel border-t border-border-default bg-bg-subtle px-4 py-3.5 shadow-[0_-8px_24px_rgb(31_11_63/0.08)] sheet:px-[22px] sheet:py-[18px] shell:static shell:border-t-0 shell:shadow-none">
          {errors.first && (
            <p
              role="alert"
              className="text-[13.5px] font-medium text-state-error"
            >
              {errors.first}
            </p>
          )}
          {editedCount > 0 && (
            <Callout tone="warn">
              {editedCount} edited {editedCount === 1 ? "rate" : "rates"} will
              be saved as current. The previous value stays in history.
            </Callout>
          )}
          <Button type="button" className="w-full" disabled={!!errors.first}>
            <Sparkles aria-hidden="true" strokeWidth={1.9} />
            Generate image
          </Button>
        </div>
      </div>

      <PreviewPanel
        templateKey={template.key}
        snapshot={snapshot}
        className="order-first shell:sticky shell:top-6 shell:order-none"
      />
    </div>
  );
}
