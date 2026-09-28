# Implementation Plan

The build plan for RateBoard, from an empty repo to production. Work
through the units in order. Each unit is one reviewable, verifiable
step. Track status in `progress-tracker.md`, not here.

This file defines **what each unit is**. Change a unit's definition
only by recording a decision in `progress-tracker.md` first.

## How to use this plan

1. Open `progress-tracker.md` and find the current unit.
2. Read the unit below: its **Read** list (context sections), its
   **Design** files (`docs/design/`), and everything it **Depends on**.
3. Before coding, post a short plan: approach, files to create or
   change, and anything unclear. If something is missing, add an open
   question to the tracker instead of guessing (`ai-workflow-rules.md`).
4. Build only what the unit lists. Anything under **Not in this unit**
   waits for its own unit.
5. Check every **Done when** item, then run the **Verify** steps.
6. Update `progress-tracker.md`: mark the unit done, log decisions, and
   fill in the unit report.
7. Only then start the next unit.

### Standard checks (every unit)

Every unit's Verify list implicitly includes:

- `npm run build` passes
- `npm run lint` and `npx tsc --noEmit` are clean
- `npm test` passes (once Vitest exists, from 2.1)
- No invariant in `architecture.md` is broken
- UI units: the page matches its design file at 1440px and at 390px,
  including empty, loading and error states

### Unit format

- **Goal**: the outcome in one or two sentences
- **Depends on**: units that must be done first
- **Read**: context file sections to load
- **Design**: design files to match (`docs/design/…`)
- **Build**: files to create or change
- **Done when**: acceptance checks
- **Verify**: how to prove it
- **Not in this unit**: scope guard

---

## Phase 0: Pre-flight

The owner does this phase; the AI agent only prepares checklists.

### 0.1 Resolve blocking questions

- **Goal:** Answer the open questions that change the schema before the
  first migration.
- **Depends on:** nothing
- **Read:** `progress-tracker.md` → Open Questions
- **Done when:**
  - [ ] Decision recorded: can one bank have two POF rates at the same
    time? If yes, update `prisma/schema.prisma` with a `PofOffer` model
    (Bank → PofOffer → PofRate) and update `architecture.md` before
    unit 1.3.
  - [ ] Decision recorded: POF rate unit (per month or per deal), and
    the board label wording.
- **Not in this unit:** code

### 0.2 Accounts and environment

- **Goal:** Every external service exists and its keys are available.
- **Depends on:** nothing
- **Read:** `progress-tracker.md` → Environment Variables;
  `architecture.md` → Stack
- **Done when:**
  - [ ] GitHub repo created; the default branch is protected (see Branching below)
  - [ ] PostgreSQL database created (a dev database and a prod
    database, or Neon branches)
  - [ ] Clerk application created with Google and email sign-in; sign-up disabled or invite-only
  - [ ] Vercel project linked to the repo; Blob store created
  - [ ] Env values stored in Vercel (Preview and Production) and in a local `.env.local` (never committed)
  - [ ] Owner's Clerk user ID known, for the seed
- **Not in this unit:** code

---

## Phase 1: Foundation

### 1.1 Project scaffold

- **Goal:** An empty Next.js 16 app with the agreed tooling, tokens
  and font, and the context and design files in the repo.
- **Depends on:** 0.2
- **Read:** `architecture.md` → Stack, System Boundaries;
  `code-standards.md` → TypeScript, Styling, File Organization;
  `ui-context.md` → Colors, Typography, Border Radius
- **Build:**
  - `create-next-app` (App Router, TypeScript, ESLint, Tailwind v4,
    `src/` directory, import alias `@/*`)
  - `tsconfig.json` with `strict: true` and `noUncheckedIndexedAccess: true`
  - `src/app/globals.css`: every admin token from `ui-context.md` in
    `@theme`, plus the radius values
  - `src/app/layout.tsx`: Archivo via `next/font/google` as `--font-sans`, `lang="en"`
  - `npx shadcn init` configured to use the tokens
  - `context/` (all context files) and `docs/design/` (all design HTML) copied into the repo
  - `.env.example` listing every variable in the tracker
  - `README.md`: how to run, and where the context files are
- **Done when:**
  - [ ] `npm run dev` shows a placeholder page in Archivo on `--bg-base`
  - [ ] No hex values outside `globals.css`
- **Verify:** standard checks
- **Not in this unit:** Prisma, Clerk, any pages

### 1.2 Database and Prisma

- **Goal:** The reviewed schema is applied to PostgreSQL, with a
  Prisma client singleton.
- **Depends on:** 1.1, 0.1
- **Read:** `architecture.md` → Storage Model, Data model, Invariants
  2, 3, 6 and 10; `code-standards.md` → Data and Storage
- **Build:**
  - `prisma/schema.prisma` (from the project kit, including decisions from 0.1)
  - First migration, then hand-edit its SQL before applying to add:
    - `ALTER TABLE "ForexRate" ADD CONSTRAINT forex_sell_gte_buy CHECK (sell >= buy);`
    - `ALTER TABLE "PofRate" ADD CONSTRAINT pof_rate_range CHECK (rate >= 0 AND rate <= 100);`
  - `src/lib/server/db.ts`: Prisma client singleton, `import "server-only"`
  - npm scripts: `db:migrate`, `db:studio`, `db:seed`
- **Done when:**
  - [ ] `prisma migrate dev` applies cleanly to an empty database
  - [ ] Inserting `sell < buy` directly in SQL fails
  - [ ] All tables and relations match `architecture.md`
- **Verify:** standard checks; open `prisma studio` and inspect the tables
- **Not in this unit:** seed data, queries

### 1.3 Seed

- **Goal:** A fresh database contains the Stereolinkz organization, the
  owner's membership and realistic sample data.
- **Depends on:** 1.2
- **Read:** `architecture.md` → Auth and Access Model; Invariant 1
  (seed is the only place sample names may appear)
- **Build:** `prisma/seed.ts`
  - Organization "Stereolinkz" (slug `stereolinkz`, timezone
    `Africa/Lagos`, quoteCurrency `NGN`, brand colours from `ui-context.md`)
  - Membership for `SEED_OWNER_CLERK_USER_ID` with role OWNER
  - Currencies USD, GBP, EUR (active) and CAD, CNY (inactive), each
    with two ForexRate rows, so change arrows show
  - Banks Wema, Providus, Ecobank, Fidelity, Parallex, Globus (active,
    with PofRate rows and notes as in the brief) and Zenith (inactive, no rate)
  - Idempotent: running it twice creates no duplicates (upsert on unique keys)
- **Done when:**
  - [ ] `npm run db:seed` twice leaves the same row counts
- **Verify:** standard checks; row counts in studio
- **Not in this unit:** any UI

### 1.4 Clerk sign-in

- **Goal:** Signed-out visitors cannot reach `/admin/*`; `/login` shows
  a Clerk sign-in styled like the design.
- **Depends on:** 1.1
- **Read:** `architecture.md` → Auth and Access Model;
  `ui-context.md` → Layout Patterns
- **Design:** `login.html`
- **Build:**
  - `src/proxy.ts`: Clerk middleware protecting `/admin(.*)` and the `/api/boards(.*)` routes
  - `src/app/(auth)/login/[[...login]]/page.tsx`: two-column brand
    panel plus `<SignIn />` with an `appearance` that uses the tokens
  - `src/app/page.tsx`: redirect to `/admin`
  - `ClerkProvider` in the root layout
- **Done when:**
  - [ ] Signed out: `/admin` redirects to `/login`
  - [ ] Signed in: `/login` redirects to `/admin`
  - [ ] The login page matches `login.html` on desktop and phone (the
    brand panel stacks on phones and the tilted board is hidden)
- **Verify:** standard checks; manual sign-in and sign-out
- **Not in this unit:** membership checks (1.5). The brand panel's
  sample board is a static image until templates exist (6.3).

### 1.5 Membership guard

- **Goal:** Only members of the organization get admin data, enforced on the server.
- **Depends on:** 1.3, 1.4
- **Read:** `architecture.md` → Auth and Access Model, Invariant 7;
  `code-standards.md` → Server Actions and Route Handlers
- **Build:**
  - `src/lib/server/auth.ts`: `requireMember()` returns
    `{ userId, organizationId, role }`; throws a typed `NotAMemberError`
    when there is no membership
  - `src/app/admin/layout.tsx`: calls `requireMember()`
  - `src/app/admin/not-authorized` or an `error.tsx` branch with a
    friendly message and a sign-out button
  - `src/lib/server/action.ts`: `ActionResult<T>` type and a
    `safeAction` helper that wraps errors into `{ ok: false, error }`
- **Done when:**
  - [ ] Owner sees the placeholder `/admin`
  - [ ] Another Clerk account sees "You don't have access to RateBoard", and no data
- **Verify:** standard checks; test with a second Clerk account
- **Not in this unit:** roles beyond "member"

### 1.6 First deploy

- **Goal:** The app deploys to Vercel with a working database and sign-in.
- **Depends on:** 1.5
- **Build:** Vercel build settings (`prisma generate` in build,
  `prisma migrate deploy` as a release step or run manually), env vars
  for Preview and Production
- **Done when:**
  - [ ] The Preview URL signs in the owner and blocks non-members
- **Verify:** manual check on the Preview URL
- **Not in this unit:** production data

### 1.7 Render spike

- **Goal:** Prove the riskiest part first. A hard-coded forex snapshot
  renders to a 1080 × 1920 PNG on Vercel, with the ₦ sign, flags and
  the Archivo weights all correct.
- **Depends on:** 1.6
- **Read:** `architecture.md` → Stack (Image rendering), Invariants 8
  and 9; `code-standards.md` → Next.js (Node runtime), Styling
  (template exception); `ui-context.md` → Board Tokens, Typography
- **Design:** `stereolinkz-rate-boards.html` (Forex board), `generator.html` (preview)
- **Build:**
  - `public/fonts/`: Archivo TTF at 400, 500, 600, 700, 800 and 900
    (static instances; Satori does not use variable fonts)
  - `src/lib/render/fonts.ts` (load once and cache), `render-svg.ts`
    (Satori), `render-png.ts` (`@resvg/resvg-js`)
  - `src/features/templates/assets/flags/`: us, gb, eu, ca, cn, ng as SVG strings
  - A rough `forex/purple-signal` template (inline styles, flexbox only)
  - A temporary route `src/app/api/_spike/route.ts` (Node runtime,
    member-only) returning the PNG
- **Done when:**
  - [ ] The PNG is exactly 1080 × 1920
  - [ ] ₦ renders (not a box); flags render; headline weight is 800
  - [ ] It works on the Vercel Preview, not just locally
  - [ ] Render time is recorded in the tracker (target under 2 seconds warm)
- **Verify:** download the PNG from the Preview URL and compare it with the design
- **Not in this unit:** the template registry, the POF template, and
  saving anything. Delete the spike route in 6.2.

---

## Phase 2: Shared foundations

### 2.1 Formatting and test setup

- **Goal:** One tested place for number, percent and date formatting.
- **Depends on:** 1.1
- **Read:** `code-standards.md` → TypeScript (rates), Testing;
  `architecture.md` → Invariants 10 and 11
- **Build:**
  - Vitest (dev dependency) with an `npm test` script
  - `src/lib/format.ts`:
    - `formatRate("1365.0000") → "1,365"`
    - `formatBoardPrice → "1365"` (boards show no thousands separator)
    - `formatPercent("3.40") → "3.4%"`
    - `formatPoints(delta) → "0.1 pts"`
    - `formatBoardDate(date, tz) → "Sun, 27 Sept 2026"`
    - `formatBoardTime → "10:25 AM"`
    - `formatDayHeading → "Today" / "Saturday, 26 September 2026"`
    - `isSameOrgDay`
  - `src/lib/decimal.ts`: `toDecimalString(Prisma.Decimal)` and `compareDecimalStrings`
  - `src/lib/format.test.ts`
- **Done when:**
  - [ ] Tests cover a Lagos midnight edge case (23:30 UTC on 26 Sept
    is 27 Sept in Lagos)
- **Verify:** standard checks
- **Not in this unit:** UI

### 2.2 UI primitives

- **Goal:** Every shadcn component and small shared component the
  pages need, styled with the tokens.
- **Depends on:** 1.1
- **Read:** `ui-context.md` → Component Library, Border Radius, Icons
- **Design:** `forex.html`, `forex-edit.html`, `banks.html` (for chips, switches and drawers)
- **Build:**
  - shadcn add: button, input, select, textarea, switch, checkbox,
    sheet, dialog, toggle-group, tabs, sonner, tooltip, badge,
    skeleton, label
  - Variants: Button (primary, outline, ghost, destructive; default
    40px, sm 32px, icon 34px); Sheet opens from the right at 460px on
    desktop and as a bottom sheet under 760px
  - Project components in `src/components/`:
    - `InputAddon` (₦ / % prefix and suffix, gold "changed" state)
    - `StatusChip`, `RateDelta`, `CurrencyFlag` (by `flagCode`),
      `BankMark` (logo or letter monogram)
    - `EmptyState`, `Callout` (info / warn)
    - `EntityDrawer` (Sheet with a title, subtitle, a body and a
      footer with Cancel and a primary action; Enter submits)
- **Done when:**
  - [ ] A dev-only `/admin/_kit` page shows every component in every
    state (deleted at 10.6)
- **Verify:** standard checks; compare the kit page with the design files
- **Not in this unit:** data

### 2.3 App shell

- **Goal:** Navigation and page chrome on every admin route.
- **Depends on:** 1.5, 2.2
- **Read:** `ui-context.md` → Layout Patterns, Icons
- **Design:** `dashboard.html` (sidebar at 1440px; top bar and tab bar at 390px)
- **Build:**
  - `src/components/shell/`:
    - `Sidebar`: brand, nav groups, gold active marker, user block with sign-out
    - `MobileTopBar`
    - `BottomTabBar`: Home, Forex, POF, a raised Generate, and More,
      which opens the sidebar as a drawer
    - `PageHeader`: title, description and actions
  - `src/app/admin/layout.tsx` uses the shell
  - A placeholder `page.tsx` with the correct `PageHeader` for all
    eight routes: `/admin`, `forex`, `pof`, `banks`, `templates`,
    `generator`, `history`, `settings`
- **Done when:**
  - [ ] The active nav item is correct on every route
  - [ ] Under 900px the sidebar hides and the top bar and tab bar show
  - [ ] Keyboard focus is visible, and Escape closes the mobile menu
- **Verify:** standard checks; click through every route at both widths
- **Not in this unit:** page content

---

## Phase 3: Banks

### 3.1 Banks list

- **Goal:** `/admin/banks` lists every bank from the database.
- **Depends on:** 1.3, 2.3
- **Read:** `project-overview.md` → Banks; `architecture.md` → Data
  model (Bank, RecordStatus); `code-standards.md` → Next.js, Data and Storage
- **Design:** `banks.html`
- **Build:**
  - `src/features/banks/queries.ts`: `listBanks(orgId)` returning
    each bank with its current PofRate and its rate count; ordered by
    `sortOrder`, then name; ARCHIVED excluded
  - `src/features/banks/components/BanksTable.tsx` (desktop grid; mobile cards)
  - `src/app/admin/banks/page.tsx`
- **Done when:**
  - [ ] Shows bank mark, name, short name, status chip, current rate
    with note, record count, and the Edit / Deactivate / Delete buttons
    (Delete disabled when the count is above 0, with a tooltip)
  - [ ] An empty state appears when there are no banks
- **Verify:** standard checks; compare with `banks.html`
- **Not in this unit:** mutations

### 3.2 Add and edit bank

- **Goal:** Create and edit banks in a drawer, with validation.
- **Depends on:** 3.1
- **Read:** `code-standards.md` → Server Actions, Data and Storage
  (validation rules); `architecture.md` → Invariants 1 and 7
- **Design:** `bank-add.html`, `bank-edit.html`
- **Build:**
  - `src/features/banks/schema.ts`: `bankInput` (name required, short
    name ≤ 14 characters, active flag) and `toBankSlug()`, which
    lowercases and strips "bank", "plc", "ltd" and non-alphanumerics
  - `src/features/banks/actions.ts`: `createBank`, `updateBank`,
    both starting with `requireMember()`; a unique-slug violation
    returns a field error
  - `BankDrawer` with React Hook Form and `zodResolver`
- **Done when:**
  - [ ] "Eco Bank" is rejected when "Ecobank" exists: "A bank called
    “Eco Bank” already exists."
  - [ ] Saving closes the drawer, shows a toast and updates the list without a full reload
  - [ ] An empty short name defaults to the first word of the name
- **Verify:** standard checks; unit tests for `toBankSlug`
- **Not in this unit:** logos (3.3), status and delete (3.4)

### 3.3 Bank logo upload

- **Goal:** Upload a bank logo to Vercel Blob and show it everywhere
  the bank mark appears.
- **Depends on:** 3.2
- **Read:** `architecture.md` → Storage Model, Invariant 12;
  `code-standards.md` → Data and Storage (logo rules)
- **Build:**
  - `src/lib/server/blob.ts`: `uploadImage(file, path)` that checks
    the type (PNG, SVG or JPEG) and size (≤ 1 MB) and uploads with
    `addRandomSuffix: true`; `deleteBlob(pathname)`
  - The logo field in `BankDrawer` with a preview; the action stores
    `logoUrl` (a new URL on every upload)
- **Done when:**
  - [ ] Uploading replaces the mark in the list; the old blob is not
    overwritten (it may be deleted only if no snapshot references it;
    otherwise leave it)
  - [ ] Wrong type or size shows a field error
- **Verify:** standard checks; check the upload in the Blob dashboard
- **Not in this unit:** the organization logo (9.4)

### 3.4 Bank status and delete

- **Goal:** Deactivate, reactivate and, where safe, delete banks.
- **Depends on:** 3.1
- **Read:** `architecture.md` → RecordStatus, Invariant 6
- **Design:** `banks.html`, `bank-delete.html`
- **Build:**
  - Actions:
    - `setBankStatus(id, ACTIVE | INACTIVE)`
    - `deleteBank(id)`: re-checks on the server that the bank has
      zero PofRate rows; otherwise returns "Deactivate this bank
      instead. It has rate history."
  - Confirmation Dialog for delete
- **Done when:**
  - [ ] A deactivated bank shows as Inactive and is not offered for new POF rates
  - [ ] Calling delete on a bank with history is refused on the server, even when called directly
- **Verify:** standard checks
- **Not in this unit:** reordering banks (not in MVP)

---

## Phase 4: Forex

### 4.1 Forex list

- **Goal:** `/admin/forex` shows every currency with its current and previous rate.
- **Depends on:** 1.3, 2.1, 2.3
- **Read:** `project-overview.md` → Forex rates; `architecture.md` →
  Data model (current rate = newest row); `code-standards.md` → Data and Storage
- **Design:** `forex.html`
- **Build:**
  - `src/features/currencies/queries.ts`: `listCurrenciesWithRates(orgId)`,
    which fetches the latest two ForexRate rows per currency in one
    query (window function, or `include` with `take: 2`) and returns
    Decimal strings
  - `ForexTable` (grip column, flag, code and name, We buy, We sell
    with `RateDelta`, spread, updated time, status switch placeholder,
    Edit button) with mobile cards
  - Filter toggle (All / Active / Inactive) via the `?status=` search param
- **Done when:**
  - [ ] Values and deltas match the seeded data; "Updated" shows
    "Today, 10:25 AM" style Lagos times
- **Verify:** standard checks
- **Not in this unit:** editing

### 4.2 Edit forex rate

- **Goal:** Change a currency's buy and sell rates from a drawer.
  Every save inserts a new row.
- **Depends on:** 4.1, 2.2
- **Read:** `architecture.md` → Invariant 2; `code-standards.md` →
  Server Actions, validation rules
- **Design:** `forex-edit.html`
- **Build:**
  - `src/features/forex-rates/schema.ts`: `forexRateInput` (buy > 0,
    sell > 0, sell ≥ buy; decimal strings, at most 4 decimal places)
  - `src/features/forex-rates/actions.ts`: `saveForexRate` inserts a
    ForexRate. If the values equal the current rate, return
    `{ ok: true, data: { unchanged: true } }` and insert nothing.
    Revalidate `/admin`, `/admin/forex` and `/admin/generator`.
  - `ForexRateDrawer`: currency summary, two ₦ inputs, a live spread
    hint (red when sell < buy), and the last 4 changes (query
    `listForexRateHistory(currencyId, 4)`)
- **Done when:**
  - [ ] Saving adds a row; the previous row is unchanged in the database
  - [ ] The toast reads "USD saved. The previous rate is in history."
  - [ ] "No changes to save" when the values are unchanged
- **Verify:** standard checks; check the row count before and after in studio
- **Not in this unit:** adding currencies

### 4.3 Add currency

- **Goal:** Create a currency and its first rate in one step.
- **Depends on:** 4.2
- **Design:** `forex-add.html`
- **Build:**
  - `currencyInput` (code `^[A-Z]{3}$`, name, symbol, flagCode from
    the bundled list or empty, active flag)
  - `createCurrency` action: Currency plus its first ForexRate in one
    transaction; a duplicate code returns "CAD already exists. Edit it
    from the table instead."
  - `CurrencyDrawer`, with the code field forced to uppercase and a
    flag picker from `features/templates/assets/flags`
- **Done when:**
  - [ ] A new currency appears in the table with its flag; a missing
    flag falls back to a code badge
- **Verify:** standard checks
- **Not in this unit:** editing a currency's name or flag (added in
  4.4, which renames Edit to cover both, or deferred; record the
  decision in the tracker)

### 4.4 Currency status

- **Goal:** Activate and deactivate currencies from the table.
- **Depends on:** 4.1
- **Build:** `setCurrencyStatus` action; the status switch with
  optimistic UI (`useOptimistic`) and a toast
- **Done when:**
  - [ ] Inactive rows dim; the filter works; inactive currencies are
    excluded from the generator defaults (checked in 7.2)
- **Verify:** standard checks

### 4.5 Reorder currencies

- **Goal:** Drag rows to set the order used on boards.
- **Depends on:** 4.1
- **Read:** `architecture.md` → Currency.sortOrder
- **Build:** native HTML drag-and-drop on desktop (grip handle) and
  up/down buttons in the row menu on touch screens;
  `reorderCurrencies(ids[])` writes `sortOrder` in one transaction
- **Done when:**
  - [ ] The order persists after a reload and is used by the dashboard and the generator
- **Verify:** standard checks
- **Not in this unit:** reordering banks

---

## Phase 5: POF

### 5.1 POF list

- **Goal:** `/admin/pof` lists banks that have POF rates, with current
  and previous values.
- **Depends on:** 3.1, 2.1
- **Read:** `project-overview.md` → POF rates; `architecture.md` →
  Bank.pofActive, PofRate
- **Design:** `pof.html`
- **Build:**
  - `src/features/pof-rates/queries.ts`: `listPofRates(orgId)`
    (latest two PofRate rows per bank, bank status, `pofActive`)
  - `PofTable` with a change in pts, a note chip, and an Active
    switch that is disabled when the bank is inactive
  - A callout listing active banks with no rate, with an "Add one" link
- **Done when:**
  - [ ] Matches `pof.html` at both widths
- **Verify:** standard checks

### 5.2 Edit and add POF rate

- **Goal:** Set a bank's POF rate and note from a drawer; every save
  inserts a new row.
- **Depends on:** 5.1, 3.4
- **Design:** `pof-edit.html`, `pof-add.html`
- **Build:**
  - `pofRateInput` (0 ≤ rate ≤ 100, at most 2 decimal places; note ≤
    24 characters, optional; `pofActive`)
  - `savePofRate` action: inserts a PofRate if the rate or note
    changed; updates `Bank.pofActive` if it changed; both in one
    transaction
  - `PofRateDrawer`: bank select (active banks only in add mode;
    locked in edit mode), rate with % suffix, note with suggestions,
    active switch, recent history
- **Done when:**
  - [ ] The change is visible in the table and the history
  - [ ] Inactive banks cannot be picked
  - [ ] Setting a rate on a bank without one removes it from the callout
- **Verify:** standard checks

### 5.3 POF visibility switch

- **Goal:** The table switch toggles `Bank.pofActive` directly.
- **Depends on:** 5.1
- **Build:** `setPofActive(bankId, boolean)` with optimistic UI
- **Done when:**
  - [ ] Switching off removes the bank from the generator's POF
    defaults (checked in 7.2)
- **Verify:** standard checks

---

## Phase 6: Templates and rendering

### 6.1 Snapshot builders

- **Goal:** Turn current data into validated snapshots, the only input templates accept.
- **Depends on:** 2.1, 4.1, 5.1
- **Read:** `architecture.md` → Snapshot (the template contract),
  Invariants 3, 4, 10 and 11
- **Build:**
  - `src/features/boards/snapshot.ts`: `boardSnapshotV1` (from the project kit)
  - `src/features/boards/build-snapshot.ts`:
    `buildSnapshot({ org, type, rows, content, now })`, which formats
    date and time in the org time zone, copies brand fields and
    validates with Zod
  - `src/features/boards/defaults.ts`: default content per board type
    (headline, subheading, note, reach, ctaLabel, finePrint), taken
    from the design copy
  - Tests: valid snapshots pass; `sell < buy` fails; the date follows Lagos time
- **Done when:**
  - [ ] Builders are pure: no Prisma, no `Date.now()` inside (`now` is passed in)
- **Verify:** standard checks

### 6.2 Template contract and registry

- **Goal:** One typed way to define, find and render templates.
- **Depends on:** 1.7, 6.1
- **Read:** `architecture.md` → System Boundaries (templates),
  Invariant 4; `code-standards.md` → Styling (template exception)
- **Build:**
  - `src/features/templates/types.ts`:
    `BoardTemplate<T extends BoardType> = { key, version, type, name,
    description, maxRows, render(snapshot): ReactElement }`
  - `src/features/templates/theme.ts`: board tokens (Purple Signal and
    Daylight), merged with snapshot brand colours
  - `src/features/templates/registry.ts`: `getTemplate(key)`,
    `listTemplates(type)`; an unknown key throws a typed error
  - `src/lib/render/`: `renderBoardPng(snapshot, templateKey)` using
    the registry; logos are fetched and embedded as data URIs in
    `assets.ts` with a timeout and a letter-monogram fallback
  - Delete the spike route from 1.7
- **Done when:**
  - [ ] Rendering the same snapshot twice gives identical bytes
- **Verify:** standard checks; a test that renders a fixture snapshot
  and checks the PNG header and size (1080 × 1920)

### 6.3 Purple Signal templates

- **Goal:** Production versions of the dark Forex and POF templates.
- **Depends on:** 6.2
- **Read:** `ui-context.md` → Board Tokens, Typography (board scale),
  Layout Patterns (board safe area)
- **Design:** `stereolinkz-rate-boards.html` (both boards),
  `templates.html`, `generator-edited.html` (WhatsApp overlay)
- **Build:**
  - `src/features/templates/forex/purple-signal.tsx` (maxRows 4)
  - `src/features/templates/pof/purple-signal.tsx` (maxRows 6)
  - The Stereolinkz wordmark component (equalizer bars), used until a logo is uploaded
- **Done when:**
  - [ ] PNGs match the design boards
  - [ ] Nothing important sits in the top 150px or the bottom 320px
  - [ ] Long bank names and 4-digit prices fit without overflow
    (test with "Providus" plus "New account" and with "12,345")
- **Verify:** render fixture snapshots to `tmp/` and compare them with the design by eye

### 6.4 Daylight templates

- **Goal:** Light variants of both templates.
- **Depends on:** 6.3
- **Design:** `templates.html`, `history.html` (a Daylight thumbnail)
- **Build:** `forex/daylight.tsx`, `pof/daylight.tsx`, reusing Purple
  Signal's layout with the Daylight tokens
- **Done when:**
  - [ ] Same checks as 6.3

### 6.5 Board preview components

- **Goal:** Show any template at any size in the admin, using the same
  component that renders the PNG.
- **Depends on:** 6.3
- **Read:** `code-standards.md` → Next.js (preview uses the same template)
- **Build:**
  - `src/components/board/BoardFrame.tsx`: renders the template's
    JSX at 1080 × 1920 in a scaled container (ResizeObserver,
    `transform: scale`, `aspect-ratio: 9/16`)
  - `src/components/board/WhatsAppOverlay.tsx`: progress bars, name,
    caption and Reply bar (preview only)
  - Fonts: the admin already loads Archivo, so the preview matches the PNG
- **Done when:**
  - [ ] The preview and the PNG are visually identical side by side
- **Verify:** standard checks

### 6.6 Templates page and default template

- **Goal:** Browse templates and set the default per board type.
- **Depends on:** 6.4, 6.5
- **Read:** `project-overview.md` → Templates
- **Design:** `templates.html`
- **Build:**
  - `src/app/admin/templates/page.tsx`: tabs (Forex, POF, Custom
    empty state) and cards with live thumbnails built from current
    rates (`BoardFrame`)
  - `setDefaultTemplate(type, key)`, which writes
    `Organization.defaultForexTemplateKey` or `defaultPofTemplateKey`
  - "Use in generator" links to `/admin/generator?type=FOREX&template=forex/daylight`
- **Done when:**
  - [ ] The Default chip moves; the generator preselects the default (checked in 7.1)
- **Verify:** standard checks

---

## Phase 7: Generator

### 7.1 Generator page and state

- **Goal:** The generator loads current data and holds the whole board configuration.
- **Depends on:** 6.6, 4.4, 5.3
- **Read:** `project-overview.md` → Generator, Core User Flow;
  `ui-context.md` → Layout Patterns (generator)
- **Design:** `generator.html`, `generator-pof.html`
- **Build:**
  - `src/app/admin/generator/page.tsx` (server): loads the org,
    active currencies with current rates (by `sortOrder`), active
    banks with `pofActive` and a current rate, templates, and defaults.
    Reads `?type`, `?template` and `?from` (`?from` is used in 8.4).
  - `src/features/boards/components/Generator.tsx` (client): React
    Hook Form holding `{ type, templateKey, rows[], content }`;
    steps 1 (type toggle) and 2 (template options)
  - Changing the type resets the rows and content to that type's defaults
- **Done when:**
  - [ ] Both types load with the correct prefilled rows and the default template selected
- **Verify:** standard checks
- **Not in this unit:** the rates UI, the preview, Generate

### 7.2 Rates and content steps

- **Goal:** Include or exclude rows, edit values, and edit the board text.
- **Depends on:** 7.1
- **Design:** `generator.html`, `generator-edited.html`, `generator-pof.html`
- **Build:**
  - Step 3: a row per item with a checkbox, entity, and inputs (₦
    buy/sell, or rate % plus note); gold "changed" state when the value
    differs from current; a capacity bar ("3 of 4 rows used"), red
    when over the template's `maxRows`
  - Step 4: headline (textarea; a line break becomes a new line),
    subheading, note (forex only) and small print
  - Validation with the shared Zod schemas; the first error shows
    above the Generate button, and the button is disabled
- **Done when:**
  - [ ] Inactive currencies and banks with `pofActive = false` are
    absent by default
  - [ ] Over capacity and invalid values block Generate with the design's messages
- **Verify:** standard checks

### 7.3 Live preview

- **Goal:** The preview updates on every keystroke with no reload.
- **Depends on:** 7.2, 6.5
- **Design:** `generator.html`, `generator-edited.html`
- **Build:**
  - Build the snapshot on the client from the form values with the
    same `buildSnapshot` (`now` = the current time) and pass it to
    `BoardFrame`
  - The "WhatsApp view" switch toggles the overlay
  - Mobile: the preview sits above the steps (max 220px wide); the
    Generate bar sticks above the tab bar
- **Done when:**
  - [ ] Typing into a price updates the board within one frame; no network calls while typing
- **Verify:** standard checks; manual typing test on a phone-sized viewport

### 7.4 Generate board

- **Goal:** Generate saves edited rates, stores an immutable snapshot
  and a PNG, all or nothing.
- **Depends on:** 7.3, 6.2
- **Read:** `architecture.md` → Generate flow, Invariants 2, 3, 5, 8, 12;
  `code-standards.md` → Server Actions (error messages)
- **Build:** `src/features/boards/actions.ts` → `generateBoard(input)`
  1. `requireMember()`, then Zod parse
  2. Load the current rates for the included rows and work out which changed
  3. Build the snapshot on the server (the server's `now`; never trust
     a client date) and check `maxRows`
  4. `renderBoardPng`, then upload to `boards/{orgId}/{boardId}/{imageId}.png`
     (ids pre-generated with cuid)
  5. `$transaction`: insert the changed rates, the RateBoard and the RateBoardImage
  6. If the transaction fails, `deleteBlob`
  7. Revalidate `/admin`, the rate pages and `/admin/history`
  8. Return `{ ok: true, data: { boardId, imageUrl, savedRates } }`
  - Pending UI: the button shows a spinner and "Generating image…"; a double submit is ignored
- **Done when:**
  - [ ] A board row, an image row and a blob all exist; edited rates appear in their history
  - [ ] Forcing a render error leaves no rows and no blob, and shows
    "The image couldn't be generated. Your rates were not changed. Try again."
- **Verify:** standard checks; manual failure test (throw in the render temporarily)

### 7.5 Success state and download

- **Goal:** After Generate the admin can download immediately.
- **Depends on:** 7.4
- **Design:** `generator-done.html`
- **Build:**
  - The success panel: time, the "N edited rates were saved as
    current" note, and Download PNG / View in history / Make another
  - `src/app/api/boards/[id]/download/route.ts` (Node runtime,
    `requireMember`, org check): streams the latest image with
    `Content-Disposition: attachment; filename="stereolinkz-forex-1025am.png"`
- **Done when:**
  - [ ] The download works on iPhone Safari and Android Chrome (a
    saved image can be posted to Status)
  - [ ] Another org's board ID returns 404
- **Verify:** standard checks; test on a real phone

---

## Phase 8: History

### 8.1 History list

- **Goal:** All boards, grouped by Lagos day, from snapshots only.
- **Depends on:** 7.4
- **Read:** `architecture.md` → Invariant 5
- **Design:** `history.html`
- **Build:**
  - `listBoards(orgId, { type?, cursor })` (20 per page, newest first)
  - `HistoryList`: day headings, thumbnails (`BoardFrame` from the
    parsed snapshot), type, time, template chip, rate pills, and
    View / Download / Regenerate; filter via `?type=`; "Load more"
- **Done when:**
  - [ ] After changing a rate, older boards still show the old values
  - [ ] Snapshots that fail to parse show "This board can't be
    displayed" instead of crashing
- **Verify:** standard checks

### 8.2 Board detail

- **Goal:** Inspect one board and compare it with today's rates.
- **Depends on:** 8.1
- **Design:** `history-board.html`
- **Build:** `BoardDetailDialog` (bottom sheet on phones): preview,
  generated by, template and version, image count, the snapshot rates
  with "Now X" in gold where a current rate differs, and a snapshot
  explanation callout; open with `?board=<id>` so the link can be shared
- **Done when:**
  - [ ] "Now X" appears only for changed rows
- **Verify:** standard checks

### 8.3 Regenerate

- **Goal:** Re-render a board from its snapshot, optionally with another template.
- **Depends on:** 8.2, 6.4
- **Read:** `architecture.md` → Generate flow (regenerate)
- **Design:** `history-regenerate.html`
- **Build:** `regenerateBoard(boardId, templateKey)` → render from the
  stored snapshot → upload → insert a RateBoardImage only; the
  template must be of the same type
- **Done when:**
  - [ ] The image count goes up, the original image remains, and the
    rates in the new PNG equal the snapshot
- **Verify:** standard checks

### 8.4 Use these rates again

- **Goal:** Start a new board from an old board's rates.
- **Depends on:** 8.2, 7.2
- **Build:** a link to `/admin/generator?from=<boardId>`; the generator
  prefills rows from the snapshot (matching by `currencyId`/`bankId`;
  inactive or missing entities are skipped with a notice); the values
  show as edited (gold)
- **Done when:**
  - [ ] Generating from it creates a new board and saves those rates as current
- **Verify:** standard checks

---

## Phase 9: Dashboard and settings

### 9.1 Dashboard stats and rate panels

- **Goal:** The overview page with inline edits.
- **Depends on:** 4.2, 5.2, 7.4
- **Design:** `dashboard.html`
- **Build:**
  - `getDashboard(orgId)`: active and total currency and bank counts,
    boards today (Lagos day), last rate change
  - Stat strip; Today's forex and Today's POF panels whose pencil buttons open the existing drawers
- **Done when:**
  - [ ] Editing from the dashboard updates the panels, the stats and the recent changes
- **Verify:** standard checks

### 9.2 Recent boards and changes

- **Goal:** The bottom row of the dashboard.
- **Depends on:** 9.1, 8.2
- **Build:**
  - `listRecentRateChanges(orgId, 5)`: ForexRate and PofRate merged
    by `createdAt`, each with the previous value for "from → to" and
    a direction
  - The 3 latest boards open the detail dialog
- **Done when:**
  - [ ] Matches `dashboard.html`; empty states for a new org
- **Verify:** standard checks

### 9.3 Settings: company

- **Goal:** Edit the organization name, WhatsApp number and email.
- **Depends on:** 2.3
- **Read:** `project-overview.md` → Settings; `architecture.md` → Organization
- **Design:** `settings.html`
- **Build:** `orgSettingsInput` and the `updateOrgSettings` action;
  the settings page sections (Company, Brand colours, Boards, and a
  disabled Team section)
- **Done when:**
  - [ ] Changes appear on new boards; old boards are unchanged
- **Verify:** standard checks

### 9.4 Settings: logo and brand colours

- **Goal:** An organization logo and three brand colours feed the templates.
- **Depends on:** 9.3, 3.3, 6.3
- **Build:**
  - Logo upload (the same blob helper)
  - Colour inputs with hex validation and a contrast warning (white
    on the buy colour and ink on the sell colour must reach 4.5:1)
  - Templates read colours from `snapshot.content.brand`
- **Done when:**
  - [ ] Changing the sell colour changes the next generated board only
- **Verify:** standard checks

### 9.5 Settings: board defaults

- **Goal:** Time zone and default small print.
- **Depends on:** 9.3
- **Build:** a time zone select (IANA list: Africa/Lagos, Europe/London,
  America/New_York and others) and a default small print field used by
  `defaults.ts`
- **Done when:**
  - [ ] Changing the time zone changes the date on new boards
- **Verify:** standard checks

---

## Phase 10: Hardening and launch

### 10.1 States audit

- **Goal:** Every page has loading, empty and error states.
- **Build:** a `loading.tsx` with skeletons per route; an `error.tsx`
  per route group; empty states per `project-overview.md`
- **Done when:**
  - [ ] Slow 3G throttling shows skeletons, not blank screens

### 10.2 Accessibility

- **Goal:** Usable with a keyboard and a screen reader.
- **Done when:**
  - [ ] Every input has a label; drawers trap focus and return it; Escape closes
  - [ ] Switches announce their state; colour is never the only signal
    (the arrows carry direction)
  - [ ] Text contrast is AA against the tokens

### 10.3 Security review

- **Goal:** Invariant 7 holds everywhere.
- **Build:** a `scripts/check-actions.ts` (or a lint rule) that fails
  if any `actions.ts` export or route handler lacks a `requireMember()`
  call
- **Done when:**
  - [ ] Every query filters by `organizationId`
  - [ ] Error messages leak no Prisma details
  - [ ] Blob uploads validate type and size on the server
  - [ ] Only the board download route exists under `/api`

### 10.4 Mobile pass

- **Goal:** The full flow works at 390px.
- **Done when:**
  - [ ] Every design file matches at 390px; no horizontal scroll
  - [ ] Update a rate, then generate, then download, completed on a real phone in under 60 seconds

### 10.5 Performance

- **Done when:**
  - [ ] Warm generate completes in under 3 seconds; PNG under 1.5 MB
  - [ ] Fonts and flags are loaded once per server instance
  - [ ] Admin pages score LCP under 2.5 seconds on Vercel Speed Insights

### 10.6 Production launch

- **Goal:** Live for Stereolinkz.
- **Build:**
  - Remove `/admin/_kit`
  - `prisma migrate deploy` on the production database; seed the
    production org and owner only (no sample rates, or real ones
    entered by the owner)
  - Production env vars; custom domain if wanted
- **Done when:**
  - [ ] Every item in `project-overview.md` → Success Criteria is
    checked on production and recorded in the tracker

---

## Branching and review

- One branch per unit: `unit/3.2-bank-drawer`.
- One pull request per unit. Its description has the unit ID, a
  summary, screenshots at 1440px and 390px for UI units, and the
  completed Done-when list.
- Merge only when the standard checks pass on the Vercel Preview.

## Coverage map

| Requirement | Units |
| ----------- | ----- |
| Banks are dynamic records | 1.3, 3.1–3.4 |
| Currencies are dynamic records | 4.1–4.5 |
| Rate history is preserved | 1.2, 4.2, 5.2, 7.4 |
| Snapshots are immutable | 6.1, 7.4, 8.1–8.3 |
| Templates are separate from data | 6.2–6.6 |
| 1080 × 1920 server-rendered PNG | 1.7, 6.2, 7.4 |
| Live preview | 6.5, 7.3 |
| Admin routes protected on the server | 1.4, 1.5, 10.3 |
| Phone-first generator | 2.3, 7.3, 10.4 |
| Every design file implemented | login 1.4; dashboard 9.1–9.2; forex 4.1–4.3; pof 5.1–5.2; banks 3.1–3.4; templates 6.6; generator 7.1–7.5; history 8.1–8.3; settings 9.3–9.5 |
