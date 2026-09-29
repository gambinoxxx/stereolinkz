import type { ReactNode } from "react";

// Page title, one-line description and actions (dashboard.html .ph). On
// phones the actions stretch to full width.
export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-x-6 gap-y-4 shell:mb-[26px]">
      <div>
        <h1 className="text-[25px] leading-[1.1] font-[750] tracking-[-0.7px] font-stretch-[108%] shell:text-[30px]">
          {title}
        </h1>
        {description && (
          <p className="mt-1.5 max-w-[62ch] text-text-secondary">
            {description}
          </p>
        )}
      </div>
      {actions && (
        <div className="flex w-full flex-wrap gap-2.5 *:flex-1 shell:w-auto shell:*:flex-none">
          {actions}
        </div>
      )}
    </div>
  );
}
