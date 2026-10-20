/**
 * Continue: create the next artifact of a change, one per invocation.
 */
import type { SkillTemplate, CommandTemplate } from '../types.js';
import { optionalWorkflow } from '../optional-workflow.js';
import {
  BEFORE_YOU_START,
  PROJECT_CHECK_REFERENCE,
  STORES_REFERENCE,
  WRITING_ARTIFACTS_REFERENCE,
  withReferences,
} from './references.js';

/**
 * The planning-complete handoff. Neither `apply` nor `archive` is guaranteed
 * to be installed, so each half is resolved at generation time (see
 * optional-workflow.ts).
 */
const PLANNING_COMPLETE_HANDOFF = optionalWorkflow(
  'apply',
  'You can now implement this change with `/opsx:apply`.',
  'You can now implement this change - `openspec instructions apply --change "<name>" --json` returns the tasks and how to work them.'
) + ' ' + optionalWorkflow(
  'archive',
  'Once implementation and any tracked work are complete, archive it with `/opsx:archive`.',
  'Once implementation and any tracked work are complete, archive it with `openspec archive "<name>"`.'
);

/**
 * A glob artifact reads `done` once one matching file exists, so a run
 * interrupted while writing several files leaves it `done` with files missing,
 * and the next run would move on without reading its instruction again (#2034).
 */
const PARTIAL_ARTIFACT_CHECK = `**Before anything else, finish a partly written artifact**:
   - An artifact whose output is a glob pattern (e.g. \`specs/**/*.md\`) reads \`done\` as soon as one matching file exists, so a run interrupted while writing its files leaves it \`done\` with some still missing
   - For each such \`done\` artifact, first get its instructions and read any completed dependencies needed to determine the expected files. Then compare those files with \`artifactPaths.<id>.existingOutputPaths\`. For spec-driven's \`specs\`, read the proposal and check for one \`specs/<capability-path>/spec.md\` per capability it lists; resolve each expected path against \`changeRoot\` before comparing path identity, and verify each one remains inside \`changeRoot\` after resolving symlinks, both in its parent directories and in the file itself if it already exists
   - Never write an expected path that fails that check; stop and tell the user. If any are missing, write only the missing files, each at its checked path - when the \`instruction\` field delegates creation to a skill or command, invoke it only if it can write each file to its checked path; otherwise stop and tell the user - and STOP - that counts as this invocation's ONE artifact. If you cannot tell whether a file was left out on purpose, ask the user`;

const REFERENCES = [STORES_REFERENCE, PROJECT_CHECK_REFERENCE, WRITING_ARTIFACTS_REFERENCE];

function getContinueInstructions(input: string, planningComplete: string, nextPrompt: string): string {
  return `Continue working on a change by creating the next artifact.

${BEFORE_YOU_START}

**Input**: ${input}

**Steps**

1. **Select the change**

   Use the name if one is given. Otherwise infer it from the conversation, or auto-select it if only one active change exists. If it is still ambiguous, run \`openspec list --json\` to get available changes sorted by most recently modified, and ask the user to select one.

   When prompting, present the top 3-4 most recently modified changes as options, showing:
   - Change name
   - Status (e.g., "0/5 tasks", "complete", "no tasks")
   - How recently it was modified (from \`lastModified\` field)

   Mark the most recently modified change as "(Recommended)" since it's likely what the user wants to continue.

   Always announce: "Using change: <name>" and how to override (e.g., \`/opsx:continue <other>\`).

2. **Check current status**
   \`\`\`bash
   openspec status --change "<name>" --json
   \`\`\`
   Note \`schemaName\`, each artifact's \`status\` ("done", "skipped", "ready", "blocked"), \`isPlanningComplete\` (older CLI versions call it \`isComplete\`), and the \`planningHome\`, \`changeRoot\`, \`artifactPaths\`, and \`actionContext\` paths. Use these instead of assuming repo-local paths.

3. **Act based on status**

   ${PARTIAL_ARTIFACT_CHECK}

   **If all planning artifacts are complete (\`isPlanningComplete: true\`, or legacy \`isComplete: true\`)**: congratulate the user, show the final status with the schema, suggest: "Planning is complete! ${planningComplete}", and STOP.

   **If artifacts are ready to create**: pick the FIRST artifact with \`status: "ready"\`, run \`openspec instructions <artifact-id> --change "<name>" --json\`, and write it following \`references/writing-artifacts.md\`. If the instructions report \`skipped\`, pick another artifact. Show what was created and what is now unlocked, then STOP after creating ONE artifact.

   **If no artifacts are ready (all blocked)**: this shouldn't happen with a valid schema. Show the status and suggest checking for issues.

4. **Show progress**
   \`\`\`bash
   openspec status --change "<name>"
   \`\`\`

**Output**

Which artifact was created, the schema, progress (N/M complete), what is now unlocked, and: "${nextPrompt}"

**Guardrails**
- Create ONE artifact per invocation
- Never skip artifacts or create out of order; use the schema's artifact sequence, not assumed names
- Re-read dependency artifacts from disk before writing; files may have changed since you last saw them
- If context is unclear, ask the user before creating`;
}

export function getContinueChangeSkillTemplate(): SkillTemplate {
  return {
    name: 'openspec-continue-change',
    description: 'Continue working on an OpenSpec change by creating the next artifact. Use when the user wants to progress their change, create the next artifact, or continue their workflow. Also use when the user says "openspec continue" or "opsx continue".',
    instructions: getContinueInstructions(
      'Optionally specify a change name. If omitted, check if it can be inferred from conversation context. If vague or ambiguous you MUST prompt for available changes.',
      'You can now implement this change. Once implementation and any tracked work are complete, archive it.',
      'Want to continue? Just ask me to continue or tell me what to do next.'
    ),
    references: REFERENCES,
    license: 'MIT',
    compatibility: 'Requires openspec CLI.',
    metadata: { author: 'openspec', version: '1.0' },
  };
}

export function getOpsxContinueCommandTemplate(): CommandTemplate {
  return {
    name: 'OPSX: Continue',
    description: 'Continue working on a change - create the next artifact (Experimental)',
    category: 'Workflow',
    tags: ['workflow', 'artifacts', 'experimental'],
    content: withReferences(
      getContinueInstructions(
        'Optionally specify a change name after `/opsx:continue` (e.g., `/opsx:continue add-auth`). If omitted, check if it can be inferred from conversation context. If vague or ambiguous you MUST prompt for available changes.',
        PLANNING_COMPLETE_HANDOFF,
        'Run `/opsx:continue` to create the next artifact'
      ),
      REFERENCES
    ),
  };
}
