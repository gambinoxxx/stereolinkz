// The request header the proxy sets to the requested path and query, for
// requireMember()'s sign-in redirect. Kept apart from the proxy so the
// server can import it without the middleware.
export const PATH_HEADER = "x-rateboard-path";

// The login URL for a signed-out visit: back to the admin page afterwards,
// or plain /login for anything else. Only same-site /admin paths pass, so
// the header can never send someone to another site.
export function loginUrlFor(path: string | null): string {
  if (!path || !/^\/admin(?:[/?#]|$)/.test(path) || path.startsWith("//"))
    return "/login";
  return `/login?redirect_url=${encodeURIComponent(path)}`;
}
