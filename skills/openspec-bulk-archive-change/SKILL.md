---
name: openspec-bulk-archive-change
description: Archive multiple completed OpenSpec changes at once. Use when archiving several parallel changes. Also use for a plural archive request - "openspec bulk-archive", "opsx bulk-archive", "openspec archive all", or "openspec archive these changes".
allowed-tools: Bash(openspec:*)
license: MIT
compatibility: Requires openspec CLI.
metadata:
  author: openspec
  version: "1.0"
---

Archive multiple completed changes in a single operation.

**Before you start**
- If the user names a store, or the work lives in one, read `references/stores.md` and keep its `--store <id>` on every OpenSpec command.
- Before the first write (`openspec new change`, `openspec archive`, a spec sync, or an artifact file), run `openspec list --json`. If it reports `"root": null`, the project does not use OpenSpec yet, and nothing may create it as a side effect: no `openspec init` until the user asks, and no hand-made `openspec/` files. If you picked this workflow yourself, drop OpenSpec and answer the request normally. If the user named OpenSpec, this skill, or its command, stop and ask whether to set the project up (`openspec init`), target a store they have (`--store <id>`), or continue without OpenSpec, and wait for the answer. One exception: when a `status` error starts with `Declared in` or `Invalid store declaration in`, the project uses a store this machine cannot resolve; follow `references/project-check.md`.

The CLI archives each change: it merges the change's delta specs, validates them, and moves it, or refuses without changing anything. Your part is resolving spec conflicts between changes by checking the codebase for what is actually implemented.

`<capability-path>` is the spec directory relative to `specs/` (for example, `user-auth` or `identity/user-auth`). Preserve the full path from each delta spec when resolving its main spec.

**Input**: None required (prompts for selection)

**Steps**

1. **Get active changes**

   Run `openspec list --json`. If there are no active changes, say so and stop.

2. **Ask which changes to archive**

   Ask the user to choose changes (multi-select). Show each change name and task status from the list output, and include an "All changes" option. Any number of selections works (1+ is fine, 2+ is the typical use case). **IMPORTANT**: Do NOT auto-select. Always let the user choose.

   Then run `openspec instructions archive --change "<selected-change>" --json` once for one selected change. It may return `context` and `operationGuidance` for the whole batch; follow `references/runtime-inputs.md`. This lookup is advisory: if it fails or returns invalid JSON, continue with neither.

3. **Gather status for every selected change**

   Run `openspec list --json` once with the same selected-root flags for task progress. For each selected change, find the entry in `changes` whose `name` exactly matches it, and require nonnegative integer `totalTasks` and `completedTasks`, with `completedTasks <= totalTasks`. Incomplete tasks = `totalTasks - completedTasks`; when `totalTasks` is zero, note "No tasks". If the lookup fails, returns invalid JSON, or omits, duplicates, or miscounts a selected change, report it and stop before archiving anything. The CLI resolves the schema's tracked task files and counts only `x`/`X` checkbox markers as complete; other markers remain incomplete. Never infer completion from artifact status or the absence of a `tasks.md`.

   For each change, run `openspec status --change "<name>" --json` and note its `schemaName` and:
   - artifacts that are neither `done` nor `skipped`
   - its delta specs: `artifactPaths.specs.existingOutputPaths` is the only source. If it is missing or empty, the change has no specs to merge; never infer them from other artifacts
   - each delta's `<capability-path>` and its requirement names (`### Requirement: <name>` lines)

4. **Detect and resolve spec conflicts**

   Build a map keyed by `<capability-path>`, the exact path relative to `specs/`:

   ```text
   identity/user-auth -> [change-a, change-b]  <- CONFLICT (2+ changes)
   billing/user-auth  -> [change-c]            <- OK (different full path)
   ```

   A conflict exists when 2+ selected changes have delta specs for the exact same `<capability-path>`. For each conflict, read each change's delta and search the codebase for code and tests implementing its requirements, then decide per delta:
   - Only one change is implemented: apply that one's delta and exclude the other's.
   - Both are implemented: apply both in chronological order (older first, so the newer one takes precedence).
   - Neither is implemented: exclude both and warn the user.

   Record an inclusion or exclusion decision for every delta spec, keyed by change and `<capability-path>`, with the evidence you found. A single change can have both included and excluded delta specs. A change whose deltas are all excluded is archived with `--skip-specs`. If a change has both included and excluded deltas, run the `/openspec-sync-specs` workflow for that change with only its included delta paths, wait for it to finish, then archive it with `--skip-specs`.

5. **Show one status table and confirm once**

   ```markdown
   | Change            | Artifacts | Tasks | Specs   | Conflicts              | Status |
   |-------------------|-----------|-------|---------|------------------------|--------|
   | schema-management | Done      | 5/5   | 2 delta | None                   | Ready  |
   | add-oauth         | Done      | 4/4   | 1 delta | identity/user-auth (!) | Ready* |
   | add-verify-skill  | 1 left    | 2/5   | None    | None                   | Warn   |
   ```

   Under the table, give each conflict's resolution (for example, "identity/user-auth spec: Will apply add-oauth then add-jwt (both implemented, chronological order)") and each warning (incomplete artifacts or tasks). Then ask a single question: "Archive all N changes", "Archive only the N ready changes (skip incomplete)", or "Cancel". Make clear that incomplete changes are archived with warnings.

   Route on the answer by intent, not by exact label:
   - "Cancel" — stop, do not archive. Report that nothing was archived and skip the remaining steps.
   - The archive-everything option — continue with every selected change.
   - The ready-only option — continue with only the changes the status table marks `Ready` or `Ready*`, and record the rest as Skipped. If a `Ready*` change's conflict partner is skipped, re-derive that conflict's resolution using only the changes being archived.
   - Anything else — ask again rather than archiving.

6. **Archive each confirmed change, in resolved order**

   Conflicting changes go in the order step 4 decided; the rest in any order. For each:
   ```bash
   openspec archive "<name>" --json --yes
   ```
   Add `--skip-specs` when all of its deltas are excluded. Never pass `--no-validate`. The user confirmed the batch in step 5, which is what `--yes` stands for.

   Read the JSON. An `archive` object means it was archived (`archivedAs`, `specsUpdated`, `totals`). Otherwise the CLI refused and changed nothing for that change: record it as Failed with each `status` message (for example `archive_target_exists`), and continue with the rest of the batch. If a failed change was the earlier half of a conflict, re-derive that conflict before archiving its partner.

7. **Summarize**

   ```markdown
   ## Bulk Archive Complete

   Archived 2 changes:
   - schema-management -> archive/2026-01-19-schema-management/
   - add-oauth -> archive/2026-01-19-add-oauth/

   Skipped 1 change:
   - add-verify-skill (user chose not to archive incomplete)

   Spec sync summary:
   - 3 delta specs merged into main specs
   - 1 delta spec sync skipped (add-jwt, identity/user-auth: implementation not found)
   - 1 conflict resolved (identity/user-auth: synced add-oauth, skipped add-jwt)
   ```

   List any Failed change with its reason. When there were no active changes, say "No active changes found. Create a new change to get started."

**Guardrails**
- Always prompt for selection, never auto-select, and use a single confirmation for the whole batch
- Never archive after the user cancels the confirmation — a cancelled batch archives nothing
- Let `openspec archive` merge, validate, and move each change. Do not edit main specs or move change directories by hand
- Report every excluded delta as `sync skipped` with its change, `<capability-path>`, and reason; that is distinct from skipping the archive
- A failed change never stops the rest of the batch
