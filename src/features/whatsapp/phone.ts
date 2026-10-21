// WhatsApp ids are the number in digits ("2348031234567"); deals store it
// normalised for display ("+234 803 123 4567"). Same number = same digits.
export const digitsOnly = (value: string) => value.replace(/\D/g, "");

export function sameNumber(waId: string, stored: string): boolean {
  const a = digitsOnly(waId);
  return a.length >= 8 && a === digitsOnly(stored);
}
