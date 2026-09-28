# Progress Tracker

The live status of the build. Unit definitions live in
`implementation-plan.md`; this file records where the work stands, what
was decided and what is still unclear.

Update it at the end of every unit (see `ai-workflow-rules.md` →
Before Moving to the Next Unit).

## Current Status

| Field | Value |
| ----- | ----- |
| Current phase | 0: Pre-flight |
| Current unit | 0.1 Resolve blocking questions |
| Next unit | 0.2 Accounts and environment, then 1.1 Project scaffold |
| Blocked by | Open questions Q1 and Q2 (owner) |
| Last updated | 2026-09-27 |

Status values: `todo` · `in progress` · `review` · `done` · `blocked`

## Status Board

### Phase 0: Pre-flight (owner)

| Unit | Title | Status | PR | Notes |
| ---- | ----- | ------ | -- | ----- |
| 0.1 | Resolve blocking questions | blocked | — | Waiting on Q1, Q2 |
| 0.2 | Accounts and environment | todo | — | |

### Phase 1: Foundation

| Unit | Title | Status | PR | Notes |
| ---- | ----- | ------ | -- | ----- |
| 1.1 | Project scaffold | todo | | |
| 1.2 | Database and Prisma | todo | | Needs 0.1 |
| 1.3 | Seed | todo | | |
| 1.4 | Clerk sign-in | todo | | |
| 1.5 | Membership guard | todo | | |
| 1.6 | First deploy | todo | | |
| 1.7 | Render spike | todo | | Record render time |

### Phase 2: Shared foundations

| Unit | Title | Status | PR | Notes |
| ---- | ----- | ------ | -- | ----- |
| 2.1 | Formatting and test setup | todo | | |
| 2.2 | UI primitives | todo | | |
| 2.3 | App shell | todo | | |

### Phase 3: Banks

| Unit | Title | Status | PR | Notes |
| ---- | ----- | ------ | -- | ----- |
| 3.1 | Banks list | todo | | |
| 3.2 | Add and edit bank | todo | | |
| 3.3 | Bank logo upload | todo | | |
| 3.4 | Bank status and delete | todo | | |

### Phase 4: Forex

| Unit | Title | Status | PR | Notes |
| ---- | ----- | ------ | -- | ----- |
| 4.1 | Forex list | todo | | |
| 4.2 | Edit forex rate | todo | | |
| 4.3 | Add currency | todo | | |
| 4.4 | Currency status | todo | | |
| 4.5 | Reorder currencies | todo | | |

### Phase 5: POF

| Unit | Title | Status | PR | Notes |
| ---- | ----- | ------ | -- | ----- |
| 5.1 | POF list | todo | | |
| 5.2 | Edit and add POF rate | todo | | |
| 5.3 | POF visibility switch | todo | | |

### Phase 6: Templates and rendering

| Unit | Title | Status | PR | Notes |
| ---- | ----- | ------ | -- | ----- |
| 6.1 | Snapshot builders | todo | | |
| 6.2 | Template contract and registry | todo | | Deletes spike route |
| 6.3 | Purple Signal templates | todo | | |
| 6.4 | Daylight templates | todo | | |
| 6.5 | Board preview components | todo | | |
| 6.6 | Templates page and default template | todo | | |

### Phase 7: Generator

| Unit | Title | Status | PR | Notes |
| ---- | ----- | ------ | -- | ----- |
| 7.1 | Generator page and state | todo | | |
| 7.2 | Rates and content steps | todo | | |
| 7.3 | Live preview | todo | | |
| 7.4 | Generate board | todo | | |
| 7.5 | Success state and download | todo | | Test on a real phone |

### Phase 8: History

| Unit | Title | Status | PR | Notes |
| ---- | ----- | ------ | -- | ----- |
| 8.1 | History list | todo | | |
| 8.2 | Board detail | todo | | |
| 8.3 | Regenerate | todo | | |
| 8.4 | Use these rates again | todo | | |

### Phase 9: Dashboard and settings

| Unit | Title | Status | PR | Notes |
| ---- | ----- | ------ | -- | ----- |
| 9.1 | Dashboard stats and rate panels | todo | | |
| 9.2 | Recent boards and changes | todo | | |
| 9.3 | Settings: company | todo | | |
| 9.4 | Settings: logo and brand colours | todo | | |
| 9.5 | Settings: board defaults | todo | | |

### Phase 10: Hardening and launch

| Unit | Title | Status | PR | Notes |
| ---- | ----- | ------ | -- | ----- |
| 10.1 | States audit | todo | | |
| 10.2 | Accessibility | todo | | |
| 10.3 | Security review | todo | | |
| 10.4 | Mobile pass | todo | | |
| 10.5 | Performance | todo | | |
| 10.6 | Production launch | todo | | |

## Success Criteria Checklist

Tick on production during 10.6 (from `project-overview.md`).

- [ ] 1. Add a currency, edit its rate, see the previous rate in history
- [ ] 2. A non-member with a Clerk session gets no admin data and cannot run actions
- [ ] 3. Add a bank with a logo and a POF rate without code or schema changes
- [ ] 4. A bank with history cannot be deleted; deactivating it hides it from new boards only
- [ ] 5. Generator preview updates while typing, with no reload
- [ ] 6. Generate produces a 1080 × 1920 PNG in Blob, downloadable from history
- [ ] 7. An old board still shows and regenerates its original rates after a rate change
- [ ] 8. The PNG matches the preview; ₦, flags and logos render; the date uses Lagos time
- [ ] 9. The full flow works on a 390px phone
- [ ] 10. `npm run build` passes, strict TypeScript, no `any`

## Decisions

Newest first. Format: date, unit, decision, reason.

- 2026-09-27 (planning): Vitest added as a dev-only dependency for
  pure functions (formatting, slugs, snapshot builders, render smoke
  test). No end-to-end test framework in the MVP.
- 2026-09-27 (planning): Organization gets `email`,
  `defaultFinePrint`, `defaultForexTemplateKey` and
  `defaultPofTemplateKey`, so Settings and Templates have somewhere to
  store their values.
- 2026-09-27 (planning): The snapshot content includes subheading,
  note, reach, ctaLabel, finePrint and timeLabel, to match the
  generator's content step.
- 2026-09-27 (planning): Visibility lives on the parent record:
  `Currency.status`, `Bank.status` and `Bank.pofActive`. Rate rows
  have no active flag.
- 2026-09-27 (planning): Rates are append-only; the current rate is
  the newest row.
- 2026-09-27 (planning): Boards store a Zod-validated JSON snapshot.
  Images live in their own table, so regenerate adds a row.
- 2026-09-27 (planning): Templates are code (a registry of key and
  version). The database stores only the key and version.
- 2026-09-27 (planning): Organization-scoped schema from day one; the
  MVP has one seeded org (Stereolinkz).
- 2026-09-27 (planning): Rendering uses Satori and resvg on the Node
  runtime. The preview uses the same template component.
- 2026-09-27 (planning): Brand is Stereolinkz, purple and gold. Board
  dates use Africa/Lagos time.

## Open Questions

Blocking questions stop the listed unit. Answer them here, then move
the answer to Decisions.

| # | Question | Blocks | Owner | Answer |
| - | -------- | ------ | ----- | ------ |
| Q1 | Can one bank have two POF rates at once (for example new account 3.4% and existing account 3.1%)? If yes, a `PofOffer` model is added before the first migration. | 1.2 | Gambino | |
| Q2 | Are POF rates per month or per deal? Boards currently say "Per month". | 1.2, 6.3 | Gambino | |
| Q3 | The real WhatsApp number for boards (placeholder +234 800 000 0000). | 1.3 (seed), 6.3 | Gambino | |
| Q4 | The Stereolinkz logo file. Until then the equalizer-bar wordmark is used. | 9.4 (not blocking) | Gambino | |
| Q5 | Who else needs access at launch (their Clerk user IDs)? | 10.6 | Gambino | |
| Q6 | Should the Edit drawer on the forex page also allow renaming a currency and changing its flag? | 4.3 | Gambino | |

## Blockers

Anything stopping progress that is not a product question (for
example a service outage, a missing credential, or a failing
dependency).

- None

## Environment Variables

| Variable | Used by | Set in |
| -------- | ------- | ------ |
| `DATABASE_URL` | Prisma | local, Vercel |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Clerk | local, Vercel |
| `CLERK_SECRET_KEY` | Clerk | local, Vercel |
| `NEXT_PUBLIC_CLERK_SIGN_IN_URL` = `/login` | Clerk | local, Vercel |
| `BLOB_READ_WRITE_TOKEN` | Vercel Blob | local, Vercel |
| `SEED_OWNER_CLERK_USER_ID` | `prisma/seed.ts` | local, prod seed only |

## Unit Reports

Add one report per completed unit, newest first. Copy this template:

```
### <unit id> <title>: <date>
- PR: <link>
- Built: <files created or changed, one line each>
- Done-when: all checked / exceptions: <list>
- Verify: build ✓ lint ✓ tsc ✓ test ✓ 1440px ✓ 390px ✓
- Decisions: <new decisions, also added to Decisions above>
- Questions raised: <new Qs, also added to Open Questions>
- Context files updated: <which, or "none">
- Follow-ups: <anything deferred, with the unit it belongs to>
```

_No units completed yet._

## Session Log

One line per working session, newest first:
`<date>: <units touched>: <one-line outcome>`

- 2026-09-27: planning: context files, schema draft, snapshot
  contract, page designs and implementation plan ready.
