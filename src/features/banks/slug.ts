// Normalised bank name, unique per organization. Blocks near-duplicates
// such as "Eco Bank" vs "Ecobank" or "Wema Bank Plc" vs "Wema".
//
// Rule: lowercase, drop every non-alphanumeric character, then remove
// "bank", "plc" and "ltd". Removal runs on the joined string so that
// spacing differences ("Eco Bank" / "Ecobank") produce the same slug.
// A name that is only those words gives "", which callers must reject.
export function bankSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")
    .replace(/bank|plc|ltd/g, "");
}
