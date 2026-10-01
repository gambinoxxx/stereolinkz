"use client";

import { Loader2, Sparkles } from "lucide-react";
import {
  type ReactNode,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import { useForm, useWatch } from "react-hook-form";

import { Callout } from "@/components/callout";
import { Button } from "@/components/ui/button";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { type GeneratedBoard, generateBoard } from "@/features/boards/actions";
import { ContentFields } from "@/features/boards/components/ContentFields";
import { GeneratedPanel } from "@/features/boards/components/GeneratedPanel";
import { PreviewPanel } from "@/features/boards/components/PreviewPanel";
import { RateRows } from "@/features/boards/components/RateRows";
import { TemplateOptions } from "@/features/boards/components/TemplateOptions";
import type { BoardType } from "@/features/boards/defaults";
import { boardFilename } from "@/features/boards/filename";
import {
  changedFieldsByRow,
  defaultContent,
  type GeneratorFormValues,
  initialFormValues,
  rowLabels,
  toGenerateInput,
  validateGenerator,
} from "@/features/boards/generator-form";
import type { Prefill } from "@/features/boards/prefill";
import { buildPreviewSnapshot } from "@/features/boards/preview-snapshot";
import type { GeneratorData } from "@/features/boards/queries";
import type { GeneratorErrors } from "@/features/boards/schema";

type GeneratorFormProps = {
  data: GeneratorData;
  type: BoardType;
  templateKey: string;
  renderedAt: string;
  onTypeRequest: (type: BoardType, dirty: boolean) => void;
  onTemplateChange: (key: string) => void;
  onStartOver: () => void;
  startingOver: boolean; // "Make another" is fetching current rates
  prefill: Prefill | null;
  notice: string | null;
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
  onStartOver,
  startingOver,
  prefill,
  notice,
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
      // Today's rows as the originals either way, so prefilled values
      // that differ from today's show gold.
      defaultValues:
        prefill?.values ??
        initialFormValues(
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
  const clientErrors = useMemo(
    () => validateGenerator(type, values, labels),
    [type, values, labels],
  );
  // A server refusal applies to the values it was sent; any edit clears it.
  const [serverErrors, setServerErrors] = useState<{
    values: GeneratorFormValues;
    errors: GeneratorErrors;
  } | null>(null);
  const errors =
    serverErrors?.values === values ? serverErrors.errors : clientErrors;

  const [pending, startTransition] = useTransition();
  const submitting = useRef(false); // blocks a second click or Enter at once
  const [generated, setGenerated] = useState<GeneratedBoard | null>(null);
  const locked = pending || generated !== null;

  function generate(event: React.FormEvent) {
    event.preventDefault();
    if (submitting.current || locked || clientErrors.first) return;
    submitting.current = true;
    const sent = values;
    startTransition(async () => {
      try {
        const result = await generateBoard(toGenerateInput(type, sent));
        if (result.ok) setGenerated(result.data);
        else
          setServerErrors({
            values: sent,
            errors: {
              first: result.error,
              fieldErrors: result.fieldErrors ?? {},
            },
          });
      } catch {
        setServerErrors({
          values: sent,
          errors: {
            first:
              "Couldn't reach the server. Check your connection and try again.",
            fieldErrors: {},
          },
        });
      } finally {
        submitting.current = false;
      }
    });
  }
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
    <>
      {notice && (
        <Callout tone="warn" className="mb-4">
          {notice}
        </Callout>
      )}
      <div className="grid items-start gap-6 shell:grid-cols-[minmax(0,1fr)_400px]">
        <form
          noValidate
          onSubmit={generate}
          aria-busy={pending}
          className="rounded-panel border border-border-default bg-bg-surface"
        >
          {/* Locked while generating and once generated, so the form keeps
            showing what the image shows. */}
          <fieldset disabled={locked} className="contents">
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
          </fieldset>

          <div className="sticky bottom-[calc(62px+env(safe-area-inset-bottom))] z-20 -mt-px flex flex-col gap-2.5 rounded-b-panel border-t border-border-default bg-bg-subtle px-4 py-3.5 shadow-[0_-8px_24px_rgb(31_11_63/0.08)] sheet:px-[22px] sheet:py-[18px] shell:static shell:border-t-0 shell:shadow-none">
            {generated ? (
              <GeneratedPanel
                board={generated}
                fileName={boardFilename(
                  snapshot.content.brand.name,
                  type,
                  generated.generatedAtLabel,
                )}
                onStartOver={onStartOver}
                startingOver={startingOver}
              />
            ) : (
              <>
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
                    {editedCount} edited {editedCount === 1 ? "rate" : "rates"}{" "}
                    will be saved as current. The previous value stays in
                    history.
                  </Callout>
                )}
                <Button
                  type="submit"
                  className="w-full"
                  disabled={!!clientErrors.first}
                  aria-disabled={pending || undefined}
                >
                  {pending ? (
                    <Loader2 aria-hidden="true" className="animate-spin" />
                  ) : (
                    <Sparkles aria-hidden="true" strokeWidth={1.9} />
                  )}
                  {pending ? "Generating image…" : "Generate image"}
                </Button>
              </>
            )}
          </div>
        </form>

        <PreviewPanel
          templateKey={template.key}
          snapshot={generated?.snapshot ?? snapshot}
          className="order-first shell:sticky shell:top-6 shell:order-none"
        />
      </div>
    </>
  );
}
