# Implementation Plan

The build plan for RateBoard, from an empty repo to production, in 10
phases. Each phase is one block of work: build everything it lists,
check it, then move to the next phase. Progress is recorded in
`progress-tracker.md` as the work happens.

This file defines **what each phase is**. Change a phase's definition
only by recording it in `progress-tracker.md` → Architecture Decisions first.

## How to use this plan

1. Open `progress-tracker.md` and find the current phase.
2. Read the phase below: its **Read** list (context sections), its
   **Design** files (`docs/design/`), and the phases it **Depends on**.
3. Before coding, post a short plan for the whole phase: the order you
   will build things in, the files you will create or change, and
   anything unclear. If something is missing, add an open question to
   the tracker's Open Questions instead of guessing (`ai-workflow-rules.md`).
4. Build everything in the phase's **Build** section, in the order
   listed. Anything under **Not in this phase** waits for its phase.
5. At each **Stop point**, pause and ask the owner for what is needed
   (keys, sign-ins, a check on a phone), then continue.
6. Check every **Done when** item, then run the **Verify** steps.
7. Throughout, update `progress-tracker.md` after every piece of work
   (`ai-workflow-rules.md` → Updating the Progress Tracker), and mark
   the phase complete at the end.
8. Only then start the next phase.

Commit as you go on `main` (one commit per logical piece); there are
no branches or pull requests. The owner reviews each phase at its end;
then it is tagged `phase-<n>-complete` and pushed (see Branching and
review).

### Standard checks (every phase)

- `npm run build` passes
- `npm run lint` and `npx tsc --noEmit` are clean
- `npm test` passes (once Vitest exists, from Phase 2)
- No invariant in `architecture.md` is broken
- Every page touched matches its design file at 1440px and at 390px,
  including empty, loading and error states

### Phase format

- **Goal**: the outcome of the phase
- **Depends on**: phases that must be done first
- **Read**: context file sections to load
- **Design**: design files to match (`docs/design/…`)
- **Build**: what to create, grouped by area, in build order
- **Stop points**: where the owner must act
- **Done when**: acceptance checks
- **Verify**: how to prove it
- **Not in this phase**: scope guard

---

## Phase 1: Foundation

- **Goal:** A deployed Next.js app with our tokens and font, the
  database schema applied and seeded, Clerk sign-in, server-side
  membership checks, and proof that a 1080 × 1920 PNG renders
  correctly on Vercel.
- **Depends on:** nothing
- **Read:** `architecture.md` → Stack, System Boundaries, Storage
  Model, Data model, Auth and Access Model, Invariants;
  `code-standards.md` → TypeScript, Next.js, Styling, Server Actions,
  Data and Storage, File Organization; `ui-context.md` → Colors,
  Typography, Border Radius, Board Tokens
- **Design:** `login.html`, `stereolinkz-rate-boards.html` (Forex board)

### Build

**Owner setup (before any code)**
- One POF rate per bank and per-month POF rates are already
  recorded in `architecture.md` → Settled Decisions, so the schema
  stays as reviewed
- Accounts: GitHub repo; a PostgreSQL database (dev and prod, or Neon
  branches); a Clerk application with Google and email sign-in and
  public sign-ups off; a Vercel project linked to the repo
- `.env.local` filled in by the owner, never committed

**Project setup** (Next.js 16 and TypeScript are already installed; do
not reinstall them)
- `tsconfig.json`: `strict: true`, `noUncheckedIndexedAccess: true`,
  alias `@/*`; the app lives under `src/`
- Tailwind CSS v4 and ESLint
- `src/app/globals.css`: every admin token and radius from
  `ui-context.md`, exposed through Tailwind `@theme`
- `npx shadcn@latest init`, with shadcn's variables mapped to our
  tokens (no default palette, no components yet)
- `src/app/layout.tsx`: Archivo via `next/font/google`,
  `subsets: ["latin", "latin-ext"]` (₦ is only in `latin-ext`) with the
  `wdth` axis, as `--font-sans`
- `.env.example` (every variable in `architecture.md` → Environment Variables), `README.md` (how to
  run; context files in `context/`)
- `context/` and `docs/design/` from the project kit are in the repo

**Database**
- Prisma, wired for the installed major version. Prisma 7: generator
  `prisma-client` with `output = "../src/generated/prisma"`,
  datasource URL in `prisma.config.ts` (dotenv), the
  `@prisma/adapter-pg` driver adapter. Prisma 6: `prisma-client-js`
  with `url = env("DATABASE_URL")`.
- `prisma/schema.prisma` from the kit. Models, fields, relations and
  indexes stay exactly as reviewed; only the generator and datasource
  wiring may change.
- First migration created with `--create-only`, then these lines
  appended before applying:
  - `ALTER TABLE "ForexRate" ADD CONSTRAINT forex_sell_gte_buy CHECK (sell >= buy);`
  - `ALTER TABLE "PofRate" ADD CONSTRAINT pof_rate_range CHECK (rate >= 0 AND rate <= 100);`
- `src/lib/server/db.ts`: Prisma client singleton, `import "server-only"`
- Scripts: `db:generate`, `db:migrate`, `db:deploy`, `db:studio`, `db:seed`

**Seed** (`prisma/seed.ts`, run with `tsx`; the only place sample
names may appear)
- Idempotent: upsert on unique keys; rate rows are inserted only when
  the parent has none
- Organization "Stereolinkz": slug `stereolinkz`, `Africa/Lagos`,
  `NGN`; colours `#2A0F58` / `#6A35D9` / `#E9B949`; contactLine
  `+234 800 000 0000`; default templates `forex/purple-signal` and
  `pof/purple-signal`; defaultFinePrint "Rates can change without notice."
- Currencies (older rate a day earlier, so change arrows work):
  - USD "US dollar": 1360/1374, then 1365/1378
  - GBP "British pound": 1820/1845, then 1815/1840
  - EUR "Euro": 1552/1578, then 1560/1583
  - The three above are active, sortOrder 0–2, flags us/gb/eu
  - CAD "Canadian dollar" 985/1002 and CNY "Chinese yuan" 188/194 are
    inactive (flags ca/cn)
- Banks (name / short name):
  - Wema Bank / Wema: 3.3, then 3.4
  - Providus Bank / Providus: 3.4, "New account"
  - Ecobank / Ecobank: 3.4, "New account"
  - Fidelity Bank / Fidelity: 3.4, "New account"
  - Parallex Bank / Parallex: 2.0, then 2.1
  - Globus Bank / Globus: 2.3
  - All of the above are active with `pofActive` true
  - Zenith Bank / Zenith is inactive with no rates
- Bank slugs via `src/features/banks/slug.ts` (lowercase; strip "bank",
  "plc", "ltd" and non-alphanumerics), reused in Phase 3
- OWNER membership for `SEED_OWNER_CLERK_USER_ID`, only if it is set
  (otherwise warn and skip; the seed is re-run after sign-in works)

**Authentication and access**
- `@clerk/nextjs`; `ClerkProvider` in the root layout
- `src/proxy.ts`: plain `clerkMiddleware()` with Clerk's recommended
  matcher. No `createRouteMatcher` (deprecated); access is checked
  next to the data.
- `src/app/(auth)/login/[[...login]]/page.tsx` matching `login.html`:
  two-column brand panel plus `<SignIn />` themed with our tokens;
  stacks on phones; signed-in visitors go to `/admin`. The tilted
  sample board is left out until Phase 6.
- `src/app/page.tsx` redirects to `/admin`
- `src/lib/server/auth.ts` (`server-only`):
  - `requireMember()`, wrapped in React `cache()`: no user → `/login`;
    no Membership → `/not-authorized`; returns
    `{ userId, organizationId, role }`
  - `getMember()` returns null instead of redirecting (for route handlers)
- `src/app/admin/layout.tsx` and a placeholder `page.tsx`, calling
  `requireMember()`. Comment that layouts are not a security boundary.
- `src/app/not-authorized/page.tsx` (outside `/admin`): "You don't
  have access to RateBoard", with a sign-out button
- `src/lib/server/action.ts`: `ActionResult<T>` and `safeAction()`
  (runs `requireMember()`, catches errors, returns a generic message,
  never Prisma text)

**Deploy**
- Vercel build: `prisma generate && next build`; migrations run with
  `npm run db:deploy` (manually for now), not during the build
- Env vars for Preview and Production (everything except `SEED_OWNER_CLERK_USER_ID`)

**Render spike** (proves the riskiest part now)
- `satori`, `@resvg/resvg-js`, `@fontsource/archivo`
- `next.config.ts`: `serverExternalPackages: ["@resvg/resvg-js"]`,
  `outputFileTracingIncludes` for `assets/fonts/**`
- `assets/fonts/`: Archivo WOFF (not WOFF2), weights 400–900, `latin`
  and `latin-ext`, copied by `scripts/copy-fonts.mjs` and committed
- `src/lib/render/fonts.ts` (loaded once, cached), `render-svg.ts`
  (Satori at 1080 × 1920), `render-png.ts` (resvg)
- `src/features/templates/assets/flags/`: us, gb, eu, ca, cn, ng SVGs
  plus `flagDataUri(code)`
- A rough `src/features/templates/forex/purple-signal.tsx`: inline
  styles, flexbox only, no `font-stretch`; renders a fixture that
  passes `boardSnapshotV1`
- A temporary route `src/app/api/dev/render-spike/route.ts`: Node
  runtime, `getMember()` or 401, returns the PNG with an `X-Render-Ms`
  header. It is not named `_spike`, because App Router ignores folders
  starting with `_`.

### Stop points

- Before the database work: owner pastes `DATABASE_URL` into `.env.local`
- Before authentication: owner creates the Clerk app and pastes the keys
- After sign-in works: owner signs in and shares their Clerk user ID →
  set `SEED_OWNER_CLERK_USER_ID`, re-run the seed
- Access check: owner signs in with a second account, which must be blocked
- Deploy: owner links Vercel and adds the env vars
- Render spike: owner opens the Preview URL and confirms the PNG

### Done when

- [ ] Archivo renders in the app and ₦ displays; no hex values outside `globals.css`
- [ ] The migration applies to an empty database; an SQL insert with
  `sell < buy` fails on `forex_sell_gte_buy`
- [ ] `npm run db:seed` run twice gives identical row counts
- [ ] Signed out, `/admin` goes to `/login`; signed in, `/login` goes to `/admin`
- [ ] The owner sees `/admin`; a second Clerk account lands on
  `/not-authorized` and sees no data
- [ ] The login page matches `login.html` at 1440px and 390px
- [ ] The Vercel Preview signs in the owner and blocks the second account
- [ ] The spike PNG on the Preview is exactly 1080 × 1920, with ₦,
  flags and weight 800 correct; the warm render time is recorded in
  the tracker's Session Notes (target under 2 seconds)

### Verify

Standard checks; row counts printed per table; screenshots of the login
page at both widths; the spike PNG shown next to the design board.

### Not in this phase

App shell, any admin page content, the template registry, the POF
template, Blob uploads, saving boards.

---

## Phase 2: Shared foundations

- **Goal:** Formatting helpers with tests, every UI primitive the pages
  need, and the app shell on all admin routes.
- **Depends on:** Phase 1
- **Read:** `code-standards.md` → TypeScript, Testing, Styling;
  `architecture.md` → Invariants 10 and 11; `ui-context.md` →
  Component Library, Border Radius, Layout Patterns, Icons
- **Design:** `dashboard.html` (shell at both widths), `forex.html`,
  `forex-edit.html`, `banks.html` (chips, switches, drawers)

### Build

**Formatting and tests**
- Vitest (dev dependency) with `npm test`
- `src/lib/format.ts`:
  - `formatRate("1365.0000") → "1,365"`
  - `formatBoardPrice → "1365"`
  - `formatPercent("3.40") → "3.4%"`
  - `formatPoints → "0.1 pts"`
  - `formatBoardDate → "Sun, 27 Sept 2026"`
  - `formatBoardTime → "10:25 AM"`
  - `formatDayHeading → "Today" / "Saturday, 26 September 2026"`
  - `isSameOrgDay`
  - All dates use the org time zone
- `src/lib/decimal.ts`: `toDecimalString`, `compareDecimalStrings`
- Tests, including the Lagos midnight edge (23:30 UTC on 26 Sept is
  27 Sept in Lagos) and the bank slug rule

**UI primitives**
- shadcn: button, input, select, textarea, switch, checkbox, sheet,
  dialog, toggle-group, tabs, sonner, tooltip, badge, skeleton, label
- Button variants (primary, outline, ghost, destructive; 40px, sm
  32px, icon 34px); Sheet on the right at 460px on desktop, a bottom
  sheet under 760px
- `src/components/`:
  - `InputAddon` (₦ / % prefix and suffix; gold "changed" state)
  - `StatusChip`, `RateDelta`, `CurrencyFlag`, `BankMark`
  - `EmptyState`, `Callout`
  - `EntityDrawer` (Enter submits)
- A dev-only `/admin/dev-kit` page showing every component in every
  state (removed in Phase 10)

**App shell**
- `src/components/shell/`:
  - `Sidebar`: brand, nav groups, gold active marker, user block with sign-out
  - `MobileTopBar`
  - `BottomTabBar`: Home, Forex, POF, a raised Generate, and More,
    which opens the sidebar as a drawer
  - `PageHeader`
- `src/app/admin/layout.tsx` uses the shell
- A placeholder page with the correct header for `/admin`, `forex`,
  `pof`, `banks`, `templates`, `generator`, `history`, `settings`

### Done when

- [ ] All formatting tests pass
- [ ] The dev kit page matches the chips, inputs, switches and drawers in the design files
- [ ] The active nav item is correct on every route; under 900px the
  sidebar hides and the top bar and tab bar show
- [ ] Focus is visible, and Escape closes the mobile menu and drawers

### Verify

Standard checks; click through every route at 1440px and 390px.

### Not in this phase

Any data on pages; mutations.

---

## Phase 3: Banks

- **Goal:** Full bank management on `/admin/banks`: list, add, edit,
  logo upload, activate/deactivate, and safe delete.
- **Depends on:** Phase 2
- **Read:** `project-overview.md` → Banks; `architecture.md` → Data
  model (Bank, RecordStatus), Storage Model, Invariants 1, 6, 7, 12;
  `code-standards.md` → Server Actions, Data and Storage
- **Design:** `banks.html`, `bank-add.html`, `bank-edit.html`, `bank-delete.html`

### Build

**List**
- `src/features/banks/queries.ts`: `listBanks(orgId)`, returning each
  bank with its current PofRate and rate count, ordered by `sortOrder`
  then name, ARCHIVED excluded
- `BanksTable` (desktop grid; phone cards), with an empty state

**Add and edit**
- `src/features/banks/schema.ts`: `bankInput` (name required, short
  name ≤ 14 characters, active flag); reuses `slug.ts`
- `src/features/banks/actions.ts`: `createBank`, `updateBank` through
  `safeAction`. A duplicate slug returns "A bank called “Eco Bank”
  already exists." An empty short name defaults to the first word.
- `BankDrawer` with React Hook Form and `zodResolver`

**Logo upload**
- Owner stop point: create the Vercel Blob store and add
  `BLOB_READ_WRITE_TOKEN`
- `src/lib/server/blob.ts`: `uploadImage(file, path)` (PNG, SVG or
  JPEG; ≤ 1 MB; `addRandomSuffix: true`) and `deleteBlob(pathname)`
- The logo field with a preview in `BankDrawer`; every upload stores a new URL

**Status and delete**
- `setBankStatus(id, ACTIVE | INACTIVE)`
- `deleteBank(id)`: the server re-checks for zero rates, otherwise
  "Deactivate this bank instead. It has rate history."
- A confirmation Dialog

### Done when

- [ ] "Eco Bank" is rejected when "Ecobank" exists
- [ ] Save closes the drawer, shows a toast and updates the list without a reload
- [ ] Logos upload, show in the list, and a new upload never overwrites the old file
- [ ] Wrong file type or size shows a field error
- [ ] Deactivated banks show as Inactive
- [ ] Deleting a bank with history is refused on the server, even when called directly

### Verify

Standard checks; the upload is visible in the Blob dashboard.

### Not in this phase

POF rates, reordering banks, the organization logo.

---

## Phase 4: Forex

- **Goal:** Full currency and forex rate management on `/admin/forex`.
- **Depends on:** Phase 2
- **Read:** `project-overview.md` → Forex rates; `architecture.md` →
  Data model (current rate = newest row), Invariants 1, 2, 7, 10;
  `code-standards.md` → Server Actions, Data and Storage (validation)
- **Design:** `forex.html`, `forex-edit.html`, `forex-add.html`

### Build

**List**
- `src/features/currencies/queries.ts`: `listCurrenciesWithRates(orgId)`
  (latest two ForexRate rows per currency, Decimal strings)
- `ForexTable`: grip, flag, code and name, We buy, We sell with
  `RateDelta`, spread, updated (Lagos time), status switch, Edit; phone cards
- Filter All / Active / Inactive via `?status=`

**Edit rate** (rates only; a currency's details are fixed once added)
- `src/features/forex-rates/schema.ts`: `forexRateInput` (buy > 0,
  sell > 0, sell ≥ buy, at most 4 decimal places)
- `saveForexRate`: inserts a ForexRate; unchanged values insert
  nothing and return `unchanged: true`. Revalidates `/admin`,
  `/admin/forex` and `/admin/generator`.
- `ForexRateDrawer`: summary, ₦ inputs, a live spread hint, the last 4 changes

**Add currency**
- `currencyInput` (code `^[A-Z]{3}$`, name, symbol, flagCode, active)
- `createCurrency`: Currency plus its first ForexRate in one
  transaction; duplicate → "CAD already exists. Edit it from the table instead."
- `CurrencyDrawer` with an uppercase code and a flag picker

**Status and order**
- `setCurrencyStatus` with optimistic UI
- Reorder: drag handle on desktop, up/down controls on touch;
  `reorderCurrencies(ids[])` writes `sortOrder` in one transaction

### Done when

- [ ] Values and deltas match the seed; "Updated" shows Lagos times
- [ ] Saving adds a new row and leaves the previous one untouched;
  toast "USD saved. The previous rate is in history."
- [ ] Unchanged values show "No changes to save"
- [ ] A new currency appears with its flag (a code badge if it has none)
- [ ] Inactive rows dim and the filter works
- [ ] The order persists after reload

### Verify

Standard checks; ForexRate row counts before and after a save.

### Not in this phase

Editing a currency's code, name, symbol or flag (see `architecture.md` → Settled Decisions).

---

## Phase 5: POF

- **Goal:** Full POF rate management on `/admin/pof`.
- **Depends on:** Phase 3
- **Read:** `project-overview.md` → POF rates; `architecture.md` →
  Bank.pofActive, PofRate, Invariant 2
- **Design:** `pof.html`, `pof-edit.html`, `pof-add.html`

### Build

**List**
- `src/features/pof-rates/queries.ts`: `listPofRates(orgId)` (latest
  two PofRate rows per bank, bank status, `pofActive`)
- `PofTable`: change in pts, note chip, Active switch (disabled when
  the bank is inactive); phone cards
- A callout listing active banks with no rate, with an "Add one" link

**Edit and add**
- `pofRateInput`: 0 ≤ rate ≤ 100, at most 2 decimal places; note ≤ 24
  characters, optional; `pofActive`
- `savePofRate`: inserts a PofRate when the rate or note changed and
  updates `Bank.pofActive` if it changed, in one transaction
- `PofRateDrawer`: bank select (active banks only when adding, locked
  when editing), rate with a % suffix, note suggestions, active switch, history

**Visibility**
- `setPofActive(bankId, boolean)` with optimistic UI

### Done when

- [ ] Changes show in the table and in history
- [ ] Inactive banks cannot be picked
- [ ] Giving a bank its first rate removes it from the callout
- [ ] The switch toggles `pofActive` and survives a reload

### Verify

Standard checks.

### Not in this phase

Multiple rates per bank (see `architecture.md` → Settled Decisions).

---

## Phase 6: Templates and rendering

- **Goal:** Validated snapshots, a template registry, both template
  designs for both board types, the preview component, and the
  Templates page.
- **Depends on:** Phases 1, 4 and 5
- **Read:** `architecture.md` → Snapshot, System Boundaries
  (templates), Invariants 3, 4, 8, 9, 10, 11; `code-standards.md` →
  Styling (template exception); `ui-context.md` → Board Tokens,
  Typography (board scale), Layout Patterns (board safe area)
- **Design:** `stereolinkz-rate-boards.html`, `templates.html`,
  `generator-edited.html` (overlay), `history.html` (Daylight thumbnail)

### Build

**Snapshots**
- `src/features/boards/snapshot.ts` (from the kit)
- `build-snapshot.ts`: `buildSnapshot({ org, type, rows, content, now })`,
  pure; formats date and time in the org time zone; copies brand; Zod-validated
- `defaults.ts`: default content per board type, from the design copy
- Tests: valid snapshots pass, `sell < buy` fails, Lagos dates are correct

**Registry and renderer**
- `src/features/templates/types.ts`: `BoardTemplate` = `{ key,
  version, type, name, description, maxRows, render(snapshot) }`
- `theme.ts`: Purple Signal and Daylight tokens, merged with the snapshot brand colours
- `registry.ts`: `getTemplate(key)`, `listTemplates(type)`; an unknown key throws a typed error
- `src/lib/render/`: `renderBoardPng(snapshot, templateKey)`; logos
  embedded as data URIs in `assets.ts` (timeout, falling back to a monogram)
- Delete the Phase 1 spike route

**Templates**
- `forex/purple-signal.tsx` (maxRows 4) and `pof/purple-signal.tsx` (maxRows 6)
- `forex/daylight.tsx` and `pof/daylight.tsx`
- The Stereolinkz wordmark component (equalizer bars)

**Preview components**
- `src/components/board/BoardFrame.tsx`: renders the template at
  1080 × 1920, scaled to its container
- `WhatsAppOverlay.tsx` (preview only)

**Templates page**
- `/admin/templates`: tabs Forex / POF / Custom (empty state); cards
  with live thumbnails from current rates
- `setDefaultTemplate(type, key)` → `Organization.default…TemplateKey`
- "Use in generator" → `/admin/generator?type=…&template=…`
- Add the tilted sample board to the login page's brand panel

### Done when

- [ ] Rendering the same snapshot twice gives identical bytes; a test
  checks the PNG header and 1080 × 1920
- [ ] All four PNGs match the design boards
- [ ] Nothing important sits in the top 150px or the bottom 320px
- [ ] "Providus" plus "New account", and "12,345" prices, fit without overflow
- [ ] The preview and the PNG look identical side by side
- [ ] The Default chip moves when set

### Verify

Standard checks; fixture PNGs rendered to `tmp/` and compared with the design.

### Not in this phase

The generator, saving boards, custom templates.

---

## Phase 7: Generator

- **Goal:** The full publishing flow: configure a board, live preview,
  Generate (saving edited rates, the snapshot and the PNG), and download.
- **Depends on:** Phase 6
- **Read:** `project-overview.md` → Generator, Core User Flow;
  `architecture.md` → Generate flow, Invariants 2, 3, 5, 7, 8, 12;
  `code-standards.md` → Server Actions (error messages);
  `ui-context.md` → Layout Patterns (generator)
- **Design:** `generator.html`, `generator-edited.html`,
  `generator-pof.html`, `generator-done.html`

### Build

**Page and state**
- `src/app/admin/generator/page.tsx` (server): loads the org, active
  currencies with rates (by `sortOrder`), active banks with
  `pofActive` and a rate, templates and defaults; reads `?type`,
  `?template` and `?from`
- `Generator.tsx` (client, React Hook Form): `{ type, templateKey, rows[], content }`
- Steps: 1 board type (switching resets the rows and content), 2 template

**Rates and content**
- Step 3: checkbox, entity and inputs per row; gold "changed" state; a
  capacity bar that turns red over `maxRows`
- Step 4: headline (a line break is a new line), subheading, note
  (forex only), small print
- Zod validation; the first error shows above Generate, and Generate is disabled

**Live preview**
- Client-side `buildSnapshot` → `BoardFrame` on every keystroke, with
  no network calls
- The "WhatsApp view" switch
- On phones the preview sits on top (max 220px) and the Generate bar
  sticks above the tab bar

**Generate** (`generateBoard` in `src/features/boards/actions.ts`)
1. `requireMember()`, then parse the input with Zod
2. Work out which included rates changed
3. Build the snapshot on the server (server time only) and check `maxRows`
4. `renderBoardPng`, then upload to `boards/{orgId}/{boardId}/{imageId}.png`
5. In one `$transaction`, insert the changed rates, the RateBoard and the RateBoardImage
6. If the transaction fails, `deleteBlob`
7. Revalidate the affected pages
8. Return `{ boardId, imageUrl, savedRates }`
- Pending state "Generating image…"; a double submit is ignored

**Success and download**
- Success panel: time, the saved-rates note, Download PNG, View in history, Make another
- `src/app/api/boards/[id]/download/route.ts`: Node runtime,
  `getMember()` or 401, org check or 404; returns
  `Content-Disposition: attachment; filename="stereolinkz-forex-1025am.png"`

### Stop points

- The owner downloads a board on a real phone and posts it to WhatsApp Status

### Done when

- [ ] Both board types prefill correctly with the default template;
  inactive currencies and banks with `pofActive = false` are left out
- [ ] Typing updates the preview instantly
- [ ] Over-capacity rows and invalid values block Generate with the design's messages
- [ ] Generate creates a board row, an image row and a blob, and edited rates appear in history
- [ ] A forced render error leaves no rows and no blob, and shows
  "The image couldn't be generated. Your rates were not changed. Try again."
- [ ] Download works on iPhone Safari and Android Chrome; another org's board ID returns 404

### Verify

Standard checks; a manual failure test; a real phone test.

### Not in this phase

History pages, regenerate, "Use these rates again" (`?from` is read,
but it prefills in Phase 8).

---

## Phase 8: History

- **Goal:** Every generated board can be found, inspected, downloaded,
  regenerated and reused, always from its snapshot.
- **Depends on:** Phase 7
- **Read:** `architecture.md` → Invariants 3 and 5, Generate flow (regenerate)
- **Design:** `history.html`, `history-board.html`, `history-regenerate.html`

### Build

**List**
- `listBoards(orgId, { type?, cursor })` (20 per page, newest first)
- `HistoryList`: Lagos day headings; thumbnails from parsed
  snapshots; type, time, template chip, rate pills; View / Download /
  Regenerate; `?type=` filter; "Load more"
- An unreadable snapshot shows "This board can't be displayed"

**Detail**
- `BoardDetailDialog` (a bottom sheet on phones), opened with
  `?board=<id>`: preview, generated by, template and version, image
  count, snapshot rates with "Now X" in gold where the current rate
  differs, and an explanation callout

**Regenerate**
- `regenerateBoard(boardId, templateKey)`: render from the stored
  snapshot with a template of the same type; upload; insert a
  RateBoardImage only

**Use these rates again**
- `/admin/generator?from=<boardId>` prefills rows from the snapshot by
  `currencyId`/`bankId`; inactive or missing items are skipped with a
  notice; the values show as edited

### Done when

- [ ] After a rate change, older boards still show and regenerate the old values
- [ ] "Now X" appears only on rows that changed
- [ ] Regenerating increases the image count and keeps the original
- [ ] Generating from `?from` creates a new board and saves those rates as current

### Verify

Standard checks.

### Not in this phase

Deleting boards (not in the MVP).

---

## Phase 9: Dashboard and settings

- **Goal:** The dashboard overview and the organization settings that feed the boards.
- **Depends on:** Phase 8
- **Read:** `project-overview.md` → Dashboard, Settings;
  `architecture.md` → Organization
- **Design:** `dashboard.html`, `settings.html`

### Build

**Dashboard**
- `getDashboard(orgId)`: active and total currency and bank counts,
  boards today (Lagos day), last rate change
- Stat strip; Today's forex and Today's POF panels with pencil buttons
  opening the existing drawers
- `listRecentRateChanges(orgId, 5)` (ForexRate and PofRate merged,
  from → to, direction) and the latest 3 boards (opening the detail dialog)
- Empty states for a new organization

**Settings**
- `orgSettingsInput` and `updateOrgSettings`
- Company: name, WhatsApp number, email, logo (the same blob helper)
- Brand colours: background, buy/rates, sell/highlights; hex
  validation and a contrast warning (4.5:1)
- Boards: time zone (IANA select), image size (fixed), default small print
- Team: a disabled "coming later" section

### Stop points

- The owner enters the real WhatsApp number and uploads the logo, if ready

### Done when

- [ ] Editing from the dashboard updates the panels, stats and recent changes
- [ ] Changing settings affects the next board only; old boards are unchanged
- [ ] Changing the time zone changes the date on new boards

### Verify

Standard checks.

### Not in this phase

Team invites and roles.

---

## Phase 10: Hardening and launch

- **Goal:** Production-ready and live for Stereolinkz, with every
  success criterion met.
- **Depends on:** Phase 9
- **Read:** `project-overview.md` → Success Criteria; `architecture.md` → Invariants

### Build

**States**
- A `loading.tsx` with skeletons per route; an `error.tsx` per route
  group; the empty states from `project-overview.md`

**Accessibility**
- Labels on every input; drawers trap and return focus; Escape closes
- Switches announce their state; colour is never the only signal; AA contrast

**Security**
- `scripts/check-actions.ts`: fails if any action export or route
  handler lacks `requireMember()` / `getMember()`
- Every query filters by `organizationId`; no Prisma text reaches the
  UI; blob uploads validated on the server; only the download route
  remains under `/api`

**Mobile and performance**
- Every design file matches at 390px, with no horizontal scroll
- Warm generate under 3 seconds; PNG under 1.5 MB; fonts and flags
  loaded once per instance; admin LCP under 2.5 seconds

**Launch**
- Remove `/admin/dev-kit`
- `prisma migrate deploy` on production; seed only the org and owner
- Production env vars; custom domain if wanted

### Stop points

- The owner runs the full flow on a real phone: update a rate,
  generate and download in under 60 seconds
- The owner adds Clerk IDs for other launch users

### Done when

- [ ] Every item in `project-overview.md` → Success Criteria is
  checked on production

### Verify

Standard checks on production; each success criterion is logged under
Completed in the tracker.

---

## Branching and review

- No branches or pull requests until launch: all work happens on
  `main` (revisit in Phase 10).
- Commit per logical piece, named for the phase:
  `phase 3: bank drawer with slug check`.
- Push only after the standard checks pass locally, because every push
  to `main` deploys to production.
- The owner reviews each phase at its end: the Done-when list checked
  and screenshots at 1440px and 390px of every page touched. Then tag
  `phase-<n>-complete` and `git push --follow-tags`.

## Coverage map

| Requirement | Phases |
| ----------- | ------ |
| Banks are dynamic records | 1 (seed), 3 |
| Currencies are dynamic records | 1 (seed), 4 |
| Rate history is preserved | 1 (schema), 4, 5, 7 |
| Snapshots are immutable | 6, 7, 8 |
| Templates are separate from data | 6 |
| 1080 × 1920 server-rendered PNG | 1 (spike), 6, 7 |
| Live preview | 6, 7 |
| Admin routes protected on the server | 1, 10 |
| Phone-first generator | 2, 7, 10 |
| Design files | login 1; dashboard 2 (shell) and 9; banks 3; forex 4; pof 5; templates 6; generator 7; history 8; settings 9 |
