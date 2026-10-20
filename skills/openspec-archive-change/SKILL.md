---
name: openspec-archive-change
description: Archive a completed OpenSpec change in the experimental workflow. Use when the user wants to finalize and archive a change after implementation is complete. Also use when the user says "openspec archive" or "opsx archive".
allowed-tools: Bash(openspec:*)
license: MIT
compatibility: Requires openspec CLI.
metadata:
  author: openspec
  version: "1.0"
---

Archive a completed change in the experimental workflow: merge its delta specs into the main specs, validate them, and move the change to the archive.

**Before you start**
- If the user names a store, or the work lives in one, read `references/stores.md` and keep its `--store <id>` on every OpenSpec command.
- Before the first write (`openspec new change`, `openspec archive`, a spec sync, or an artifact file), run `openspec list --json`. If it reports `"root": null`, the project does not use OpenSpec yet, and nothing may create it as a side effect: no `openspec init` until the user asks, and no hand-made `openspec/` files. If you picked this workflow yourself, drop OpenSpec and answer the request normally. If the user named OpenSpec, this skill, or its command, stop and ask whether to set the project up (`openspec init`), target a store they have (`--store <id>`), or continue without OpenSpec, and wait for the answer. One exception: when a `status` error starts with `Declared in` or `Invalid store declaration in`, the project uses a store this machine cannot resolve; follow `references/project-check.md`.

The CLI does the merge, validation, and move; your part is choosing the change and getting the user's answer to each confirmation.

**Input**: Optionally specify a change name. If omitted, check if it can be inferred from conversation context. If vague or ambiguous you MUST prompt for available changes.

**Steps**

1. **Select the change**

   Use the name if one is given. Otherwise infer it from the conversation, or auto-select it if only one active change exists. If it is still ambiguous, run `openspec list --json` and ask the user to choose from the active changes (not already archived), with each one's schema when available.

   Always announce: "Using change: <name>" and how to override (e.g., `/openspec-archive-change <other>`).

2. **Load advisory inputs**

   Run `openspec instructions archive --change "<name>" --json`. It may return `context` and `operationGuidance`; follow `references/runtime-inputs.md`. This lookup is advisory and optional: if it fails or returns invalid JSON (for example on an older CLI), continue with neither. Do not report an error and do not stop.

3. **Check what is unfinished**

   Run `openspec status --change "<name>" --json` and note any artifact that is neither `done` nor `skipped` (`skipped` satisfies the requirement: the change declares `skip_specs`).

4. **Ask the CLI what archiving will do**
   ```bash
   openspec archive "<name>" --json
   ```
   Without `--yes` the CLI moves nothing that needs confirmation. Read the JSON:
   - `archive` is set: the change is already archived. Go to step 6.
   - Otherwise each `status` entry has a `code`, `message`, and `fix`:
     - `archive_confirmation_required` (main specs will change) and `archive_tasks_incomplete` need the user's go-ahead. Show each message, along with any unfinished artifact from step 3, and ask: "Archive and update the main specs (recommended)", "Archive without updating specs", or "Cancel".
     - Any other code is a problem `--yes` cannot fix. Show the `message` and `fix`, then stop: nothing has moved.

   Route on the answer:
   - "Cancel" — stop, do not archive. Nothing has moved.
   - Archive and update specs — run step 5 with `--yes`.
   - Archive without updating specs — run step 5 with `--yes --skip-specs`.
   - Anything else — ask again rather than archiving.

5. **Archive**
   ```bash
   openspec archive "<name>" --json --yes
   ```
   Add `--skip-specs` only when the user chose not to update specs. Never pass `--no-validate`. If the response still has no `archive` object, show each `status` message and `fix` and stop: the CLI refused, so the change and main specs are as they were.

6. **Summarize**

   From the `archive` object: the change, `archivedAs` and `path`, whether `specsUpdated`, and the requirement `totals` (added, modified, removed, renamed). Name any warning the user accepted (incomplete tasks or artifacts, specs not updated).

**Guardrails**
- Let `openspec archive` merge, validate, and move the change. Do not edit main specs or move `changeRoot` by hand
- Pass `--yes` only after the user agrees to what the preview reported
- Warnings never block the archive; they only need the user's confirmation
