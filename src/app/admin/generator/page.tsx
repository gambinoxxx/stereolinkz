import { z } from "zod";

import { PageHeader } from "@/components/shell/page-header";
import { Generator } from "@/features/boards/components/Generator";
import { getGeneratorData } from "@/features/boards/queries";
import { isTemplateKey } from "@/features/templates/registry";
import { requireMember } from "@/lib/server/auth";

// generateBoard runs in this page's function: rendering takes ~0.5 s warm
// and the upload a little more, so 30 s leaves room for a cold start.
export const maxDuration = 30;

const first = (value: unknown) => (Array.isArray(value) ? value[0] : value);

const searchSchema = z.object({
  type: z.preprocess(first, z.enum(["FOREX", "POF"]).catch("FOREX")),
  template: z.preprocess(first, z.string().optional().catch(undefined)),
  // "Use these rates again" (Phase 8) links here with ?from=<boardId>. Read
  // now, prefilled in Phase 8.
  from: z.preprocess(first, z.string().optional().catch(undefined)),
});

export default async function GeneratorPage({
  searchParams,
}: PageProps<"/admin/generator">) {
  const { organizationId } = await requireMember();
  const { type, template } = searchSchema.parse(await searchParams);
  const data = await getGeneratorData(organizationId);
  // A key from the URL must be registered and of this type.
  const templateKey =
    template && isTemplateKey(template, type)
      ? template
      : data.defaultTemplates[type];

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
      />
    </>
  );
}
