// A device's name in "Your devices", from its user agent: "iPhone ·
// Safari", "Android · Chrome", "Mac · Chrome". Good enough to tell a
// person's own devices apart; never used for anything else.
export function deviceLabel(userAgent: string): string {
  const ua = userAgent;
  const device = /iPhone/.test(ua)
    ? "iPhone"
    : /iPad/.test(ua) || (/Macintosh/.test(ua) && /Mobile\//.test(ua))
      ? "iPad"
      : /Android/.test(ua)
        ? "Android"
        : /Macintosh|Mac OS X/.test(ua)
          ? "Mac"
          : /Windows/.test(ua)
            ? "Windows"
            : /CrOS/.test(ua)
              ? "Chromebook"
              : /Linux/.test(ua)
                ? "Linux"
                : "Device";
  const browser = /EdgA?\//.test(ua)
    ? "Edge"
    : /SamsungBrowser\//.test(ua)
      ? "Samsung Internet"
      : /OPR\//.test(ua)
        ? "Opera"
        : /Firefox\/|FxiOS\//.test(ua)
          ? "Firefox"
          : /CriOS\/|Chrome\//.test(ua)
            ? "Chrome"
            : /Safari\//.test(ua)
              ? "Safari"
              : "Browser";
  // A Home Screen app on iOS reports no "Safari/" token.
  const iosApp =
    (device === "iPhone" || device === "iPad") && !/Safari\//.test(ua);
  return `${device} · ${iosApp ? "Home Screen app" : browser}`;
}
