# Prompt: Documentation update — add Crypto as Phase 10

This is a **documentation-only** task. It adds the crypto section to
the project docs and renumbers the phases:
- **Phase 10** is now **Crypto**
- **Phase 11** is now **Hardening and launch** (it used to be Phase 10)

Don't write or change any application code, schema or migration in
this task. The crypto code is built in Phase 10 (`prompts/phase-10-crypto.md`).

**When to run it:** now, if no phase is in progress, or straight after
Phase 9 is tagged. Don't run it in the middle of a phase.

The changes are in `docs/updates/crypto-docs.patch` (a unified diff
against the original kit versions of the context files). The new
crypto designs are already in `docs/design/` (`crypto*.html`,
`generator-crypto.html`, `stereolinkz-crypto-board.html`).

---

## Steps

1. **Check the starting point:**
   - `git fetch && git status`: on `main`, clean, not behind `origin/main`
   - no phase in progress in `context/progress-tracker.md`
   - `docs/updates/crypto-docs.patch` exists
   - the crypto design files exist in `docs/design/`

   If anything is missing, stop and tell me.
2. **Apply the patch to the repo's context files:**
   - try `git apply --3way docs/updates/crypto-docs.patch` first
   - the repo copies were edited during earlier phases, so some hunks
     may not apply cleanly. For those, apply the change **by hand**:
     read the hunk, find the matching place in the current file, and
     make the same edit
   - **keep every edit the repo copies already have.** Never replace a
     context file wholesale with an older or newer copy.

   Files touched: `context/project-overview.md`,
   `context/architecture.md`, `context/ui-context.md`,
   `context/code-standards.md`, `context/implementation-plan.md`.
3. **Check the renumbering everywhere.** Search the repo (`context/`,
   `prompts/`, `README` and code comments) for "Phase 10":
   - references to hardening, launch or removing `/admin/dev-kit` now
     say **Phase 11**
   - the new Phase 10 section is "Phase 10: Crypto"
   - the intro of `implementation-plan.md` says 11 phases
   - prompt files for finished phases are history: leave them as they are
4. **Update `context/progress-tracker.md`** (don't apply the patch to it):
   - **Open Questions:** "launch users' Clerk IDs … Needed by Phase 10"
     → "Needed by Phase 11". Add: "Starting coin list, rates and icons
     for production. Needed by Phase 10."
   - **Architecture Decisions:** a dated entry, "Crypto added as Phase
     10 (coins, crypto rates, crypto boards); Hardening and launch moved
     to Phase 11. Crypto rates are naira per $1 of coin value."
   - **Next Up:** if Phase 9 is complete, "Phase 10: Crypto"; otherwise
     leave Phase 9 and add Phase 10 after it
   - **Session Notes:** what was updated, and which hunks were applied by hand
5. **Check the result:**
   - `npm run format:check` passes (run `npm run format` on the
     touched Markdown if needed)
   - show me `git diff --stat` and the new Phase 10 section of
     `implementation-plan.md`
6. **Commit:**
   `docs: add crypto as phase 10, move hardening to phase 11`. Keep
   `docs/updates/crypto-docs.patch` in the repo as a record.
7. ⏸ **Ask me before pushing.** Docs-only, so the standard checks just
   need to pass (`build`, `lint`, `tsc --noEmit`, `test`,
   `format:check`). No tag for this commit.
