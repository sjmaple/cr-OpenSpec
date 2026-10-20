/**
 * Fast-forward: create a change and write everything implementation needs,
 * keeping momentum over asking.
 */
import type { SkillTemplate, CommandTemplate } from '../types.js';
import { optionalWorkflow } from '../optional-workflow.js';
import { artifactLoopSteps } from './artifact-loop.js';
import {
  BEFORE_YOU_START,
  PROJECT_CHECK_REFERENCE,
  STORES_REFERENCE,
  withReferences,
} from './references.js';

/**
 * The implementation handoff, resolved at generation time so a profile
 * without `apply` is not told to run it (see optional-workflow.ts).
 *
 * The two surfaces word this differently on purpose (#258): a command-only
 * tool has no conversational agent to ask, so its prompt names a command or
 * the CLI and never invites "ask me to implement".
 */
const SKILL_APPLY_HANDOFF = optionalWorkflow(
  'apply',
  'Run `/opsx:apply` or ask me to implement to start working on the tasks.',
  'Ask me to implement to start working on the tasks.'
);

const COMMAND_APPLY_HANDOFF = optionalWorkflow(
  'apply',
  'Run `/opsx:apply` to start implementing.',
  'Run `openspec instructions apply --change "<name>" --json` to get the task list and start implementing.'
);

const REFERENCES = [STORES_REFERENCE, PROJECT_CHECK_REFERENCE];

function getFfInstructions(input: string, applyHandoff: string): string {
  return `Fast-forward through artifact creation - generate everything needed to start implementation in one go.

${BEFORE_YOU_START}

**Input**: ${input}

**Steps**

1. **If no clear input provided, ask what they want to build**

   Ask the user (open-ended, no preset options):
   > "What change do you want to work on? Describe what you want to build or fix."

   From their description, derive a kebab-case name (e.g., "add user authentication" → \`add-user-auth\`).

   **IMPORTANT**: Do NOT proceed without understanding what the user wants to build.

2. **Create the change directory**
   \`\`\`bash
   openspec new change "<name>"
   \`\`\`
   This creates a scaffolded change in the planning home resolved by the CLI.

${artifactLoopSteps(3, '✓ Created ', 'critically unclear context')}

5. **Show final status**
   \`\`\`bash
   openspec status --change "<name>"
   \`\`\`

**Output**

After completing all artifacts, summarize:
- Change name and location
- List of artifacts created with brief descriptions, plus any conditional artifact you skipped and why
- What's ready: "All artifacts needed for implementation are ready."
- Prompt: "${applyHandoff}"

**Guardrails**
- Follow the \`instruction\` field from \`openspec instructions\` for each artifact type - it is the authoritative guidance, even for familiar artifact names
- If the \`instruction\` field directs you to use a specific skill or command to create the artifact, invoke it instead of writing the artifact directly - but only once you have chosen and checked the output path, and only if it can write there
- \`context\` and \`rules\` are constraints for YOU, not content for the file: never copy \`<context>\`, \`<rules>\`, or \`<project_context>\` blocks into an artifact
- Create every artifact the apply phase transitively depends on, not just the ids listed in \`apply.requires\`
- Always read dependency artifacts before creating a new one - re-read from disk, not from conversation memory (files may have changed since you last saw them)
- If context is critically unclear, ask the user - but prefer making reasonable decisions to keep momentum
- If a change with that name already exists, suggest continuing that change instead
- Verify each artifact file exists after writing before proceeding to next`;
}

export function getFfChangeSkillTemplate(): SkillTemplate {
  return {
    name: 'openspec-ff-change',
    description: 'Fast-forward through OpenSpec artifact creation. Use when the user wants to quickly create all artifacts needed for implementation without stepping through each one individually. Also use when the user says "openspec ff" or "opsx ff".',
    instructions: getFfInstructions(
      "The user's request should include a change name (kebab-case) OR a description of what they want to build.",
      SKILL_APPLY_HANDOFF
    ),
    references: REFERENCES,
    license: 'MIT',
    compatibility: 'Requires openspec CLI.',
    metadata: { author: 'openspec', version: '1.0' },
  };
}

export function getOpsxFfCommandTemplate(): CommandTemplate {
  return {
    name: 'OPSX: Fast Forward',
    description: 'Create a change and generate all artifacts needed for implementation in one go',
    category: 'Workflow',
    tags: ['workflow', 'artifacts', 'experimental'],
    content: withReferences(
      getFfInstructions(
        'The argument after `/opsx:ff` is the change name (kebab-case), OR a description of what the user wants to build.',
        COMMAND_APPLY_HANDOFF
      ),
      REFERENCES
    ),
  };
}
