# Project context and operation guidance

Some `openspec instructions` responses carry two optional fields:

- Optional `context`: current required project instruction input from the selected root. Treat `context` as a required prompt-level input: read and consider it, and apply relevant project facts, conventions, and constraints.
- Optional `operationGuidance`: current advisory guidance for this operation. Treat `operationGuidance` as optional additive advice: Read and consider every entry, and follow entries that are applicable and compatible with the built-in workflow.

Keep both fields separate from CLI-returned state, missing artifacts, tasks, progress, `contextFiles`, resolved paths, CLI checks, command contracts, the built-in `instruction`, and explicit user choices. These are the controlling inputs:
- If context conflicts with a controlling input, report the conflict and preserve the controlling value.
- If guidance is inapplicable or conflicts with a controlling input, do not follow it and explain why.
- Do not use context or operation guidance as proof that a task is complete, as permission to bypass a blocked state, or as a source of replacement paths, skipped prompts, or flags.
- Do not copy runtime context or operation guidance into implementation files or planning artifacts, specs, or summaries unless the user separately asks for that content.

These are prompt-level behavior contracts, not enforceable checks.
