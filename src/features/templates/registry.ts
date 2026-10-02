import { cryptoDaylight } from "@/features/templates/crypto/daylight";
import { cryptoPurpleSignal } from "@/features/templates/crypto/purple-signal";
import { forexDaylight } from "@/features/templates/forex/daylight";
import { forexPurpleSignal } from "@/features/templates/forex/purple-signal";
import { pofDaylight } from "@/features/templates/pof/daylight";
import { pofPurpleSignal } from "@/features/templates/pof/purple-signal";
import type { BoardTemplate, TemplateType } from "@/features/templates/types";
import { assertNever } from "@/lib/assert-never";

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
  cryptoPurpleSignal,
  cryptoDaylight,
] as BoardTemplate[];

export function getTemplate(key: string): BoardTemplate {
  const template = TEMPLATES.find((t) => t.key === key);
  if (!template) throw new UnknownTemplateError(key);
  return template;
}

export function listTemplates<T extends TemplateType>(
  type: T,
): BoardTemplate<T>[] {
  return TEMPLATES.filter(
    (t) => t.type === type,
  ) as unknown as BoardTemplate<T>[];
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
    defaultCryptoTemplateKey: string | null;
  },
): string {
  const preferred = defaultKeyOf(type, org);
  if (preferred && isTemplateKey(preferred, type)) return preferred;
  const first = listTemplates(type)[0];
  if (!first) throw new UnknownTemplateError(`${type.toLowerCase()}/*`);
  return first.key;
}

// The org's saved default for a type (Templates page "Set as default").
function defaultKeyOf(
  type: TemplateType,
  org: {
    defaultForexTemplateKey: string | null;
    defaultPofTemplateKey: string | null;
    defaultCryptoTemplateKey: string | null;
  },
): string | null {
  switch (type) {
    case "FOREX":
      return org.defaultForexTemplateKey;
    case "POF":
      return org.defaultPofTemplateKey;
    case "CRYPTO":
      return org.defaultCryptoTemplateKey;
    default:
      return assertNever(type);
  }
}
