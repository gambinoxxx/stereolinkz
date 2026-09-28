# Progress Tracker

Update this file after every meaningful implementation
change.

## Current Phase

- Phase 1: Foundation, in progress

## Current Goal

- Phase 1: Database and Prisma (waiting for the owner to add `DATABASE_URL` to `.env.local`)

## Completed

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

- None.

## Next Up

- Phase 1: Database and Prisma
- Phase 1: Seed
- Phase 1: Authentication (Clerk sign-in)

## Open Questions

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

## Session Notes

- 2026-09-28: Branch `phase-1-foundation`. Project setup done and
  committed; build, lint, `tsc --noEmit` and `prettier --check` pass.
  Stopped at the first ⏸: the owner must add `DATABASE_URL` to
  `.env.local`. `.gitignore` ignores `.env*` but keeps `.env.example`.
