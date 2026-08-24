# Out-of-Scope Discoveries — Phase 1

Items found during Plan 01 execution that are outside the plan's scope (per executor
scope-boundary rules these are logged, not fixed).

## From Plan 01-01 (2026-08-24)

1. **Pre-existing tracked research cache blobs** — several
   `.planning/research/.cache/*.json` files were committed by earlier planning
   commits *before* any ignore rule existed. Plan 01-01 Task 2 added
   `.planning/research/.cache/` to `.gitignore`, which prevents future additions
   but does not untrack already-committed files. Untracking them
   (`git rm --cached`) was deemed out of scope for a repo-hygiene plan focused on
   service paths. Suggested owner: orchestrator / next planning-docs commit.
