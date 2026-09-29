import { Badge } from "@/components/ui/badge";
import type { RecordStatus } from "@/generated/prisma/enums";

const CHIPS: Record<
  RecordStatus,
  { label: string; variant: "success" | "default" }
> = {
  ACTIVE: { label: "Active", variant: "success" },
  INACTIVE: { label: "Inactive", variant: "default" },
  ARCHIVED: { label: "Archived", variant: "default" },
};

// Status of a currency or bank: green dot for Active, grey otherwise.
export function StatusChip({
  status,
  className,
}: {
  status: RecordStatus;
  className?: string;
}) {
  const chip = CHIPS[status];
  return (
    <Badge variant={chip.variant} className={className}>
      <span aria-hidden="true" className="size-1.5 rounded-full bg-current" />
      {chip.label}
    </Badge>
  );
}
