# Architecture Context

## Stack

| Layer            | Technology                                   | Role |
| ---------------- | -------------------------------------------- | ---- |
| Framework        | Next.js 16 (App Router) + TypeScript (strict) | Pages, server components, server actions, route handlers |
| UI               | Tailwind CSS v4 + shadcn/ui + Lucide React    | Admin interface; tokens defined in `ui-context.md` |
| Forms            | React Hook Form + Zod                         | Client forms; the same Zod schemas validate on the server |
| Auth             | Clerk                                         | Sign-in and session. Authorization comes from our own `Membership` table |
| Database         | PostgreSQL + Prisma ORM                       | All records, rate history, board snapshots |
| File storage     | Vercel Blob                                   | Bank logos, organization logo, generated PNGs |
| Image rendering  | Satori (JSX → SVG) + `@resvg/resvg-js` (SVG → PNG) | Server-side board rendering at 1080 × 1920 |
| Hosting          | Vercel (Node.js runtime for rendering)        | App, server actions, render route |

No other state, data-fetching or background-job libraries. If a real
need appears, raise it in `progress-tracker.md` first.

## System Boundaries

```
src/
  app/
    (auth)/login/[[...login]]/    Clerk sign-in page
    admin/                        Protected pages: page, forex, pof, banks,
                                  templates, generator, history, settings
    api/boards/[id]/download/     Route handler that streams a board PNG with a download filename
  features/
    currencies/  forex-rates/  banks/  pof-rates/  boards/  settings/
                                  Each has: schema.ts (Zod), queries.ts
                                  (server-only reads), actions.ts (server
                                  actions), components/ (feature UI)
    boards/snapshot.ts            Zod schema + types for RateBoard.snapshot (the template contract)
    templates/                    registry.ts, types.ts, theme.ts, forex/*, pof/*,
                                  assets/flags/* (bundled flag SVGs)
  lib/
    server/                       db.ts (Prisma client), auth.ts (requireMember),
                                  blob.ts (Vercel Blob helpers). server-only.
    render/                       fonts.ts, assets.ts (logos/flags → data URIs),
                                  render-svg.ts, render-png.ts. server-only.
    format.ts                     Money, percent and date formatting (Africa/Lagos)
  components/
    ui/                           shadcn/ui generated components (protected)
    shell/                        Sidebar, mobile top bar, bottom tab bar, page header
    board/                        BoardFrame (scaled preview), WhatsAppOverlay
prisma/
  schema.prisma  seed.ts          Seed: the Stereolinkz org, the owner membership, sample currencies and banks
proxy.ts                          Clerk route protection (Next 16 replacement for middleware.ts)
docs/design/                      Page design HTML files (visual spec, read-only)
```

- `app/admin/*` pages are thin. They call `features/*/queries.ts` and
  render feature components. They hold no business logic.
- `features/*/actions.ts` is the only place that writes to the database.
- `features/templates/*` contains pure functions: snapshot in, JSX out.
  They never import Prisma, never fetch, and never read the clock.
- `lib/render/*` is the only code that turns template JSX into SVG/PNG.
  The generator preview and the server render use the same template
  component.

## Storage Model

- **PostgreSQL (via Prisma)**: organizations, memberships, currencies,
  banks, every forex and POF rate ever saved, rate boards with their
  JSON snapshot, and image metadata (Blob URL, pathname, size, format,
  template key and version).
- **Vercel Blob**: bank logos, the organization logo and generated
  PNGs. A blob is never overwritten; a new upload gets a new URL, so
  old snapshots keep pointing at the file they used. Board PNGs live at
  `boards/{organizationId}/{rateBoardId}/{imageId}.png`.
- **Code (git)**: templates, flag SVGs and fonts. The database stores
  only `templateKey` + `templateVersion`.

### Data model (see `prisma/schema.prisma`)

```
Organization ─┬─ Membership (clerkUserId, role)
              ├─ Currency ── ForexRate[]      (append-only)
              ├─ Bank ────── PofRate[]        (append-only)
              └─ RateBoard ── RateBoardImage[]
```

- **Organization**: name, slug, timezone (`Africa/Lagos`), quote
  currency (`NGN`), brand fields (logoUrl, backgroundColor,
  primaryColor for buy/rates, accentColor for sell/highlights,
  contactLine = WhatsApp number, email) and board defaults
  (defaultFinePrint, defaultForexTemplateKey, defaultPofTemplateKey).
  The MVP has exactly one, created by the seed.
- **Membership**: `(organizationId, clerkUserId)` unique, `role` enum
  (OWNER, ADMIN, EDITOR, VIEWER). The MVP treats every member as a full
  admin; the role is stored for later.
- **Currency**: `code` (ISO 4217, unique per org), name, symbol,
  `flagCode`, `sortOrder`, `status`.
- **Bank**: name, shortName, `slug` (normalized name, unique per org),
  logoUrl, sortOrder, `status`, `pofActive` (whether the bank's POF
  rate appears on new POF boards).
- **RecordStatus** enum on Currency and Bank: `ACTIVE` (shown and
  usable), `INACTIVE` (managed but hidden from new boards), `ARCHIVED`
  (soft-deleted; kept for history).
- **ForexRate**: `buy`, `sell` as `Decimal(14,4)`, `createdById`,
  `createdAt`. No `updatedAt`, because rows are never updated.
  `CHECK (sell >= buy)` is added in the migration SQL.
- **PofRate**: `rate` as `Decimal(5,2)` (3.40 = 3.4%), optional `note`,
  `createdById`, `createdAt`. Never updated.
- **Current rate** = the newest row per currency or bank (index on
  `[currencyId, createdAt desc]` / `[bankId, createdAt desc]`). There
  is no "current" flag to keep in sync.
- **RateBoard**: `type` (FOREX, POF, CUSTOM), `templateKey`,
  `templateVersion`, `snapshot` (JSON), `snapshotVersion`,
  `createdById`, `createdAt`. Created only by Generate. Never updated.
- **RateBoardImage**: `format` (`story` = 1080 × 1920), width, height,
  template key and version used, `blobUrl`, `blobPathname`, `byteSize`.
  Regenerating adds a row; it never replaces one.

### Snapshot (the template contract)

`features/boards/snapshot.ts` defines `boardSnapshotV1`, a Zod
discriminated union on `type`. A snapshot holds everything a template
needs, copied at generation time:

- `content`: headline, subheading, note, reach, ctaLabel, finePrint,
  dateLabel and timeLabel (already formatted in the org time zone), and
  brand (name, logoUrl, colours, contactLine)
- `rows`:
  - FOREX: code, name, flagCode, buy, sell
  - POF: name, shortName, logoUrl, rate, note
  - CUSTOM: label, value, note
- Decimal values stored as strings (`"1365.0000"`, `"3.40"`)
- `currencyId` / `bankId` kept for traceability only. They are never
  used to re-read live data when rendering.

### Generate flow (server action `generateBoard`)

1. `requireMember()`; parse input with Zod.
2. For each included row whose value differs from the current rate,
   prepare a new ForexRate / PofRate.
3. Build and validate the snapshot. Check the row count is within the
   template's `maxRows`.
4. Render PNG in memory (template → Satori SVG → resvg PNG).
5. Upload the PNG to Vercel Blob.
6. In one Prisma transaction, insert the new rates, the RateBoard and
   the RateBoardImage.
7. If the transaction fails, delete the uploaded blob (best effort) and
   return an error.
8. `revalidatePath` for the dashboard, the rate pages and history.
   Return `{ ok: true, boardId, imageUrl }`.

Regenerate runs steps 4–5 with the stored snapshot and a chosen
template, then inserts a RateBoardImage only.

## Auth and Access Model

- Every person signs in via Clerk. `proxy.ts` redirects signed-out
  visitors from `/admin/*` to `/login`.
- A Clerk session is not enough. `requireMember()` in
  `lib/server/auth.ts` looks up a `Membership` for the Clerk user. It
  returns `{ userId, organizationId, role }` or throws, which the app
  shows as a not-authorized page.
- Every server action, route handler and admin query starts with
  `requireMember()`. Every Prisma query filters by that
  `organizationId`.
- The MVP has one organization and one role level. Any member can do
  everything. The owner's membership is created by the seed (using the
  owner's Clerk user ID from an env var); no self sign-up grants access.
- Generated PNG and logo URLs are public but unguessable (Blob random
  suffix). This is acceptable because boards are posted publicly.

## Invariants

1. Banks and currencies are rows. No bank or currency name appears in
   the Prisma schema, in a type union, or as a hard-coded list in
   application code (seed data excepted).
2. ForexRate and PofRate rows are append-only: never `update`d, never
   `delete`d. Changing a rate means inserting a row.
3. RateBoard rows and their `snapshot` are immutable after creation.
4. Templates render only from a validated snapshot. They never import
   Prisma, call `fetch`, or read `Date.now()`.
5. History pages and regeneration read rates from the snapshot, never
   from current rate tables.
6. Currencies and banks with any rate history are never hard-deleted
   (`onDelete: Restrict` on rate relations). Delete is offered only
   when the history count is zero.
7. Every server action and route handler calls `requireMember()` before
   any read or write, and scopes queries by `organizationId`.
8. Final PNGs are produced by the server renderer (SVG → PNG), never by
   screenshotting the browser.
9. Board templates render at exactly 1080 × 1920. Important content
   stays inside the safe area (see `ui-context.md`).
10. Rate values are `Prisma.Decimal` on the server and strings across
    the server/client boundary. JavaScript floats are never used for
    stored rates.
11. Dates printed on boards use the organization time zone
    (`Africa/Lagos`), never the server's UTC clock.
12. Blob files are never overwritten. A replaced logo or image gets a
    new URL.
