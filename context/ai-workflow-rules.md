# AI Workflow Rules

## Approach

Build RateBoard incrementally using a spec-driven workflow. The context
files define:

- what to build (`project-overview.md`)
- the order to build it in and how to check each step (`implementation-plan.md`)
- how the system is shaped (`architecture.md`)
- how code is written (`code-standards.md`)
- how it looks (`ui-context.md` plus the HTML designs in `docs/design/`)
- where the work stands (`progress-tracker.md`)

Always implement against these specs. Do not infer or invent behaviour
from scratch.

Read order at the start of every session:

1. `progress-tracker.md`: current phase and goal, what is in progress,
   open questions, and the Session Notes from last time
2. The current phase in `implementation-plan.md`
3. The context sections that phase's **Read** list names (at minimum
   the invariants in `architecture.md`)
4. The design file(s) that phase's **Design** list names

Every phase follows the same loop (detailed in
`implementation-plan.md` → How to use this plan):

1. Post a plan for the whole phase: build order, files to touch, and questions.
2. Build the phase's scope, pausing at its stop points.
3. Check Done when, then run Verify.
4. Update the tracker after every piece of work (see Updating the
   Progress Tracker below).
5. Move to the next phase.

## Scoping Rules

- Work on one phase at a time. Inside a phase, build in the order its
  **Build** section lists, and get each piece working before the next
  (for example, the bank list works before the add drawer is built).
- Prefer small, verifiable increments over large speculative changes.
  Commit each working piece.
- Follow the phase order in `implementation-plan.md`. Do not start a
  phase whose **Depends on** phases are not complete in the tracker. The Phase 1 render
  spike comes early on purpose, to prove the riskiest part first.
- A phase's **Not in this phase** list is binding. Note needed work
  under Next Up or Open Questions in the tracker instead of doing it.
- Do not generate the whole application in one step.

## When to Split Work

Within a phase, split a single step (one commit, one piece of work) if it combines:

- Database schema or migration changes with UI changes
- The render pipeline (`lib/render`, templates) with page UI or CRUD
- More than one feature folder's server actions (e.g. banks and
  pof-rates)
- Auth/permission changes with anything else
- Behaviour not clearly defined in the context files or design HTML

If a change cannot be verified end to end quickly, the scope is too
broad. Split it.

## Handling Missing Requirements

- Do not invent product behaviour not defined in the context files or
  the design HTML.
- If a requirement is ambiguous, resolve it in the relevant context
  file before implementing, and note the decision in
  `progress-tracker.md` → Architecture Decisions.
- If a requirement is missing, add it as an open question in
  `progress-tracker.md` → Open Questions before continuing. Build the parts that don't
  depend on it.
- The HTML designs show sample data (USD/GBP/EUR, Wema/Providus/…).
  Treat it as example records, never as a list to hard-code.
- Where the design HTML and a context file disagree, the context file
  wins. Flag the conflict in `progress-tracker.md` → Open Questions.

## Protected Files

Do not modify the following unless explicitly instructed:

- `components/ui/*`: generated shadcn/ui components (restyle through tokens; regenerate with the CLI)
- `docs/design/*`: page design HTML (the spec)
- Applied migrations in `prisma/migrations/*`. Create a new migration;
  never edit one that has run.
- `features/boards/snapshot.ts` versions that are already in use. Add
  `boardSnapshotV2` instead of changing V1.
- Published template versions. A visual change to a template used by
  existing boards bumps its `version`.
- Third-party library internals and `node_modules`
- `.env*` files (list required variables in `architecture.md` →
  Environment Variables and in `.env.example` instead)
- Phase definitions in `implementation-plan.md`. Change them only after
  recording the reason in the tracker's Architecture Decisions.
- `context/*.md` rules and invariants. Update them only through the
  Keeping Docs in Sync process below, never to make an implementation pass.

## Keeping Docs in Sync

Update the relevant context file whenever implementation changes:

- System architecture or boundaries → `architecture.md`
- Storage model, schema or snapshot shape → `architecture.md` (and
  `prisma/schema.prisma`)
- Code conventions or standards → `code-standards.md`
- Tokens, components or layout patterns → `ui-context.md`
- Feature scope → `project-overview.md`
- Phase scope or order → `implementation-plan.md` (with a Decision entry)
- New environment variables → `architecture.md` → Environment
  Variables and `.env.example`
- Progress, decisions and open questions → `progress-tracker.md`
  (after every piece of work)

## Updating the Progress Tracker

`progress-tracker.md` starts empty and is the running record of the
build. Update it **after every meaningful piece of work**: each commit
that makes something work, each decision, each question. Never only
at the end of a phase. Keep entries short and dated (`2026-10-02:`).

| Section | What goes there | When |
| ------- | --------------- | ---- |
| Current Phase | `Phase <n>: <title>, in progress` / `complete`, or `Not started` | When a phase starts or finishes |
| Current Goal | The piece being built right now, in one line (e.g. "Phase 3: bank add/edit drawer") | When you start each piece |
| Completed | One line per finished piece, newest first: date, phase, what now works, key files | When a piece works and is committed |
| In Progress | What is started but not finished, and what is left | Whenever you stop mid-piece |
| Next Up | The next one to three pieces, from `implementation-plan.md` | After every update |
| Open Questions | Unresolved product or technical questions, and what they block. Remove a question once it is answered, and record the answer under Architecture Decisions | When one arises or is answered |
| Architecture Decisions | Decisions that affect the system design or data model, with why. Pre-build decisions are in `architecture.md` → Settled Decisions; do not repeat them | When decided |
| Session Notes | Everything the next session needs to resume: what is committed but not pushed, state of the work, commands to run, anything half-done or surprising (e.g. "render spike: warm 640 ms on Preview") | End of every session |

When a phase finishes, also add a summary line to Completed:
`<date>: Phase <n> complete. All Done-when items checked, tagged
phase-<n>-complete.`

## Before Moving to the Next Phase

1. Every **Done when** item for the phase in `implementation-plan.md`
   is checked, and everything in the phase works end to end,
   including empty, loading and error states from the design.
2. No invariant defined in `architecture.md` was violated. Check
   especially: rates are insert-only, snapshots are immutable, every
   action calls `requireMember()`, and nothing is hard-coded to a bank
   or currency.
3. Every page the phase touched matches its design file at 1440px and at 390px.
4. `progress-tracker.md` shows the phase as complete under Current
   Phase and Completed, with Next Up, Open Questions, Architecture
   Decisions and Session Notes current.
5. `npm run build` passes; `npm run lint`, `npx tsc --noEmit` and
   `npm test` are clean.
