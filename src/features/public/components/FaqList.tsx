"use client";

import { Plus } from "lucide-react";
import { useId, useState } from "react";

import type { Faq } from "@/features/public/content";

// Accordion: the first answer starts open. The answer fades in (opacity
// and transform only); its height changes at once.
export function FaqList({ items }: { items: Faq[] }) {
  const id = useId();
  const [open, setOpen] = useState<Set<number>>(() => new Set([0]));
  return (
    <div>
      {items.map((qa, k) => {
        const isOpen = open.has(k);
        return (
          <div key={qa.question} className={`qa${isOpen ? " open" : ""}`}>
            <h3>
              <button
                type="button"
                aria-expanded={isOpen}
                aria-controls={`${id}-${k}`}
                onClick={() =>
                  setOpen((s) => {
                    const next = new Set(s);
                    if (next.has(k)) next.delete(k);
                    else next.add(k);
                    return next;
                  })
                }
              >
                {qa.question}
                <span className="pm" aria-hidden="true">
                  <Plus size={18} strokeWidth={2.4} />
                </span>
              </button>
            </h3>
            <div className="ans" id={`${id}-${k}`} hidden={!isOpen}>
              <p>{qa.answer}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
