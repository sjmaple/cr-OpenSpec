---
name: openspec-continue-change
description: Continue working on an OpenSpec change by creating the next artifact. Use when the user wants to progress their change, create the next artifact, or continue their workflow. Also use when the user says "openspec continue" or "opsx continue".
allowed-tools: Bash(openspec:*)
license: MIT
compatibility: Requires openspec CLI.
metadata:
  author: openspec
  version: "1.0"
---

Continue working on a change by creating the next artifact.

**Before you start**
- If the user names a store, or the work lives in one, read `references/stores.md` and keep its `--store <id>` on every OpenSpec command.
- Before the first write (`openspec new change`, `openspec archive`, a spec sync, or an artifact file), run `openspec list --json`. If it reports `"root": null`, the project does not use OpenSpec yet, and nothing may create it as a side effect: no `openspec init` until the user asks, and no hand-made `openspec/` files. If you picked this workflow yourself, drop OpenSpec and answer the request normally. If the user named OpenSpec, this skill, or its command, stop and ask whether to set the project up (`openspec init`), target a store they have (`--store <id>`), or continue without OpenSpec, and wait for the answer. One exception: when a `status` error starts with `Declared in` or `Invalid store declaration in`, the project uses a store this machine cannot resolve; follow `references/project-check.md`.

**Input**: Optionally specify a change name. If omitted, check if it can be inferred from conversation context. If vague or ambiguous you MUST prompt for available changes.

**Steps**

1. **Select the change**

   Use the name if one is given. Otherwise infer it from the conversation, or auto-select it if only one active change exists. If it is still ambiguous, run `openspec list --json` to get available changes sorted by most recently modified, and ask the user to select one.

   When prompting, present the top 3-4 most recently modified changes as options, showing:
   - Change name
   - Status (e.g., "0/5 tasks", "complete", "no tasks")
   - How recently it was modified (from `lastModified` field)

   Mark the most recently modified change as "(Recommended)" since it's likely what the user wants to continue.

   Always announce: "Using change: <name>" and how to override (e.g., `/openspec-continue-change <other>`).

2. **Check current status**
   ```bash
   openspec status --change "<name>" --json
   ```
   Note `schemaName`, each artifact's `status` ("done", "skipped", "ready", "blocked"), `isPlanningComplete` (older CLI versions call it `isComplete`), and the `planningHome`, `changeRoot`, `artifactPaths`, and `actionContext` paths. Use these instead of assuming repo-local paths.

3. **Act based on status**

   **Before anything else, finish a partly written artifact**:
   - An artifact whose output is a glob pattern (e.g. `specs/**/*.md`) reads `done` as soon as one matching file exists, so a run interrupted while writing its files leaves it `done` with some still missing
   - For each such `done` artifact, first get its instructions and read any completed dependencies needed to determine the expected files. Then compare those files with `artifactPaths.<id>.existingOutputPaths`. For spec-driven's `specs`, read the proposal and check for one `specs/<capability-path>/spec.md` per capability it lists; resolve each expected path against `changeRoot` before comparing path identity, and verify each one remains inside `changeRoot` after resolving symlinks, both in its parent directories and in the file itself if it already exists
   - Never write an expected path that fails that check; stop and tell the user. If any are missing, write only the missing files, each at its checked path - when the `instruction` field delegates creation to a skill or command, invoke it only if it can write each file to its checked path; otherwise stop and tell the user - and STOP - that counts as this invocation's ONE artifact. If you cannot tell whether a file was left out on purpose, ask the user

   **If all planning artifacts are complete (`isPlanningComplete: true`, or legacy `isComplete: true`)**: congratulate the user, show the final status with the schema, suggest: "Planning is complete! You can now implement this change. Once implementation and any tracked work are complete, archive it.", and STOP.

   **If artifacts are ready to create**: pick the FIRST artifact with `status: "ready"`, run `openspec instructions <artifact-id> --change "<name>" --json`, and write it following `references/writing-artifacts.md`. If the instructions report `skipped`, pick another artifact. Show what was created and what is now unlocked, then STOP after creating ONE artifact.

   **If no artifacts are ready (all blocked)**: this shouldn't happen with a valid schema. Show the status and suggest checking for issues.

4. **Show progress**
   ```bash
   openspec status --change "<name>"
   ```

**Output**

Which artifact was created, the schema, progress (N/M complete), what is now unlocked, and: "Want to continue? Just ask me to continue or tell me what to do next."

**Guardrails**
- Create ONE artifact per invocation
- Never skip artifacts or create out of order; use the schema's artifact sequence, not assumed names
- Re-read dependency artifacts from disk before writing; files may have changed since you last saw them
- If context is unclear, ask the user before creating
