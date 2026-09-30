import { forexDaylight } from "@/features/templates/forex/daylight";
import { forexPurpleSignal } from "@/features/templates/forex/purple-signal";
import { pofDaylight } from "@/features/templates/pof/daylight";
import { pofPurpleSignal } from "@/features/templates/pof/purple-signal";
import type { BoardTemplate, TemplateType } from "@/features/templates/types";

export class UnknownTemplateError extends Error {
  constructor(readonly key: string) {
    super(`Unknown board template: ${key}`);
    this.name = "UnknownTemplateError";
  }
}

// Templates are code; the database stores only key + version. Order is the
// order the Templates page and the generator list them.
const TEMPLATES: BoardTemplate[] = [
  forexPurpleSignal,
  forexDaylight,
  pofPurpleSignal,
  pofDaylight,
] as BoardTemplate[];

export function getTemplate(key: string): BoardTemplate {
  const template = TEMPLATES.find((t) => t.key === key);
  if (!template) throw new UnknownTemplateError(key);
  return template;
}

export function listTemplates<T extends TemplateType>(
  type: T,
): BoardTemplate<T>[] {
  return TEMPLATES.filter((t) => t.type === type) as BoardTemplate<T>[];
}

export function isTemplateKey(key: string, type?: TemplateType): boolean {
  return TEMPLATES.some((t) => t.key === key && (!type || t.type === type));
}

// The org's default for this type when it's registered, else the first.
export function resolveTemplateKey(
  type: TemplateType,
  org: {
    defaultForexTemplateKey: string | null;
    defaultPofTemplateKey: string | null;
  },
): string {
  const preferred =
    type === "FOREX" ? org.defaultForexTemplateKey : org.defaultPofTemplateKey;
  if (preferred && isTemplateKey(preferred, type)) return preferred;
  const first = listTemplates(type)[0];
  if (!first) throw new UnknownTemplateError(`${type.toLowerCase()}/*`);
  return first.key;
}
