---
name: openspec-sync-specs
description: Sync delta specs from an OpenSpec change to main specs. Use when the user wants to update main specs with changes from a delta spec, without archiving the change. Also use when the user says "openspec sync" or "opsx sync".
allowed-tools: Bash(openspec:*)
license: MIT
compatibility: Requires openspec CLI.
metadata:
  author: openspec
  version: "1.0"
---

Sync delta specs from a change to main specs, without archiving the change.

This is an **agent-driven** operation - you will read delta specs and directly edit main specs to apply the changes. You merge rather than overwrite: anything the delta does not mention stays as it is.

**Before you start**
- If the user names a store, or the work lives in one, read `references/stores.md` and keep its `--store <id>` on every OpenSpec command.
- Before the first write (`openspec new change`, `openspec archive`, a spec sync, or an artifact file), run `openspec list --json`. If it reports `"root": null`, the project does not use OpenSpec yet, and nothing may create it as a side effect: no `openspec init` until the user asks, and no hand-made `openspec/` files. If you picked this workflow yourself, drop OpenSpec and answer the request normally. If the user named OpenSpec, this skill, or its command, stop and ask whether to set the project up (`openspec init`), target a store they have (`--store <id>`), or continue without OpenSpec, and wait for the answer. One exception: when a `status` error starts with `Declared in` or `Invalid store declaration in`, the project uses a store this machine cannot resolve; follow `references/project-check.md`.

`<capability-path>` is the spec directory relative to `specs/` (for example, `user-auth` or `identity/user-auth`). Preserve the full path from each delta spec when resolving its main spec.

**Input**: Optionally specify a change name. If omitted, check if it can be inferred from conversation context. If vague or ambiguous you MUST prompt for available changes.

**Steps**

1. **Select the change**

   Use the name if one is given. Otherwise infer it from the conversation, or auto-select it if only one active change exists. If it is still ambiguous, run `openspec list --json` and ask the user to choose, showing changes that have delta specs.

   Always announce: "Using change: <name>" and how to override (e.g., `/openspec-sync-specs <other>`).

2. **Find the delta specs**

   Run `openspec status --change "<name>" --json`. Main specs live under `<planningHome.root>/openspec/specs/`, which points at the store when one is selected; use that root for every main-spec path, not a hardcoded repo path.

   `artifactPaths.specs.existingOutputPaths` is the only source of delta spec paths. If it is missing or empty, report that there are no delta specs to sync and stop, without inferring them from other artifacts.

   Sync every listed path unless the caller narrowed the set by naming complete entries from `existingOutputPaths` (copy those absolute values verbatim; for example, the entry ending in `/specs/billing/invoices/spec.md`). Then sync only those and leave the rest untouched: bulk archive withholds a delta whose implementation it could not find. Never widen a narrowed set back to the full list. If a named path is not in `existingOutputPaths`, report it and stop. If the named list is empty, report that there is nothing to sync and stop.

3. **Get the specs rules once**

   Before the first main-spec write, run `openspec instructions specs --change "<name>" --json`, or reuse the snapshot a calling workflow already fetched. If the lookup exits non-zero or returns invalid JSON, report the error and stop before writing any main spec; a failure is not the same as having no rules. A valid response with no `rules` means none are configured. Apply returned `rules` only to the content and form of the main specs this merge produces, never copying their text into a spec or summary.

4. **Merge each delta spec**

   For each selected path: read the delta spec, read its main spec at `<planningHome.root>/openspec/specs/<capability-path>/spec.md`, and merge following `references/merge-rules.md` when the main spec does not exist yet or removing requirements would leave it with none. Otherwise apply each operation in place:

   - **ADDED**: add the requirement. If it already exists, update it to match (an implicit MODIFIED).
   - **MODIFIED**: find the requirement and apply the change: new scenarios, edited scenarios, or a new description. A MODIFIED block carries the whole requirement - body plus every scenario that survives the change. `openspec validate` and `openspec archive` both reject one that drops a scenario the main spec still has. Keep scenarios and content the delta does not mention.
   - **REMOVED**: delete the whole requirement block.
   - **RENAMED**: find the FROM requirement and rename it to TO.
   - **`## Purpose` in the delta**: the main spec's existing Purpose is authoritative. Leave it alone (this is what `openspec archive` does; it warns and moves on).

   Never copy a delta file into a main spec as-is. Requirement blocks you write keep `### Requirement:` headings and `#### Scenario:` scenarios under the single `## Requirements` section, with no `## ADDED/MODIFIED/REMOVED/RENAMED Requirements` headers; leave anything the delta does not mention exactly as it is, in its existing order.

5. **Validate**

   Run `openspec validate --specs` with the same selected-root flags used earlier. If validation fails, report the problems and do not claim the sync succeeded.

6. **Show summary**

   For each capability: requirements added, modified, removed, and renamed; whether its spec was created or retired (naming the deleted `spec.md`, its Purpose, and recovery guidance); and any new spec left with a TBD Purpose, so it gets written now. End with: "Main specs are updated. The change remains active - archive it when implementation is complete."

**Guardrails**
- Read both the delta and the main spec before changing anything
- The operation is idempotent: running it twice gives the same result
- If something is unclear, ask for clarification
