import { PageHeader } from "@/components/shell/page-header";
import { TemplateGallery } from "@/features/templates/components/TemplateGallery";
import { getTemplateSamples } from "@/features/templates/queries";
import { requireMember } from "@/lib/server/auth";

export default async function TemplatesPage() {
  const { organizationId } = await requireMember();
  const cards = await getTemplateSamples(organizationId, new Date());

  return (
    <>
      <PageHeader
        title="Templates"
        description="Templates decide how a board looks. Your rates stay the same whichever one you pick."
      />
      <TemplateGallery cards={cards} />
    </>
  );
}
