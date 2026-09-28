// Normalised bank name, unique per organization. Blocks near-duplicates
// such as "Acme Bank" vs "AcmeBank" or "Acme Bank Plc" vs "Acme".
//
// Rule: lowercase, drop every non-alphanumeric character, then remove
// "bank", "plc" and "ltd". Removal runs on the joined string so that
// spacing differences ("Acme Bank" / "AcmeBank") produce the same slug.
// A name that is only those words gives "", which callers must reject.
export function bankSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")
    .replace(/bank|plc|ltd/g, "");
}
