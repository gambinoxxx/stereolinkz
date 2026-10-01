import { SettingsForm } from "@/features/settings/components/SettingsForm";
import { BRAND_DEFAULTS } from "@/features/templates/theme";
import { getViewer, requireMember } from "@/lib/server/auth";
import { db } from "@/lib/server/db";

const ROLE_LABEL = {
  OWNER: "Owner",
  ADMIN: "Admin",
  EDITOR: "Editor",
  VIEWER: "Viewer",
} as const;

export default async function SettingsPage() {
  const { organizationId, role } = await requireMember();
  const [org, viewer] = await Promise.all([
    db.organization.findUniqueOrThrow({ where: { id: organizationId } }),
    getViewer().catch(() => ({ fullName: "You" })),
  ]);

  return (
    <SettingsForm
      initial={{
        name: org.name,
        contactLine: org.contactLine ?? "",
        email: org.email ?? "",
        // A colour that was never set shows the template's own.
        backgroundColor: org.backgroundColor ?? BRAND_DEFAULTS.backgroundColor,
        primaryColor: org.primaryColor ?? BRAND_DEFAULTS.primaryColor,
        accentColor: org.accentColor ?? BRAND_DEFAULTS.accentColor,
        timezone: org.timezone,
        defaultFinePrint: org.defaultFinePrint ?? "",
      }}
      logoUrl={org.logoUrl}
      member={{ name: viewer.fullName, role: ROLE_LABEL[role] ?? role }}
    />
  );
}
