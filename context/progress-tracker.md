# Progress Tracker

Update this file after every meaningful implementation
change.

## Current Phase

- Phase 1: Foundation, complete

## Current Goal

- Phase 2: Shared foundations, plan posted (formatting and tests first)

## Completed

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

- Phase 2: Formatting and tests (Vitest, `lib/format.ts`, `lib/decimal.ts`)
- Phase 2: UI primitives (shadcn), then project components
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

## Session Notes

- 2026-09-29: Working on `main` (no branches). Phase 1 closed out and
  tagged `phase-1-complete`. `phase-1-foundation` was already gone
  locally and on GitHub (deleted on merge). Production:
  https://stereolinkz-czj8.vercel.app (Vercel project
  `stereolinkz-czj8`, deploys every push to `main`).
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
