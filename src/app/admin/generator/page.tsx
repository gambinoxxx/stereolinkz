import { z } from "zod";

import { PageHeader } from "@/components/shell/page-header";
import { Generator } from "@/features/boards/components/Generator";
import { prefillFromSnapshot } from "@/features/boards/prefill";
import { getBoardSource, getGeneratorData } from "@/features/boards/queries";
import { isTemplateKey } from "@/features/templates/registry";
import { requireMember } from "@/lib/server/auth";

// generateBoard runs in this page's function: rendering takes ~0.5 s warm
// and the upload a little more, so 30 s leaves room for a cold start.
export const maxDuration = 30;

const first = (value: unknown) => (Array.isArray(value) ? value[0] : value);

const searchSchema = z.object({
  type: z.preprocess(first, z.enum(["FOREX", "POF", "CRYPTO"]).catch("FOREX")),
  template: z.preprocess(first, z.string().optional().catch(undefined)),
  // "Use these rates again" (history) links here with ?from=<boardId>.
  from: z.preprocess(first, z.string().optional().catch(undefined)),
});

export default async function GeneratorPage({
  searchParams,
}: PageProps<"/admin/generator">) {
  const { organizationId } = await requireMember();
  const params = searchSchema.parse(await searchParams);
  const [data, source] = await Promise.all([
    getGeneratorData(organizationId),
    params.from ? getBoardSource(organizationId, params.from) : null,
  ]);

  // ?from= prefills from the board's snapshot; its type wins over ?type=.
  const prefill = source
    ? prefillFromSnapshot(source.snapshot, source.templateKey, data)
    : null;
  const type = prefill?.type ?? params.type;
  // A key from the URL must be registered and of this type.
  const templateKey =
    prefill?.values.templateKey ??
    (params.template && isTemplateKey(params.template, type)
      ? params.template
      : data.defaultTemplates[type]);
  const notice =
    params.from && !prefill
      ? "That board couldn't be loaded. Showing current rates."
      : (prefill?.skippedNotice ?? null);

  return (
    <>
      <PageHeader
        title="Generator"
        description="Choose a board, check the preview, then generate a 1080 × 1920 image for WhatsApp Status."
      />
      <Generator
        data={data}
        initialType={type}
        initialTemplateKey={templateKey}
        renderedAt={new Date().toISOString()}
        prefill={prefill}
        notice={notice}
      />
    </>
  );
}
