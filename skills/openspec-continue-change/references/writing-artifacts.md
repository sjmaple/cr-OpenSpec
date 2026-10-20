# Writing an artifact

`openspec instructions <artifact-id> --change "<name>" --json` returns everything needed to write one artifact:

| Field | Use |
|---|---|
| `instruction` | The schema's guidance for this artifact: the authoritative guidance, even for a familiar name like `proposal.md`, because a custom schema may define different content or a different process for the same file name. |
| `template` | The structure of the file. Fill in its sections. |
| `context`, `rules` | Constraints for you. Never copy them, or `<context>`, `<rules>`, or `<project_context>` blocks, into the file. |
| `dependencies` | Completed artifacts to read first. Re-read them from disk every time: the user may have edited them. Entries with `skipped: true` have no files. |
| `resolvedOutputPath` | Where the file goes, or a glob pattern. |
| `skipped`, `warning` | Present when the change declares `skip_specs`. Do not create this artifact. |

**Choose the output path before writing.** If `resolvedOutputPath` is a glob (for example `specs/**/*.md`), use `instruction` and the change's context to choose a concrete path inside `changeRoot` that matches it, and verify it remains inside `changeRoot` after resolving symlinks, both in its parent directories and in the file itself if it already exists; if it does not, stop and tell the user. Otherwise the output path is `resolvedOutputPath`.

If the `instruction` field delegates creation to a specific skill or command, invoke it only if it can write the artifact to that output path; otherwise stop and tell the user. If the `instruction` field directs you to use a specific skill or command to create the artifact, invoke it instead of writing the artifact directly - but only once you have chosen and checked the output path, and only if it can write there.

Otherwise write the artifact to that output path yourself, using `template` as its structure.

Either way, verify the artifact file exists at that output path.

**Skipped and conditional artifacts.** An artifact that `status` reports as `skipped` is satisfied: the change declares `skip_specs` in `.openspec.yaml`, so its files must not exist. Skip any other artifact only when its own `instruction` marks it conditional (for example "create only if..."). Spec-driven's `design.md` qualifies. `specs` never does by your judgment, only through `skipped`. Tell the user about a skip and do not reconsider it.
