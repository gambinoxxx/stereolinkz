# Code Standards

## General

- Keep modules small and single-purpose. One feature folder per domain
  (`features/banks`, `features/pof-rates`, …).
- Fix root causes; do not layer workarounds.
- Do not mix unrelated concerns in one component, action or route.
- Build against the context files and the page designs in
  `docs/design/`. Do not invent behaviour they don't describe.
- Prefer the simplest solution that keeps the data model generic. If a
  change would name a specific bank or currency in code, it is wrong.
- User-facing text follows the page designs: sentence case, plain
  verbs, and actions named for what they do ("Save changes", "Generate
  image", "Deactivate"). Errors say what is wrong and how to fix it
  ("Sell must be the same as or higher than buy.").

## TypeScript

- `strict: true`. No `any`. Use explicit types, `unknown` plus
  narrowing, or Zod-inferred types.
- Validate every external input (form data, route params, search
  params, JSON from the database's `snapshot` column) with Zod at the
  boundary before using it.
- Derive types from Zod schemas (`z.infer`) and Prisma types rather
  than duplicating them.
- Rates: `Prisma.Decimal` on the server, `string` in props and
  snapshots. Convert with helpers in `lib/format.ts`. Never
  `parseFloat` a stored rate for arithmetic; use `Decimal` methods.
- Import `server-only` at the top of anything in `lib/server/`,
  `lib/render/`, and `features/*/queries.ts`.

## Next.js

- Next.js 16 App Router. Route protection lives in `proxy.ts` (not
  `middleware.ts`).
- Default to server components. Add `"use client"` only for
  interactivity: forms, drawers, switches, drag-to-reorder, and the
  generator's live preview.
- Reads go through `features/*/queries.ts`, called from server
  components. Writes go through server actions in
  `features/*/actions.ts`.
- Use route handlers only where a server action doesn't fit (the PNG
  download stream).
- After a mutation, `revalidatePath` every page that shows the changed
  data (for example, a rate edit revalidates `/admin`, the rate page
  and `/admin/generator`).
- The render path (`lib/render/*` and anything that imports it) runs on
  the Node.js runtime (`export const runtime = "nodejs"`), because
  resvg is a native module.
- The generator preview imports the same template component as the
  server render and scales it with CSS `transform: scale()`. Do not
  write a separate preview-only template.
- Loading states use `loading.tsx` or `useTransition` pending state.
  Every list has an empty state that tells the admin what to do next.

## Styling

- Admin UI uses Tailwind utility classes bound to the tokens in
  `ui-context.md` (defined once in `app/globals.css` under `@theme`).
  Utilities are the property prefix plus the token name: `bg-bg-base`,
  `text-text-secondary`, `border-border-default`. Named radius steps:
  `rounded-control` (10px), `rounded-panel` (14px), `rounded-modal`
  (18px), `rounded-sheet` (20px), plus `rounded-lg` (8px) and
  `rounded-2xl` (16px).
- Code is formatted with Prettier (default options). Run `npm run format`
  before committing; `npm run format:check` must pass. Specs
  (`context/`, `docs/`), generated code and `components/ui/` are ignored.
  No hard-coded hex values in admin components.
- Follow the radius, spacing and type scale in `ui-context.md`.
- Use shadcn/ui components (Button, Input, Select, Switch, Sheet,
  Dialog, Tabs, Sonner toasts) styled via tokens. Add them with the
  shadcn CLI.
- **Exception, board templates:** Satori supports only flexbox and a
  subset of CSS, so templates use inline `style` objects and read
  colours from `features/templates/theme.ts` (board tokens in
  `ui-context.md`). No Tailwind classes, CSS grid, `position: sticky`,
  or CSS variables inside templates.
- Numbers in tables and boards use tabular figures (`tabular-nums`).
- Mobile first. Every page must work at 390px wide. The generator's
  Generate bar stays visible on phones.

## Server Actions and Route Handlers

- The first line of logic is `const { organizationId, userId } = await requireMember();`.
- Parse input with the feature's Zod schema before any other logic.
- Return a consistent shape: `{ ok: true, data }` or
  `{ ok: false, error: string, fieldErrors?: Record<string, string> }`.
  Never throw raw errors to the client, and never expose Prisma or
  stack-trace messages.
- Map known failures to friendly messages: unique violations become
  "USD already exists. Edit it from the table instead."; a failed
  render becomes "The image couldn't be generated. Your rates were not
  changed. Try again."
- Every query includes `where: { organizationId }` (directly or through
  the parent relation).
- Multi-row writes (generate, rate plus status changes) use
  `prisma.$transaction`.

## Data and Storage

- Metadata and history live in PostgreSQL. Images and logos live in
  Vercel Blob. Never store image bytes or base64 in the database.
- Rates are inserted, never updated or deleted (see invariants in
  `architecture.md`).
- Status changes (activate/deactivate) update `Currency.status`,
  `Bank.status` or `Bank.pofActive`. They never touch rate rows.
- The current rate query takes the newest row per parent
  (`orderBy: { createdAt: "desc" }, take: 1`). The previous rate, used
  for change arrows, is the second-newest.
- Snapshots are written once through `boardSnapshotV1.parse()` and read
  back through the same schema. Bump `snapshotVersion` and add a new
  schema version if the shape changes; keep old versions readable.
- Validation rules (shared client/server Zod):
  - Currency code `^[A-Z]{3}$`, unique per organization
  - buy > 0, sell > 0, sell ≥ buy
  - POF rate 0–100, at most 2 decimal places
  - POF note ≤ 24 characters
  - Bank name required, and its slug unique per organization
  - Short name ≤ 14 characters
  - Logos: PNG, SVG or JPEG, ≤ 1 MB

## Testing

- Vitest, dev-only, for pure logic: formatting (`lib/format.ts`), slugs,
  Zod schemas, snapshot builders, and a render smoke test (a fixture
  snapshot renders to a 1080 × 1920 PNG).
- Test files sit next to the code: `format.test.ts`.
- No end-to-end framework in the MVP. UI is verified against the
  design files at 1440px and 390px, as listed in each phase of
  `implementation-plan.md`.
- Dates in tests are fixed values passed in. Never depend on the real clock.

## Git and Pull Requests

- One branch and one pull request per phase: `phase-<n>-<short-name>`
  (for example `phase-4-forex`).
- Commit each working piece inside the phase, imperative and naming
  the phase: `phase 4: insert ForexRate on save`.
- The PR description has the phase number, a summary, the completed
  Done-when list, and screenshots at 1440px and 390px of every page touched.
- Never commit `.env*` files, generated PNGs or `tmp/` render output.

## File Organization

- `app/` — routes and layouts only; thin pages that compose feature components
- `features/<domain>/` — `schema.ts`, `queries.ts`, `actions.ts`, `components/` for that domain
- `features/boards/` — snapshot schema, generate/regenerate actions, history queries
- `features/templates/` — template registry, template components, board theme tokens
- `lib/server/` — Prisma client, `requireMember`, Blob helpers (server-only)
- `lib/render/` — fonts, asset embedding, SVG and PNG rendering (server-only, Node runtime)
- `lib/format.ts` — number, percent, currency and Africa/Lagos date formatting
- `components/ui/` — shadcn/ui generated components (do not hand-edit)
- `components/shell/` — sidebar, mobile top bar, bottom tab bar, page header
- `components/board/` — scaled board preview frame and WhatsApp overlay
- `prisma/` — schema, migrations, seed
- `prisma.config.ts` — Prisma 7 config: datasource URL (from `.env.local`, then `.env`), migrations path, seed command
- `src/generated/prisma/` — generated Prisma client (gitignored; `postinstall` and `build` regenerate it). Import from `@/generated/prisma/client`, and only via `lib/server/db.ts` for queries
- `assets/fonts/` — Archivo WOFF files (latin + latin-ext) read by Satori on the server
- `docs/design/` — page design HTML files (reference only)
