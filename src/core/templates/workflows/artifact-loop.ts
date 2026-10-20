/**
 * The artifact loop shared by propose and ff: write every artifact the apply
 * phase transitively depends on, in dependency order, grounded in the project.
 *
 * Both workflows ran this loop byte for byte as separate copies; it is
 * authored once here so the two cannot drift. Each guard in it answers a
 * reported failure (#788, #1260, #1399, #1412, #2099, #339), so the wording is
 * kept as it shipped.
 */

/**
 * Steps "get the artifact build order" and "create every artifact in the
 * required set", numbered from `first`.
 *
 * @param progress - the progress line prefix each workflow prints
 * @param clarifyWhen - how unclear an artifact's context must be before the
 *   workflow stops to ask; propose and ff hold different thresholds (#1837)
 */
export function artifactLoopSteps(first: number, progress: string, clarifyWhen: string): string {
  return `${first}. **Get the artifact build order**
   \`\`\`bash
   openspec status --change "<name>" --json
   \`\`\`
   Parse the JSON to get:
   - \`applyRequires\`: array of artifact IDs needed before implementation (e.g., \`["tasks"]\`)
   - \`artifacts\`: list of all artifacts, each with its \`status\` and its \`requires\` edges (the artifact IDs it directly depends on)
   - \`planningHome\`, \`changeRoot\`, \`artifactPaths\`, and \`actionContext\`: path and scope context. Use these instead of assuming repo-local paths.

${first + 1}. **Create every artifact in the required set**

   Use a todo list to track progress through the artifacts.

   Loop through artifacts in dependency order (artifacts with no pending dependencies first):

   a. **For each artifact that is \`ready\` (dependencies satisfied)**:
      - Get instructions:
        \`\`\`bash
        openspec instructions <artifact-id> --change "<name>" --json
        \`\`\`
      - The instructions JSON includes:
        - \`context\`: Project background (constraints for you - do NOT include in output)
        - \`rules\`: Artifact-specific rules (constraints for you - do NOT include in output)
        - \`template\`: The structure to use for your output file
        - \`instruction\`: Schema-specific guidance for this artifact type
        - \`skipped\`/\`warning\`: present when the change declares skip_specs and this artifact must NOT be created - stop and pick another artifact
        - \`resolvedOutputPath\`: Resolved path or pattern to write the artifact
        - \`dependencies\`: Completed artifacts to read for context
      - Read any completed dependency files for context - always re-read them from disk, even if you saw them earlier in the conversation (the user may have edited them)
      - **Inspect the relevant project before drafting**: Read \`context\` and \`rules\` first, then inspect relevant implementation, nearby tests, configuration, and documentation outside \`openspec/\`. Keep inspection read-only and proportional to the change; reuse findings for later artifacts and inspect more only as needed.
        - Identify the target project from the request and project context; the planning home may be separate from the code. If the target is unclear, ask. For greenfield or non-code changes, inspect the available structure and relevant documents. If source is unavailable, state the limitation and ask when it materially affects the plan.
        - Ground scope, approach, and tasks in what you find. Distinguish observed behavior from assumptions and proposed additions; surface conflicts with existing specs instead of silently deciding which is correct.
        - Do this discovery now, rather than leaving generic "explore the codebase" or "make a plan" tasks for implementation. Keep any necessary follow-up investigation specific to an unresolved question.
      - Choose the output path before creating anything. If \`resolvedOutputPath\` is a glob, follow \`instruction\` to choose a concrete path inside \`changeRoot\` that matches the glob, and verify it remains inside \`changeRoot\` after resolving symlinks, both in its parent directories and in the file itself if it already exists; if it does not, stop and tell the user. Otherwise the output path is \`resolvedOutputPath\`
      - If the \`instruction\` field delegates creation to a specific skill or command, invoke it only if it can write the artifact to that output path; otherwise stop and tell the user. Then verify the artifact file exists at that output path
      - Otherwise create the artifact file using \`template\` as the structure and write it to that output path
      - Apply \`context\` and \`rules\` as constraints - but do NOT copy them into the file
      - Show brief progress: "${progress}<artifact-id>"

   b. **Continue until every artifact in the required set exists (not just \`apply.requires\`)**
      - After creating each artifact, re-run \`openspec status --change "<name>" --json\`
      - The required set is \`applyRequires\` plus every artifact reachable from those by following the \`requires\` edges in \`status --json\` - walk them transitively (spec-driven closes over proposal, specs, design, tasks). Leave artifacts outside that set alone
      - \`status\` is file-existence only, so an \`applyRequires\` artifact reading \`done\` does NOT mean its dependencies exist - writing \`tasks.md\` early marks \`tasks\` done while \`specs\` was never written. Use each artifact's \`requires\` edges, not its \`status\`, to build the required set: a \`done\` artifact still lists what it depends on
      - An artifact already reading \`status: "skipped"\` is satisfied: the change declares \`skip_specs\` in \`.openspec.yaml\`, so its files must NOT exist. Never try to create one
      - Create every artifact in the required set that is missing, then re-check - creating one can unblock others
      - Skip one only when \`status\` already reports it \`skipped\`, or when its own \`instruction\` says it is conditional: run \`openspec instructions <artifact-id> --change "<name>" --json\` and skip only if its \`instruction\` field marks it optional (e.g. "create only if..."). Spec-driven's \`design.md\` qualifies; \`specs\` qualifies only via the \`skipped\` status above, never by your own judgment. Tell the user, and do not reconsider it
      - Dependencies are enablers, not gates: if a required artifact is still \`blocked\` only because you skipped a conditional dependency, write it anyway
      - Stop when every artifact in the required set is \`done\`, \`skipped\`, or was deliberately skipped

   c. **If an artifact requires user input** (${clarifyWhen}):
      - Ask the user to clarify
      - Then continue with creation`;
}
