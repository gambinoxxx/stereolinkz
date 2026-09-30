# Progress Tracker

Update this file after every meaningful implementation
change.

## Current Phase

- Phase 4: Forex, complete

## Current Goal

- None. Phase 5 has not started.

## Completed

- 2026-09-30: Phase 4 complete. All Done-when items checked, tagged
  phase-4-complete.
- 2026-09-30: Phase 4, reorder. `reorderCurrencies(ids)` checks the list is
  exactly the org's non-archived currencies (no missing, extra, foreign
  or duplicate ids; else "The list changed. Refresh and try again.") and
  writes `sortOrder` = index in one transaction. Desktop: native HTML5
  drag armed from the grip, 3px violet drop line, dragged row at 40%;
  optimistic, toast "Order saved. New boards use it." Up/down buttons
  ("Move USD up") show on touch screens and, for mouse users, when
  focused, so the keyboard can reorder. Verified: keyboard move GBP above
  USD and drag USD back both persist after reload; touch buttons at
  390px work; the Active filter hides grips and buttons and shows "Switch
  to All to change the order". Order restored to the seed's. Key files:
  `src/features/currencies/order.ts` (+ tests),
  `src/features/currencies/actions.ts`,
  `src/features/currencies/components/{ForexTable,ForexManager}.tsx`.
- 2026-09-30: Phase 4, status. `setCurrencyStatus` (ACTIVE / INACTIVE only,
  scoped update). The table switch is optimistic (`useOptimistic` +
  `useTransition`): verified it flips and dims in 4 ms while the server
  answers in ~600 ms ("QAA deactivated" / "activated"); the state
  survives a reload and the Active / Inactive filters list the right
  currencies; with a temporarily forced failure the switch reverted and
  showed an error toast (patch removed, file restored byte for byte).
- 2026-09-30: Phase 4, add currency. `CurrencyDrawer` (code auto-uppercase,
  symbol, name, flag picker with previews and "No flag", ₦ rates with the
  spread hint, active switch) creates the Currency and its first
  ForexRate in one `$transaction` through `createCurrency`. Verified: QAA
  (no flag) shows a code badge and sorts last; QAB (Nigeria flag,
  inactive) shows the flag, dimmed; lowercase "usd" → "USD already
  exists. Edit it from the table instead." on the code field; empty
  submit shows field errors. Matches `forex-add.html` at 1440px and 390px.
  Key files: `src/features/currencies/{schema,actions}.ts` (+ tests),
  `src/features/currencies/components/CurrencyDrawer.tsx`,
  `src/features/templates/assets/flags/index.ts` (`FLAG_OPTIONS`).
- 2026-09-30: Phase 4, edit rate. `ForexRateDrawer` (summary, ₦ inputs,
  live spread, last 4 changes) saves through `saveForexRate`, which
  inserts one ForexRate (`createdById` = the Clerk user) and never
  touches older rows. Verified: ForexRate rows 8 → 9 (USD 2 → 3; the two
  older USD rows identical before and after); USD 1365/1378 → 1370/1385
  shows ↑7 and "Today, 12:46 AM" without a reload; unchanged values →
  "No changes to save", nothing inserted, drawer stays open; sell below
  buy → red hint and field error; commas accepted; toast "CNY saved. The
  previous rate is in history."; tapping a phone card opens the drawer.
  Matches `forex-edit.html` at 1440px and 390px. Key files:
  `src/features/forex-rates/{schema,actions}.ts` (+ tests),
  `src/features/forex-rates/components/{ForexRateDrawer,SpreadHint}.tsx`,
  `src/lib/server/prisma-errors.ts`.
- 2026-09-29: Phase 4, forex list. `/admin/forex` lists non-archived
  currencies in board order with flag, buy, sell with `RateDelta`,
  spread (hidden 760–1100px), "Updated" in Lagos time, status switch and
  Edit; cards under 760px; All / Active / Inactive filter on `?status=`
  (Zod, unknown → All). Verified against the seed (USD 1,365 / 1,378 ↑4,
  GBP ↓5, EUR ↑5, spreads 13/25/23/17/6, "28 Sept") and `forex.html` at
  1440px and 390px. Key files: `src/features/currencies/{queries,status-filter}.ts`,
  `src/features/currencies/components/{ForexTable,ForexManager}.tsx`,
  `src/app/admin/forex/page.tsx`, `src/lib/format.ts` (+ tests).
- 2026-09-29: Phase 3 on production. Pushed `3b0ecea` with tag
  `phase-3-complete`; Vercel deployed it. The owner added a bank with a
  logo on https://stereolinkz-czj8.vercel.app/admin/banks and it worked,
  with only `BLOB_STORE_ID` set on Vercel: production Blob uploads use
  OIDC, no `BLOB_READ_WRITE_TOKEN` needed there.
- 2026-09-29: Phase 3 complete. All Done-when items checked, tagged
  phase-3-complete.
- 2026-09-29: Phase 3, end-of-phase visual check: `/admin/banks` and the
  add drawer match `banks.html` and `bank-add.html` at 1440px and 390px
  (the drawer's empty "?" is grey and the drop zone has no icon, as in
  the design).
- 2026-09-29: Phase 3, logo upload. Public Blob store `stereolinkz-blob`
  connected to `stereolinkz-czj8`. The bank drawer takes a logo (click or
  drag; live preview; "Remove logo"); actions take FormData and run
  validate → upload → DB write → delete the new blob if the write fails.
  Verified in the browser: upload shows in the list; each replace gets a
  new URL and the old file still loads; remove falls back to the
  monogram; a GIF, a 2 MB file, a 100px PNG and an SVG with `onload`
  each show a field error (client pre-check, and the server when the
  pre-check was temporarily bypassed); deleting the bank deleted its
  current logo blob and kept nothing else touched. Test blobs and banks
  cleaned up (store empty, 7 banks). Key files: `src/lib/image-check.ts`
  (+ tests), `src/lib/server/blob.ts`, `src/features/banks/actions.ts`,
  `src/features/banks/components/{BankDrawer,LogoField}.tsx`,
  `src/components/bank-mark.tsx`, `next.config.ts`.
- 2026-09-29: Phase 3, status and delete. Deactivate/Activate toggles
  `Bank.status` (toast, label flips, row dims); `deleteBank` re-checks the
  rate count inside a transaction and hard-deletes only when it is zero;
  confirmation dialog from `bank-delete.html` (bottom sheet on phones).
  Verified: a new bank deletes; deleting Wema Bank through the real action
  (button temporarily enabled, then reverted) returns "Deactivate this bank
  instead. It has rate history." and deletes nothing. Sample banks removed;
  the database is back to the seed's 7 banks. Key files:
  `src/features/banks/actions.ts`,
  `src/features/banks/components/{DeleteBankDialog,BanksManager}.tsx`.
- 2026-09-29: Phase 3, add and edit. `BankDrawer` (React Hook Form +
  `zodResolver(bankInput)`) adds and edits through `createBank` /
  `updateBank` (`safeAction`, scoped `where: { id, organizationId }`).
  Verified in the browser: empty name shows a field error; Enter saves;
  toast, drawer closes and the row appears without a reload; "Eco Bank"
  is rejected when "Ecobank" exists ("A bank called “Ecobank” already
  exists.", on add and on rename); the Active switch sets Inactive; a
  blank short name becomes the first word; new banks sort last. Key
  files: `src/features/banks/{schema,actions}.ts`,
  `src/features/banks/components/{BankDrawer,BanksManager}.tsx`,
  `src/lib/server/prisma-errors.ts`.
- 2026-09-29: Phase 3, bank list. `/admin/banks` lists every
  non-archived bank (one query: newest rate + `_count`) with BankMark,
  status chip, current POF rate and note, record count, and Edit /
  Deactivate / Delete (disabled with a tooltip when the bank has rate
  history). Cards under 760px; matches `banks.html` at 1440px and 390px;
  Zenith shows Inactive with "No rate". Key files:
  `src/features/banks/queries.ts`,
  `src/features/banks/components/BanksTable.tsx`,
  `src/app/admin/banks/page.tsx`.
- 2026-09-29: Phase 2 complete. All Done-when items checked, tagged
  phase-2-complete.
- 2026-09-29: Phase 2, visual and keyboard check (signed in as the owner
  in headless Chrome via a one-time Clerk sign-in token; session signed
  out after). All eight routes at 1440px and 390px: correct
  `aria-current` item in the sidebar and tab bar, sidebar hidden under
  900px with the top bar and tab bar shown, no horizontal scroll. The
  shell matches `dashboard.html`; the dev kit drawer matches
  `forex-edit.html` (460px right; bottom sheet at 390px). Escape closes
  the phone menu (from the menu button and More), the drawer and the
  dialog, and focus returns to the opener; a menu link navigates and
  closes the menu; focus rings are visible. Fixed: the phone menu did
  not return focus on close. Key file: `src/components/shell/mobile-menu.tsx`.
- 2026-09-29: Phase 2, app shell (built; visual check pending). Sidebar
  (brand, three nav groups, gold marker + `aria-current`, user block
  with Clerk name, membership role and sign-out), phone top bar, bottom
  tab bar (Home, Forex, POF, raised Generate, More → sidebar drawer
  from the left), `PageHeader`; `Toaster` and `TooltipProvider` in the
  admin layout; placeholder pages for all eight routes with the
  designs' titles and descriptions and an `EmptyState` naming the
  phase. Build, lint, types and 24 tests pass. Key files:
  `src/components/shell/*`, `src/app/admin/layout.tsx`,
  `src/app/admin/*/page.tsx`, `src/components/wordmark.tsx`.
- 2026-09-29: Phase 2, project components and dev kit. `InputAddon`,
  `StatusChip`, `RateDelta`, `CurrencyFlag`, `BankMark`, `EmptyState`,
  `Callout`, `EntityDrawer`; `/admin/dev-kit` shows every component and
  state with a working drawer (validation, pending, toast) and delete
  dialog; `notFound()` in production. Types, lint and 22 tests pass;
  visual check pending (needs `.env.local` in the Codespace). Key files:
  `src/components/*.tsx`, `src/lib/bank-mark.ts`,
  `src/app/admin/dev-kit/*`.
- 2026-09-29: Phase 2, UI primitives. shadcn button, input, select,
  textarea, switch, checkbox, sheet, dialog, toggle-group (+ toggle),
  tabs, sonner, tooltip, badge, skeleton, label, tailored to the design
  (buttons 40/32/34px; inputs 42px with a violet ring; green switch;
  460px right drawer and bottom sheet; modal as a bottom sheet under
  760px; segmented toggle group; ink toast with gold icon). Control and
  bank-mark tokens, breakpoints, focus outline and reduced motion in
  `globals.css`; `useMediaQuery`. Visual check pending in the dev kit.
  Key files: `src/components/ui/*`, `src/app/globals.css`,
  `src/hooks/use-media-query.ts`, `src/lib/utils.ts`.
- 2026-09-29: Phase 2, formatting and tests. Vitest 4 with `npm test` /
  `test:watch`; `formatRate`, `formatBoardPrice`, `formatPercent`,
  `formatPoints`, `formatBoardDate`, `formatBoardTime`, `formatLongDate`,
  `formatDayHeading`, `isSameOrgDay`; `toDecimalString`,
  `compareDecimalStrings`, `subtractDecimalStrings`. 19 tests pass,
  including the Lagos midnight edge and the bank slug rule. Key files:
  `vitest.config.mts`, `src/lib/format.ts`, `src/lib/decimal.ts`,
  `src/lib/*.test.ts`, `src/features/banks/slug.test.ts`.
- 2026-09-29: Phase 1 complete. All Done-when items checked, tagged
  phase-1-complete. Two are carried forward, not failed: the warm
  render (2.3–2.7 s on Vercel, target under 2 s) is fixed by the card
  shadow decision in Phase 6; the second-account block was confirmed
  locally and still needs one check on production.
- 2026-09-29: Phase 1, render spike on Vercel. Production
  `/api/dev/render-spike` shows ₦, the US/GB/EU flags and the heavy
  headline. `X-Render-Ms` 2317 ms then 2686 ms (the reload likely hit a
  new instance, so both count as cold; no warm figure below 2 s).
- 2026-09-29: Phase 1, deploy. The owner fast-forward merged
  `phase-1-foundation` into `main` and pushed; Vercel project
  `stereolinkz-czj8` deploys `main` (a duplicate project was deleted).
  First deploys failed with `P1001 Can't reach database server at base`:
  `DATABASE_URL` had been pasted with the quotes from `.env.local`;
  without quotes it works. `/login` and `/admin` work on production:
  https://stereolinkz-czj8.vercel.app
- 2026-09-28: Phase 1, render spike (local). `/api/dev/render-spike`
  renders the fixture to a PNG: IHDR says 1080 × 1920; ₦, all six flags
  and weights 800/900 render; 401 JSON when signed out. Not yet run on
  Vercel. Key files: `src/lib/render/*`, `src/features/templates/theme.ts`,
  `src/features/templates/forex/purple-signal.tsx`,
  `src/features/templates/assets/flags/index.ts`,
  `src/app/api/dev/render-spike/*`, `assets/fonts/`,
  `scripts/copy-fonts.mjs`, `scripts/png-size.mjs`.
- 2026-09-28: Phase 1, membership guard. Owner confirmed locally: signed in,
  `/login` → `/admin`; the owner sees `/admin`; a second Clerk account
  lands on `/not-authorized`. Key files: `src/lib/server/auth.ts`,
  `src/lib/server/action.ts`, `src/app/not-authorized/page.tsx`.
- 2026-09-28: Phase 1, owner membership. `SEED_OWNER_CLERK_USER_ID` set in
  `.env.local`; seed re-run created the OWNER Membership (other counts
  unchanged).
- 2026-09-28: Phase 1, authentication. Clerk sign-in at `/login` matching
  `login.html` at 1440px and 390px (tilted board deferred to Phase 6);
  signed out, `/admin` → `/login`; signed in, `/login` → `/admin`; `/` →
  `/admin`. Key files: `src/proxy.ts`, `src/app/layout.tsx`,
  `src/app/(auth)/login/[[...login]]/page.tsx`, `src/app/admin/layout.tsx`,
  `src/components/wordmark.tsx`.
- 2026-09-28: Phase 1, seed. `npm run db:seed` is idempotent (two runs:
  Organization 1, Membership 0, Currency 5, ForexRate 8, Bank 7,
  PofRate 8). Key files: `prisma/seed.ts`, `src/features/banks/slug.ts`.
- 2026-09-28: Phase 1, database. Prisma 7.10 wired (prisma-client generator,
  `prisma.config.ts`, `@prisma/adapter-pg`); first migration `init` applied
  to Neon with the `forex_sell_gte_buy` and `pof_rate_range` CHECK
  constraints; an insert with sell < buy fails on `forex_sell_gte_buy`.
  Key files: `prisma/schema.prisma`, `prisma.config.ts`,
  `prisma/migrations/*_init`, `src/lib/server/db.ts`.
- 2026-09-28: Phase 1, project setup. Archivo (latin + latin-ext, wdth
  axis) as `--font-sans`, admin tokens and radius scale in `@theme`,
  shadcn initialised and mapped to our tokens (no components), Prettier,
  `.env.example`, README, ₦ placeholder page. Key files:
  `src/app/globals.css`, `src/app/layout.tsx`, `components.json`,
  `.prettierrc.json`.
- 2026-09-28: Phase 1, project kit added: `context/`,
  `prisma/schema.prisma`, `src/features/boards/snapshot.ts`; the stale
  unit-based copies in `docs/*.md` removed.

## In Progress

- Nothing in progress.

## Next Up

- Phase 4 on production (after the push): owner edits one rate on the
  live site and checks the toast, the delta and the history
- Phase 5: POF list (`features/pof-rates/queries.ts` `listPofRates`,
  `PofTable`, callout for active banks with no rate)
- Phase 5: edit and add (`pofRateInput`, `savePofRate`, `PofRateDrawer`)
- Phase 6: rewrite Satori's box-shadow filter region in
  `lib/render/render-svg.ts` (card shadow decision, 2026-09-29), with a
  render test that fails if a Satori upgrade changes the filter output

## Open Questions

- Second-account block on production: confirmed locally only. The owner
  should sign in with the second account at
  https://stereolinkz-czj8.vercel.app/admin and see `/not-authorized`.
- Secrets pasted in chat (Neon `neondb_owner` password, Clerk secret
  key): the owner chose to rotate them at the end of the project. Must
  be done in Phase 10 before launch, in `.env.local` and in Vercel (no
  quotes), then redeploy.

- Stereolinkz logo file: until it is uploaded, boards use the
  equalizer-bar wordmark. Needed by Phase 9.
- Who else needs access at launch? Their Clerk user IDs are needed
  for memberships. Needed by Phase 10.

## Architecture Decisions

- 2026-09-28: Prettier added (owner approved), default options, with
  `format` / `format:check` scripts. `context/`, `docs/`, generated code,
  `components/ui/` and the kit's `snapshot.ts` are excluded so specs
  and generated files are never reformatted.
- 2026-09-28: shadcn initialised with the Radix base and the "nova"
  preset (Lucide icons). This CLI version adds `cn` (instead of
  clsx + tailwind-merge), `class-variance-authority`, `radix-ui`,
  `lucide-react` and `tw-animate-css`. The `shadcn` package itself is a
  dev dependency, needed only for the `shadcn/tailwind.css` import. The
  generated `button.tsx` was removed; components come in Phase 2.
- 2026-09-28: Token naming. Raw tokens keep their `ui-context.md` names
  in `:root`; `@theme` exposes them as `--color-<token>` (`bg-bg-base`).
  shadcn variables are aliases of our tokens. No dark theme, chart or
  sidebar palette from shadcn. Radius adds named steps (`rounded-control`
  10px, `rounded-panel` 14px, `rounded-modal` 18px, `rounded-sheet` 20px).
  Recorded in `code-standards.md` → Styling.
- 2026-09-28: Prisma 7.10.0 (latest stable 7.x), pinned to `^7`. npm's
  `latest` tag for `prisma` pointed at 8.0.0-rc, which we skip. Wiring:
  `prisma-client` generator → `src/generated/prisma` (gitignored,
  generated by `postinstall` and `build`), URL in `prisma.config.ts`,
  runtime via `@prisma/adapter-pg`. `prisma.config.ts` and the seed load
  `.env.local` then `.env` (same precedence as Next.js).
- 2026-09-28: Seed runs with `tsx` via `migrations.seed` in
  `prisma.config.ts` (Prisma 7 no longer reads `package.json#prisma.seed`).
- 2026-09-28: Bank slug rule: lowercase, drop non-alphanumerics, then
  remove "bank", "plc", "ltd" from the joined string, so "Eco Bank" and
  "Ecobank" both give `eco`. A name made only of those words gives ""
  and must be rejected by Phase 3's validation.
- 2026-09-28: The seed never overwrites existing parents (`update: {}`),
  so Settings and bank/currency edits made in the app survive a re-run.
  Currency `symbol` is left null (not specified in the seed data).
- 2026-09-28: Clerk 7 (`@clerk/nextjs` 7.9). `src/proxy.ts` is plain
  `clerkMiddleware()`; protection is next to the data (`architecture.md`
  → Auth updated). Clerk CSS sits in a `clerk` cascade layer
  (`cssLayerName`) so Tailwind utilities restyle `<SignIn />`. Copy set
  through `localization` (v7 shows the "combined" title keys). Clerk 7
  removed `appearance.layout`; its defaults already give the design's
  single Google block button on top.
- 2026-09-28: Login brand panel colours added as `--brand-panel-*` tokens
  (reuse of Purple Signal board colours), recorded in `ui-context.md`.
- 2026-09-28: The placeholder admin header has a sign-out button so the
  second-account check can be run; the real shell replaces it in Phase 2.
- 2026-09-28: `requireMember()` reads through a React `cache()`d lookup,
  so a request queries Membership once however many times it is called.
  `getMember()` shares that lookup and returns null (no user or no
  membership) for route handlers. `safeAction()` calls `requireMember()`
  before its try block and uses `unstable_rethrow` so redirects inside an
  action still work; other errors are logged and replaced with "Something
  went wrong. Try again."
- 2026-09-28: Render spike built locally before Deploy (owner asked to
  hold Vercel). The spike's Done-when item still needs the Preview, so
  Phase 1 stays open until Deploy is done and the PNG is confirmed there.
- 2026-09-28: Render pipeline. Satori 0.33 + resvg-js 2.6. Both are in
  `serverExternalPackages`: resvg is native, and Satori's harfbuzzjs reads
  `hb.wasm` from its package folder (bundled, the path broke at build).
  resvg runs with `loadSystemFonts: false` (Satori emits text as paths;
  the system font scan cost ~2.3 s per render). Fonts are traced into the
  route with `outputFileTracingIncludes` (key must list each render route).
- 2026-09-28: Satori fonts: `latin` WOFFs registered as "Archivo",
  `latin-ext` WOFFs as "Archivo latin-ext". Registering both as "Archivo"
  (the original plan) drew ₦ as a missing glyph: Satori only falls back
  between different names. Recorded in `ui-context.md` → Typography.
- 2026-09-28: Flags: us/gb follow the design; eu uses the star version
  from `login.html`; ca/cn/ng are simplified drawings in the same 60×60
  style (the design has none). `flagDataUri` returns null for unknown
  codes; templates show a plain circle then.
- 2026-09-28: The spike fixture (`render-spike/fixture.ts`) hard-codes
  USD/GBP/EUR sample rows as the prompt asked. Treated like seed data (an
  exception to Invariant 1) and deleted with the route in Phase 6. Its
  subheading adds "(₦)" only to prove the glyph renders.
- 2026-09-29: Board card shadow: keep it and rewrite the filter region
  after Satori (owner chose option 2 of 3). Vercel production measured
  2317 ms and 2686 ms with the shadow as is (target under 2 s); local
  timings were keep ~2.1 s, rewrite ~0.6 s, drop ~0.3 s (Vercel est.
  ~0.8 s for the rewrite). Why: the board keeps its designed look and
  renders well under the target. Fallback if a Satori upgrade breaks the
  rewrite: drop the card shadow. Built in Phase 6.
- 2026-09-29: Work on `main` only until launch; push after checks pass;
  tag each phase. Why: solo build, branches added steps and caused a
  deploy mix-up. Recorded in `code-standards.md` → Git,
  `implementation-plan.md` → How to use this plan and Branching and
  review, and `ai-workflow-rules.md` → Updating the Progress Tracker.
- 2026-09-29: Vercel is production, not a Preview. Phase 1's "Vercel
  Preview" checks were run on production (`stereolinkz-czj8`, deploys
  `main`).
- 2026-09-29: Vitest pinned to `^4` (4.1.11), not 5: Vitest 5 needs
  `@types/node` 22+, and the project pins `^20`. Config is
  `vitest.config.mts` (ESM, so Vite loads it without a warning).
- 2026-09-29: Dates in `lib/format.ts` take numeric parts from
  `Intl.DateTimeFormat#formatToParts` in the org zone (`hourCycle: h23`)
  and build the text with our own month and weekday names ("Sept", a
  normal space before AM/PM). The weekday comes from the zoned calendar
  date. Why: ICU text differs between Node and browsers, and the PNG and
  the preview must match. Added `formatLongDate` ("Sunday, 27 September
  2026") for the dashboard subtitle and day headings.
- 2026-09-29: `subtractDecimalStrings` added to `lib/decimal.ts` for
  change arrows (RateDelta). It subtracts scaled BigInts, never floats.
- 2026-09-29: shadcn components were tailored in one pass right after
  generation: the generated sizes (32px buttons and inputs), neutral
  variants and `next-themes` Toaster don't match the design, and cva
  variants live inside the files, so wrapping each primitive would split
  its styling in two. Changes: button variants/sizes (default, outline,
  ghost, destructive, link; 40px, sm 32px, icon 34px); input, textarea
  and select trigger at 42px with a violet ring; switch 34×20, green
  when on; checkbox 18px violet; badge as the design's chip (default,
  success, brand, gold, destructive); a `segmented` toggle variant;
  tabs in the same look; sheet 460px right / 272px left / bottom sheet
  with `rounded-sheet`; dialog `rounded-modal`, a bottom sheet under
  760px; label, skeleton, overlay colours. From here on
  `components/ui/*` is protected again: changes go through
  className/variants, or a new Decision entry.
- 2026-09-29: `next-themes` removed (added by the shadcn Sonner
  template). The admin is light only; the Toaster sets `theme="light"`.
- 2026-09-29: New tokens from the design files' component styles:
  `--control-off`, `--segmented-bg`, `--bg-hover`, `--border-hover`,
  `--overlay`, `--sidebar-avatar`, `--toast-offset`, and the
  `--bank-mark-1…6` palette (the designs' 7 monogram colours minus
  `#2A0F58`). Breakpoints `sheet` 760px and `shell` 900px. Recorded in
  `ui-context.md`.
- 2026-09-29: `@/lib/utils` `cn` is `createCn` from `cn/config` with our
  radius names, so project components can override `rounded-*`.
  Generated `components/ui` files keep importing `cn` from `"cn"`.
- 2026-09-29: `BankMark` colour: FNV-1a hash of the slug mod 6 over
  `--bank-mark-1…6` (`src/lib/bank-mark.ts`, tested), so a bank keeps
  its colour everywhere. Monogram is the first letter or digit.
- 2026-09-29: Flags and logos use `next/image` with `unoptimized` (data
  URIs and small Blob logos gain nothing from optimisation, and no
  `remotePatterns` entry is needed for Blob).
- 2026-09-29: The dev kit uses sample props (USD/GBP/EUR flag codes,
  made-up bank names), like the spike fixture: dev only, removed in
  Phase 10.
- 2026-09-29: Shell: the sidebar content is one server component used
  twice (the fixed desktop aside and the phone menu drawer). Only
  `NavLinks`, `MobileTopBar`, `BottomTabBar` and `MobileMenuProvider`
  are client components; the provider shares the drawer's open state
  between the menu button and More. Following a link closes the drawer.
- 2026-09-29: Dashboard placeholder title is "Good day, <first name>"
  from Clerk (`getViewer()`, React-cached). The design's date prefix
  needs the org time zone from the database, so it waits for Phase 9.
  Its two header links (Update rates, Generate board) are kept: they
  are navigation, not data.
- 2026-09-29: Focus outline is gold on the dark sidebar and top bar
  (violet is too faint there); recorded in `ui-context.md`.
- 2026-09-29: `Wordmark` takes a size (lg login, md sidebar, sm top
  bar) with the bar heights from the designs.
- 2026-09-29: Phase tags are annotated (`git tag -a`) so
  `--follow-tags` pushes them; recorded in `code-standards.md` → Git.
- 2026-09-29: The phone menu drawer has no `SheetTrigger` (the menu
  button and More both open it), so Radix could not return focus on
  close. `MobileMenuProvider` remembers the opener and refocuses it in
  `onCloseAutoFocus`, except when a link closed the menu (focus then
  belongs to the new page). No `components/ui` file changed.
- 2026-09-29: Banks table: the design hides the Deactivate button on
  phones (`.t-bank .c-act .btn.ghost:not(.icon){display:none}`); status
  is changed there through the drawer's Active switch. Column headers are
  visual only; each cell has its own label, visible on phones and
  screen-reader-only on desktop.
- 2026-09-29: React Hook Form 7.89 and `@hookform/resolvers` 5.9 added
  (agreed stack). Installed with `npx npm@11 install` so the lockfile keeps
  its `libc` fields; use npm 11 for every install on the owner's Mac.
- 2026-09-29: Bank form rules: name trimmed, required, ≤ 60, and its slug
  must not be empty ("Enter a bank name, not just “Bank”."); short name ≤ 14,
  blank → first word of the name (cut to 14). New banks get
  `sortOrder` = current max + 1 (they appear last until reordering exists).
- 2026-09-29: A duplicate slug names the bank that already has it ("A bank
  called “Ecobank” already exists." when "Eco Bank" is entered), so the
  admin knows which row to edit. The P2002 is caught in the action, not
  pre-checked, so two simultaneous saves cannot both pass.
- 2026-09-29: The add drawer's placeholders are "Full bank name" and "Name
  on boards" instead of the design's "Access Bank" / "Access": no bank name
  in code (Invariant 1).
- 2026-09-29: `BanksManager` (client) owns the drawer state and renders
  the page header, table and drawer; `BanksTable` stays presentational.
  Pages revalidated after a bank change: `/admin/banks`, `/admin/pof`,
  `/admin`.
- 2026-09-29: `deleteBank` refuses on two layers: the rate count checked
  inside `$transaction`, and the Restrict foreign key (P2003, mapped to the
  same message) if a rate lands between the check and the delete.
  `setBankStatus` accepts only ACTIVE / INACTIVE; ARCHIVED is not used by
  the UI and the list hides it.
- 2026-09-29: Blob store is public (boards and logos are posted
  publicly; URLs are unguessable). Auth: `@vercel/blob` 2.8 resolves an
  explicit token, then OIDC (`VERCEL_OIDC_TOKEN` + `BLOB_STORE_ID`), then
  `BLOB_READ_WRITE_TOKEN`. Connecting the store added `BLOB_STORE_ID` (and
  an unused `BLOB_WEBHOOK_PUBLIC_KEY`) to Vercel but no token, so
  production uses OIDC (project OIDC federation must stay on); locally the
  read-write token in `.env.local` is used. Confirmed on production by a
  live logo upload. Fallback if that ever breaks: add
  `BLOB_READ_WRITE_TOKEN` to Vercel (no quotes).
- 2026-09-29: Server Action body limit raised to 2 MB with
  `experimental.serverActions.bodySizeLimit: "2mb"` (the option name in
  the installed Next 16 docs), so a 1 MB logo plus form fields and
  multipart overhead fits.
- 2026-09-29: Logo checks read the bytes, not the MIME type
  (`lib/image-check.ts`, pure, shared by the drawer's pre-check and
  `validateImage` on the server): ≤ 1 MB; PNG / JPEG by magic bytes with
  the size read from the header, shortest side ≥ 256 px (so logos stay
  sharp at the board's 80px mark and the admin's 44px mark on 2×
  screens); SVG only if it has no `<script>`, `on…=` attributes,
  `<foreignObject>`, DOCTYPE/ENTITY, `javascript:`, `@import` or
  references other than `#id` (`href`, `url()`), because SVGs are served
  from a public URL and could run code if opened directly. Square is
  recommended in the hint, not enforced (marks crop to a circle).
- 2026-09-29: Replacing a logo keeps the old blob (board snapshots copy
  `logoUrl`, so an old board must keep its file). Removing a logo only
  clears `logoUrl`. Deleting a bank deletes its current logo blob after
  the DB delete (with no rates it is in no snapshot).
- 2026-09-29: A duplicate name is checked before uploading, so a
  rejected save doesn't upload a file first; the unique index still
  decides, and a failed write deletes the new upload.
- 2026-09-29: `BankMark` became a client component so a logo that fails
  to load falls back to the monogram (it remembers the failed URL).
- 2026-09-29: The drawer keeps the logo file in the React Hook Form values
  (`bankInput.extend({ logo, removeLogo })`, client only), so `reset()` on
  open clears it with the text fields and server `logo` errors map onto
  the field.
- 2026-09-29: `listCurrenciesWithRates` takes the latest 4 ForexRate rows
  per currency in the list query: [0] is the current rate, [1] the
  previous one for the change arrow, and all four are the edit drawer's
  "Recent changes", so opening the drawer needs no extra fetch. Rates
  cross to the client as decimal strings and dates as ISO strings.
- 2026-09-29: "Updated" is `formatUpdatedAt(date, now, tz)`: "Today,
  10:25 AM" when the rate is from today in the org zone, else "22 Sept";
  the year is added when it differs from the current one ("31 Dec 2025"),
  so an old rate never reads as recent. `now` comes from the server
  render, so the client shows the same text. History rows use
  `formatShortDateTime` ("27 Sept, 10:25 AM").
- 2026-09-29: Segmented filters must not pass `spacing={0}` to
  `ToggleGroup`: the generated item then applies `px-2` through a
  group-variant class that outranks the segmented size's `px-3.5`. Removed
  from the forex filter and the dev kit demo; no `components/ui` change.
- 2026-09-29: New token `--grip` (`#B9B0CB`, `text-grip`) for drag
  handles, from `forex.html`; recorded in `ui-context.md`.
- 2026-09-30: Rate input is normalised before validation: trim, remove
  spaces and thousands commas ("1,365" → "1365"), then
  `^\d{1,10}(\.\d{1,4})?$` (fits `Decimal(14,4)`). buy > 0, sell > 0 and
  sell ≥ buy are one shared `checkRatePair` refinement (also used by the
  add-currency form). Zod 4 runs object refinements even after a field
  failed, so the pair check skips values that aren't decimals.
  `normaliseDecimal` / `isDecimal` are shared with the live spread hint.
- 2026-09-30: The DB CHECK `forex_sell_gte_buy` is a safety net behind
  Zod: Prisma 7 with the pg adapter reports it as P2039 with
  `meta.driverAdapterError.cause.originalCode = "23514"`;
  `isCheckViolation(error, constraint)` maps it to the sell field error.
- 2026-09-30: Unchanged rates (decimal-equal buy and sell) return
  `unchanged: true` and insert nothing; the drawer stays open with "No
  changes to save".
- 2026-09-30: The add-currency flag picker defaults to "No flag" (the
  design's select starts on United States), so a new currency never gets
  a wrong flag by default. Flag labels live next to the flag SVGs
  (`FLAG_OPTIONS`, keyed by flag code); "No flag" uses a `none` sentinel
  because Radix Select items can't have an empty value. Placeholders are
  "3 letters", "Optional" and "Name on boards" instead of the design's
  "CAD", "$" and "Canadian dollar" (Invariant 1).
- 2026-09-30: New currencies get `sortOrder` = max + 1 (last on boards
  until reordered), inside the same transaction as the insert.
- 2026-09-30: Reordering only under the All filter: with Active or
  Inactive, the grips and up/down buttons are not rendered and a hint says
  "Switch to All to change the order", so a partial list is never saved;
  the server also rejects any list that isn't exactly the org's
  non-archived currencies.
- 2026-09-30: Drag is armed on pointer down on the grip (the row is only
  `draggable` then), so text selection and clicks elsewhere in the row
  still work. Up/down buttons use `aria-disabled` at the ends instead of
  `disabled`, so keyboard focus stays on the button after a move to the
  top or bottom; they are hidden with `pointer-fine:sr-only` until focused.
- 2026-09-30: Status and order changes share one `useOptimistic` reducer
  in `ForexManager`; a failed save reverts when the transition ends.

## Session Notes

- 2026-09-30: Phase 4 complete and tagged `phase-4-complete` locally.
  Committed but not pushed: list, edit rate, add currency, status,
  reorder and this close-out. Test currencies QAA and QAB are still
  active/inactive in the dev database (QAA's rate was changed to 90/97 at
  1:00 AM Lagos by someone using the app, not by the checks); archive
  them once the owner confirms they're not needed.
- 2026-09-30: Dev database now has test rates from Phase 4 checks (USD
  1370/1385 at 00:46 Lagos on 30 Sept, CNY 189/195) and test currencies
  QAA and QAB (to be archived when Phase 4's checks are done); rates are
  insert-only, so they stay. Checking timestamps with raw `pg` gives
  wrong times on this Mac: Prisma's `timestamp(3)` columns hold UTC
  without a zone and `pg` reads them as local (Pacific) time. Read them
  as `"createdAt"::text` (UTC) or through Prisma.
- 2026-09-29: Phase 3 complete, tagged `phase-3-complete`, pushed and
  confirmed on production (live logo upload). Earlier notes: previously
  committed but not pushed were list, add/edit, status/delete, logo upload (plus the
  tracker note from after the Phase 2 push). `.env.local` had an empty
  duplicate `BLOB_READ_WRITE_TOKEN=` line from the template and a block
  appended by `vercel env pull`; the empty line was removed. Browser
  checks run signed in via a one-time Clerk sign-in token (scratch
  scripts, not in the repo).
- 2026-09-29: Back on the owner's Mac (has `.env.local`). All four
  Phase 2 commits were already on `origin/main`, so production is running
  the Phase 2 shell before its end-of-phase checks. On this Mac: build,
  lint, `tsc --noEmit`, `npm test` (24 passed) and `format:check` all
  pass; no hex in `.tsx`. Deleted the leftover local `phase-1-foundation`
  branch (its one extra commit was a tracker line superseded on `main`)
  and pruned the stale remote ref. This Mac's npm 10.9 strips the
  `libc` fields from `package-lock.json` on `npm install`; don't commit
  that change (Vercel needs them to pick resvg's glibc build).
- 2026-09-29: Phase 2 complete, tagged `phase-2-complete` and pushed
  with `--follow-tags` (owner approved). Vercel deployed `93085dc` to
  production: https://stereolinkz-czj8.vercel.app. The owner checks the
  shell there at desktop and phone widths.
  Signed-in browser checks can be repeated with a one-time Clerk
  sign-in token (Backend API `sign_in_tokens`, dev instance) opened as
  `/login?__clerk_ticket=…`; sign the session out afterwards.
- 2026-09-29: Working on `main` (no branches). Phase 1 closed out and
  tagged `phase-1-complete`. `phase-1-foundation` was already gone
  locally and on GitHub (deleted on merge). Production:
  https://stereolinkz-czj8.vercel.app (Vercel project
  `stereolinkz-czj8`, deploys every push to `main`).
- 2026-09-29: This session runs in a GitHub Codespace (Linux) with no
  `.env.local`. `npm ci` fails at `postinstall` (`prisma generate` needs
  `DATABASE_URL`), so install with `npm ci --ignore-scripts`, then
  `DATABASE_URL=postgresql://placeholder@localhost/none npx prisma
  generate` and `npx next typegen` (needed before `tsc --noEmit`). The
  build passes with that placeholder URL. Running the signed-in app
  needs the owner to create `.env.local` here.
- 2026-09-28: Database: Neon (eu-central-1, pooled URL) in `.env.local`.
  The first `migrate dev` hit P1001 while the Neon compute woke up; a
  retry worked. `npm audit` reports 4 high findings in `mysql2`, a
  transitive dev dependency of the Prisma CLI (unused with Postgres; the
  suggested fix is a downgrade to Prisma 6, not taken). `pg` warns that
  `sslmode=require` is treated as `verify-full`; harmless now.
- 2026-09-28: Clerk development instance; its "Development mode" footer
  shows under `<SignIn />` until production keys are used. VS Code twice
  saved a stale `.env.local` buffer over the file on disk; close that
  tab without saving. Headless Chrome cannot go below ~500px wide; 390px
  screenshots are taken with DevTools device emulation instead.
- 2026-09-28: Render spike: local (2015 i5) cold ~2.4 s, warm ~2.0–2.2 s
  (satori ~60 ms, resvg the rest, mostly the card shadow); Vercel
  2317 / 2686 ms. The spike route `/api/dev/render-spike` is TEMPORARY:
  Phase 6 deletes it and its fixture. The rough template hard-codes the
  "stereolinkz" wordmark; Phase 6 should draw the brand from the
  snapshot (name / logoUrl). The traced resvg binary is darwin-x64
  locally; Vercel installs the linux build itself.
