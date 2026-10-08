import { MessageCircle } from "lucide-react";
import type { ReactNode } from "react";

// A call to action that opens WhatsApp (in a new tab) with the message
// already written. `mag` buttons follow a fine pointer (MotionRoot).
export function WhatsAppLink({
  href,
  variant,
  children,
  className = "",
  label,
}: {
  href: string;
  variant: "pri" | "vio" | "gold";
  children: ReactNode;
  className?: string;
  label?: string;
}) {
  return (
    <a
      className={`btn ${variant} mag ${className}`}
      href={href}
      target="_blank"
      rel="noopener"
      aria-label={label}
    >
      <MessageCircle strokeWidth={2.2} aria-hidden="true" />
      {children}
    </a>
  );
}
