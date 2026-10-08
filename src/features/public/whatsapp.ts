// Every call to action on the public site opens WhatsApp with a prefilled
// message, on the number saved in Settings (Organization.contactLine).
// "+234 903 591 4544" → https://wa.me/2349035914544?text=…
// With no number saved, the link still opens WhatsApp (the visitor picks
// the chat), rather than pointing nowhere.
export function whatsappLink(contactLine: string | null, text: string): string {
  const digits = (contactLine ?? "").replace(/\D/g, "");
  return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`;
}
