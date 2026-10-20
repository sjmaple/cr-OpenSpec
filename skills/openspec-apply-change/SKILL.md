---
name: openspec-apply-change
description: Implement tasks from an OpenSpec change. Use when the user wants to start implementing, continue implementation, or work through tasks. Also use when the user says "openspec apply", "opsx apply", or "openspec implement".
allowed-tools: Bash(openspec:*)
license: MIT
compatibility: Requires openspec CLI.
metadata:
  author: openspec
  version: "1.0"
---

Implement tasks from an OpenSpec change.

**Before you start**
- If the user names a store, or the work lives in one, read `references/stores.md` and keep its `--store <id>` on every OpenSpec command.
- Before the first write (`openspec new change`, `openspec archive`, a spec sync, or an artifact file), run `openspec list --json`. If it reports `"root": null`, the project does not use OpenSpec yet, and nothing may create it as a side effect: no `openspec init` until the user asks, and no hand-made `openspec/` files. If you picked this workflow yourself, drop OpenSpec and answer the request normally. If the user named OpenSpec, this skill, or its command, stop and ask whether to set the project up (`openspec init`), target a store they have (`--store <id>`), or continue without OpenSpec, and wait for the answer. One exception: when a `status` error starts with `Declared in` or `Invalid store declaration in`, the project uses a store this machine cannot resolve; follow `references/project-check.md`.

**Input**: Optionally specify a change name (e.g., `/openspec-apply-change add-auth`). If omitted, check if it can be inferred from conversation context. If vague or ambiguous you MUST prompt for available changes.

**Steps**

1. **Select the change**

   Use the name if one is given. Otherwise infer it from the conversation, or auto-select it if only one active change exists. If it is still ambiguous, run `openspec list --json` and ask the user to choose.

   Always announce: "Using change: <name>" and how to override (e.g., `/openspec-apply-change <other>`).

2. **Check status**
   ```bash
   openspec status --change "<name>" --json
   ```
   Note `schemaName`, the `planningHome` and `changeRoot` paths, and the `actionContext` edit constraints (for a store, where the implementation lives).

3. **Get the apply instructions**
   ```bash
   openspec instructions apply --change "<name>" --json
   ```
   This returns:
   - `state`, the dynamic `instruction`, and progress (total, complete, remaining)
   - `contextFiles`: artifact ID -> array of concrete file paths (varies by schema - could be proposal/specs/design/tasks or spec/tests/implementation/docs)
   - The task list, each task with its status, source path, and source line
   - `missingArtifacts` (when present): required artifact ids with no output
   - Optional `context` and `operationGuidance`: follow `references/runtime-inputs.md`. Neither is evidence that a task is complete.

   **Handle the state:**
   - If `state: "blocked"`: show the message and pause implementation.
     - If `missingArtifacts` is non-empty: suggest using `/openspec-continue-change` to create them.
     - Otherwise, follow the CLI instruction to create or repair the schema-configured tracking file from existing planning artifacts. Do not assume another artifact is ready or start implementation while blocked.
   - If `state: "all_done"`: report that all tracked tasks are complete and suggest review or verification as appropriate before archiving
   - Otherwise: proceed to implementation

4. **Read the context files**

   Read every path listed under `contextFiles`. Use contextFiles from CLI output, don't assume specific file names. Show the schema, "N/M tasks complete", and the remaining tasks.

5. **Implement tasks (loop until done or blocked)**

   For each pending task:
   - Say which task you are working on, then make the code changes it needs, minimal and focused
   - Before editing a checkbox, confirm the line at the returned `sourcePath` and `line` still matches the task description; if it does not, rerun the apply instructions and use the refreshed location
   - Mark the task complete at its returned `sourcePath` and `line`: `- [ ]` → `- [x]`
   - Rerun the apply instructions and confirm that task is now done and progress changed

   **Pause if:**
   - Task is unclear → ask for clarification
   - Implementation reveals a design issue → suggest updating artifacts
   - A task needs work beyond what the spec and tasks describe, or you are tempted to drop, narrow, defer, or accept exceptions to specified behavior to make it fit → surface the added scope and ask; do not absorb it silently
   - Error or blocker encountered → report and wait for guidance
   - User interrupts

6. **On completion or pause, show status**

   Show the tasks completed this session and "N/M tasks complete". If all are done, say: "All tracked tasks are complete. Review or verify the change as appropriate before archiving." You can archive this change with `/openspec-archive-change`. If paused, explain the issue, offer options, and wait for guidance.

**Guardrails**
- When a task needs work beyond what the spec describes, surface the added scope and pause - never silently narrow, defer, or simplify away specified behavior
- Only mark a task `- [x]` when its specified behavior is fully implemented, not when it is partially done or deferred
- Update each task's checkbox right after finishing it, at its exact sourcePath and line
- Preserve CLI-controlled blocked/ready/all-done behavior and completion criteria
- Implementation may reveal that the plan is wrong: suggest updating the artifacts rather than working around them
