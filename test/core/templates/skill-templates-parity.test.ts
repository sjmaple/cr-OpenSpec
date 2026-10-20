import { createHash } from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { describe, expect, it } from 'vitest';

import {
  type SkillTemplate,
  getApplyInstructions,
  getApplyChangeSkillTemplate,
  getArchiveChangeSkillTemplate,
  getBulkArchiveChangeSkillTemplate,
  getContinueChangeSkillTemplate,
  getExploreSkillTemplate,
  getFeedbackSkillTemplate,
  getFfChangeSkillTemplate,
  getNewChangeSkillTemplate,
  getOnboardSkillTemplate,
  getOpsxApplyCommandTemplate,
  getOpsxArchiveCommandTemplate,
  getOpsxBulkArchiveCommandTemplate,
  getOpsxContinueCommandTemplate,
  getOpsxExploreCommandTemplate,
  getOpsxFfCommandTemplate,
  getOpsxNewCommandTemplate,
  getOpsxOnboardCommandTemplate,
  getOpsxSyncCommandTemplate,
  getOpsxProposeCommandTemplate,
  getOpsxProposeSkillTemplate,
  getOpsxUpdateCommandTemplate,
  getOpsxVerifyCommandTemplate,
  getSyncSpecsSkillTemplate,
  getUpdateChangeSkillTemplate,
  getVerifyChangeSkillTemplate,
} from '../../../src/core/templates/skill-templates.js';
import {
  generateSkillContent,
  generateSkillFiles,
  getCommandContents,
  getSkillTemplates,
} from '../../../src/core/shared/skill-generation.js';
import { STORE_SELECTION_GUIDANCE } from '../../../src/core/templates/workflows/store-selection.js';
import { resolveOptionalWorkflows } from '../../../src/core/templates/optional-workflow.js';
import { ALL_WORKFLOWS } from '../../../src/core/profiles.js';
import { parseSchema } from '../../../src/core/artifact-graph/schema.js';
import {
  BEFORE_YOU_START,
  STORES_REFERENCE,
  withReferences,
} from '../../../src/core/templates/workflows/references.js';
import { skillSource } from '../../helpers/skill-text.js';

/**
 * Templates carry optional-workflow conditionals that the production registry
 * resolves against the installed workflow set. Pin what generation emits, not
 * the unresolved authoring form: with every workflow installed this is byte
 * for byte what `getSkillTemplates()` returns.
 */
const asDeployed = (template: SkillTemplate): SkillTemplate => ({
  ...template,
  instructions: resolveOptionalWorkflows(
    template.instructions,
    new Set<string>(ALL_WORKFLOWS)
  ),
  references: template.references?.map((reference) => ({
    ...reference,
    content: resolveOptionalWorkflows(reference.content, new Set<string>(ALL_WORKFLOWS)),
  })),
});

/** Every file a deployed skill ships, SKILL.md first, as one text. */
const deployedText = (template: SkillTemplate): string =>
  generateSkillFiles(asDeployed(template), 'PARITY-BASELINE')
    .map((file) => file.content)
    .join('\n');

/**
 * The title `spec-driven` gives each artifact, read from the packaged templates
 * so guidance and template cannot drift apart.
 */
function specDrivenTitles(): Record<string, string> {
  const schemaDir = path.join(__dirname, '..', '..', '..', 'schemas', 'spec-driven');
  const schema = parseSchema(fs.readFileSync(path.join(schemaDir, 'schema.yaml'), 'utf-8'));

  return Object.fromEntries(
    schema.artifacts.map((artifact) => [
      artifact.id,
      fs
        .readFileSync(path.join(schemaDir, 'templates', artifact.template), 'utf-8')
        .replace(/\r\n?/g, '\n')
        .split('\n')[0],
    ])
  );
}

const EXPECTED_FUNCTION_HASHES: Record<string, string> = {
  getExploreSkillTemplate: 'c9ed3349e1ce3729d1651a6c7e4857be8db71ca1eaf56c5c41852a61225cc34a',
  getNewChangeSkillTemplate: '41cf794b41ad3dea308e11316b33c3730013f1bee8a4b6b024a8cc6638fc8d7c',
  getContinueChangeSkillTemplate: 'd0f334d3cc5bd01f0e252ff383323b2a141d0062e4b984e06de275d01f8f63e9',
  getApplyChangeSkillTemplate: '2aa27cd3949167f8b32dd2413db50cabbb44cfbbcc8651a4cb0ccd2477b3f27f',
  getFfChangeSkillTemplate: '0a7f8a0f2123a0594e646d3f33b955ec39773079f21478e714bb44bfd977eb5a',
  getSyncSpecsSkillTemplate: 'caa9dcd6c873997059e91f5105da2c4122210b2aa8c3546f50c08edc84bcaf59',
  getOnboardSkillTemplate: '28d63406d7b98a490c9fa93cd52e147a9bcb87b4d79178e6a5f8bbd854fb42c0',
  getOpsxExploreCommandTemplate: '6231c3bbdc1815d7cfe0012c2e15e1b9b0c3d9a3014f2e0ba8f6c6a2774e0cae',
  getOpsxNewCommandTemplate: '31a4f03a27feb3f7dabcaaade16d5784e1b714f0ac5aaeb4b530d011c2049b11',
  getOpsxContinueCommandTemplate: 'e4dbd97e6103b38fa40a476888945847b873f74beb1cf3029446585b2ab2a08b',
  getOpsxApplyCommandTemplate: '55147edf0f9044fc9df77e6ccde3f67ee382fbab13efc078ae5fa9db4d97eb0e',
  getOpsxFfCommandTemplate: 'bd5311aa425c71e6e734a5593b428a54950da20d68d5e607b22f01468515dfbb',
  getArchiveChangeSkillTemplate: 'aaca8668f57c75d40709432567ab93d81fb8b9a6a557e80243897a603ecc5389',
  getBulkArchiveChangeSkillTemplate: '059fd6269f1360e16ce68f85d8f0b4847716a9f453427a28552f19a05d95852f',
  getOpsxSyncCommandTemplate: 'ad7720ffc89da2a60dd6e0d413f9246d8aea0957304d41f8c8776980a6b01f02',
  getVerifyChangeSkillTemplate: 'c42798e5019ec41416a81ae56789a32fe8e98dbd3e336f832f79d9394742958e',
  getOpsxArchiveCommandTemplate: 'ff9661d4ebaae273da5d5a753a53144245452617fdc2ec4ebec7156500977f56',
  getOpsxOnboardCommandTemplate: '95f8a9ae080105483ec3ea9711ef9f5d65206154c867d725a39954f96d8fb9f0',
  getOpsxBulkArchiveCommandTemplate: 'b00dae363f0a9a5cf96f7120798c761e59e991cad57815080173af83d33a54bb',
  getOpsxVerifyCommandTemplate: '57d0b88270c66175fea347795369d9cc210df333022f6239078e50a0a2dfc5b0',
  getOpsxProposeSkillTemplate: '9bd069d6f2bed96623b038354d4fc8d1caf422f2e9ac3e0efceef28ded291fc5',
  getOpsxProposeCommandTemplate: '18cfc75c74c68bedd4c177ee2ee2d0f25fcc1b6c338f1ab68dfb83043294f459',
  getFeedbackSkillTemplate: 'dabeb5e825b9349abc8156c3e7b8608f27987912a6d9bf47ef29addde6138133',
  getUpdateChangeSkillTemplate: '41758d3d1c6d8dcf7332161eaa751f916150de47c13eb811bf0821f6139c087e',
  getOpsxUpdateCommandTemplate: '9619a7ea3d1fb76effb6b94c57d81ee136a7c3fd43751067430d123aa6607355',
};

const EXPECTED_GENERATED_SKILL_CONTENT_HASHES: Record<string, string> = {
  'openspec-explore': 'e760dc33a021f3c17ad8b5f1280ad41d94a3a93f1a70edb7bcb5a833a5877048',
  'openspec-new-change': '001631cc00f06d7c05c69037aea381303d4f611bba59173fee784fbe665b8821',
  'openspec-continue-change': '972d68160b9c860935f9d624d2b54e5ce47a01743556bc5eff52d1fb16f403c4',
  'openspec-apply-change': '3068b64bd521816748943df0c030c6dfdcdf7121324d345bdd48baa43a8474dd',
  'openspec-ff-change': '41b1daa1bba68997db6b0193e760a6363a59f8da4175cafbb82b4773743c4a80',
  'openspec-sync-specs': '4c64b9427410fd977fd45d4c07e4c9538c93b8acdd4b6ba457e665e3df019a2f',
  'openspec-archive-change': '51565d2b7da573b6f55cf38306f3ca33392570acf5ad9452944390e103ef01d0',
  'openspec-bulk-archive-change': 'e061fecd3d335b4df77716f4dc2c3c32d3b4743513e3f89b364e4583f5e592cd',
  'openspec-verify-change': 'b1e339f310bfb99be853728d19e92dee4d5a9059d4dbf0bdcc79f1d1debd2caa',
  'openspec-onboard': '3c94661014a6a8741017253e507ad72e38970acd7524f5fdeb792c52ea8614bd',
  'openspec-propose': '88e6aab27a1f2a840d2c391ba20c40febd5fdbe917d550a8e2520360dcc558bf',
  'openspec-update-change': '4e41873d7bc03b48b3e6ca4f47befe43d3bcfa74e067716d45824d68f057a3df',
};

// Intentionally excludes getFeedbackSkillTemplate: this list only models templates
// deployed via generateSkillContent, while feedback is covered in function payload parity.
const GENERATED_SKILL_FACTORIES: Array<[string, () => SkillTemplate]> = [
  ['openspec-explore', getExploreSkillTemplate],
  ['openspec-new-change', getNewChangeSkillTemplate],
  ['openspec-continue-change', getContinueChangeSkillTemplate],
  ['openspec-apply-change', getApplyChangeSkillTemplate],
  ['openspec-ff-change', getFfChangeSkillTemplate],
  ['openspec-sync-specs', getSyncSpecsSkillTemplate],
  ['openspec-archive-change', getArchiveChangeSkillTemplate],
  ['openspec-bulk-archive-change', getBulkArchiveChangeSkillTemplate],
  ['openspec-verify-change', getVerifyChangeSkillTemplate],
  ['openspec-onboard', getOnboardSkillTemplate],
  ['openspec-propose', getOpsxProposeSkillTemplate],
  ['openspec-update-change', getUpdateChangeSkillTemplate],
];

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(',')}]`;
  }

  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => `${JSON.stringify(key)}:${stableStringify(item)}`);

    return `{${entries.join(',')}}`;
  }

  return JSON.stringify(value);
}

function hash(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

describe('skill templates split parity', () => {
  it('uses one clarification threshold in fast-forward guidance (#1837)', () => {
    const variants: Array<[string, string]> = [
      ['ff skill', getFfChangeSkillTemplate().instructions],
      ['ff command', getOpsxFfCommandTemplate().content],
    ];

    for (const [variant, content] of variants) {
      expect(content, variant).toContain(
        '**If an artifact requires user input** (critically unclear context)'
      );
      expect(content, variant).not.toContain(
        '**If an artifact requires user input** (unclear context)'
      );
    }
  });

  it('approves onboarding tasks before saving or offering implementation (#1837)', () => {
    const variants: Array<[string, string]> = [
      ['onboard skill', getOnboardSkillTemplate().instructions],
      ['onboard command', getOpsxOnboardCommandTemplate().content],
    ];

    for (const [variant, content] of variants) {
      expect(content, variant).toContain('Does this task breakdown look right?');
      expect(content, variant).not.toContain(
        'Each checkbox becomes a unit of work in the apply phase. Ready to implement?'
      );
      expect(content, variant).toContain(
        '**PAUSE** - Wait for user approval/feedback.\n\n' +
        'After approval, save to the `resolvedOutputPath` from `openspec instructions tasks --change "<name>" --json`.'
      );
      expect(content, variant).toContain('> "Tasks are saved. Ready to implement?"');
      expect(content, variant).toContain(
        '**PAUSE** - Wait for user to confirm before implementation.'
      );

      const saveAt = content.indexOf('After approval, save to the `resolvedOutputPath`');
      const implementationChoiceAt = content.indexOf('> "Tasks are saved. Ready to implement?"');
      const implementationAt = content.indexOf('## Phase 9: Apply (Implementation)');
      expect(saveAt, variant).toBeGreaterThanOrEqual(0);
      expect(implementationChoiceAt, variant).toBeGreaterThan(saveAt);
      expect(implementationAt, variant).toBeGreaterThan(implementationChoiceAt);
    }
  });

  it('preserves all template function payloads exactly', () => {
    const functionFactories: Record<string, () => unknown> = {
      getExploreSkillTemplate,
      getNewChangeSkillTemplate,
      getContinueChangeSkillTemplate,
      getApplyChangeSkillTemplate,
      getFfChangeSkillTemplate,
      getSyncSpecsSkillTemplate,
      getOnboardSkillTemplate,
      getOpsxExploreCommandTemplate,
      getOpsxNewCommandTemplate,
      getOpsxContinueCommandTemplate,
      getOpsxApplyCommandTemplate,
      getOpsxFfCommandTemplate,
      getArchiveChangeSkillTemplate,
      getBulkArchiveChangeSkillTemplate,
      getOpsxSyncCommandTemplate,
      getVerifyChangeSkillTemplate,
      getOpsxArchiveCommandTemplate,
      getOpsxOnboardCommandTemplate,
      getOpsxBulkArchiveCommandTemplate,
      getOpsxVerifyCommandTemplate,
      getOpsxProposeSkillTemplate,
      getOpsxProposeCommandTemplate,
      getFeedbackSkillTemplate,
      getUpdateChangeSkillTemplate,
      getOpsxUpdateCommandTemplate,
    };

    const actualHashes = Object.fromEntries(
      Object.entries(functionFactories).map(([name, fn]) => [name, hash(stableStringify(fn()))])
    );

    expect(actualHashes).toEqual(EXPECTED_FUNCTION_HASHES);
  });

  it('preserves generated skill file content exactly', () => {
    const actualHashes = Object.fromEntries(
      GENERATED_SKILL_FACTORIES.map(([dirName, createTemplate]) => [
        dirName,
        hash(
          generateSkillFiles(asDeployed(createTemplate()), 'PARITY-BASELINE')
            .map((file) => `--- ${file.relativePath}\n${file.content}`)
            .join('\n')
        ),
      ])
    );

    expect(actualHashes).toEqual(EXPECTED_GENERATED_SKILL_CONTENT_HASHES);
  });

  // The assertion above only compares the skills this file already lists, so a
  // workflow added to getSkillTemplates() but never pinned here would ship with
  // no golden hash and nothing would fail. Pin the registry itself.
  it('pins every skill the production registry deploys', () => {
    const pinned = GENERATED_SKILL_FACTORIES.map(([dirName]) => dirName).sort();
    const deployed = getSkillTemplates().map(({ dirName }) => dirName).sort();

    expect(pinned, 'add the new skill to GENERATED_SKILL_FACTORIES and EXPECTED_GENERATED_SKILL_CONTENT_HASHES').toEqual(deployed);
  });

  // Iterating the production registries (not a local list) means a newly
  // added workflow is covered automatically; the full-constant containment
  // check fails if any template's interpolation drifts.
  it('teaches store selection in every deployed skill template', () => {
    for (const { template, dirName } of getSkillTemplates()) {
      const content = generateSkillContent(template, 'PARITY-BASELINE');
      expect(content, dirName).toContain(BEFORE_YOU_START);
      const reference = template.references?.find(({ path }) => path === STORES_REFERENCE.path);
      expect(reference?.content, dirName).toContain(STORE_SELECTION_GUIDANCE);
    }
  });

  // Auto-approve the OpenSpec CLI: every generated skill carries
  // `allowed-tools: Bash(openspec:*)` so agents that honor it stop prompting
  // on each `openspec` call. Iterating the registry covers new skills too.
  it('pre-approves the openspec CLI via allowed-tools in every deployed skill', () => {
    for (const { template, dirName } of getSkillTemplates()) {
      const content = generateSkillContent(template, 'PARITY-BASELINE');
      expect(content, dirName).toContain('allowed-tools: Bash(openspec:*)');
    }
  });

  it('teaches store selection in every deployed opsx command template', () => {
    for (const entry of getCommandContents()) {
      expect(entry.body, entry.id).toContain(STORE_SELECTION_GUIDANCE);
    }

    // Feedback has no store-capable command and intentionally carries no
    // store teaching; it ships outside both registries.
    expect(getFeedbackSkillTemplate().instructions).not.toContain('**Store selection:**');
  });

  it('keeps a selected store on every applicable workflow command', () => {
    expect(STORE_SELECTION_GUIDANCE).toContain(
      'treat `--store <id>` as sticky for the rest of the workflow'
    );
    expect(STORE_SELECTION_GUIDANCE).toContain(
      'Every unscoped example of those commands in this workflow is shorthand: before running it, append the flag'
    );
    expect(STORE_SELECTION_GUIDANCE).toContain(
      'openspec status --change "<name>" --json --store "<id>"'
    );
    expect(STORE_SELECTION_GUIDANCE).toContain('`context`, `schemas`, `view`');
  });

  it('validates synced main specs before reporting success', () => {
    const variants: Array<[string, string]> = [
      ['sync skill', skillSource(getSyncSpecsSkillTemplate())],
      ['sync command', getOpsxSyncCommandTemplate().content],
    ];

    for (const [variant, content] of variants) {
      const mutationsComplete = content.indexOf('merge following `references/merge-rules.md`');
      const validation = content.indexOf('openspec validate --specs');
      const summary = content.indexOf('**Show summary**');

      expect(mutationsComplete, variant).toBeGreaterThanOrEqual(0);
      expect(validation, variant).toBeGreaterThan(mutationsComplete);
      expect(summary, variant).toBeGreaterThan(validation);
      expect(content, variant).toContain('same selected-root flags');
      expect(content, variant).toContain(
        'If validation fails, report the problems and do not claim the sync succeeded'
      );
    }
  });

  // Archive and bulk archive leave main-spec paths to `openspec archive`;
  // the workflows that still read or write main specs are pinned here.
  it('preserves nested capability paths in spec-aware workflow guidance (#1459)', () => {
    const capabilityPathDefinition =
      '`<capability-path>` is the spec directory relative to `specs/`';
    const pathAwareTemplates: Array<[string, string, string, string]> = [
      [
        'propose skill',
        deployedText(getOpsxProposeSkillTemplate()),
        'specs/<capability-path>/spec.md',
        "Preserve an existing capability's full path",
      ],
      [
        'propose command',
        getOpsxProposeCommandTemplate().content,
        'specs/<capability-path>/spec.md',
        "Preserve an existing capability's full path",
      ],
      [
        'explore skill',
        deployedText(getExploreSkillTemplate()),
        'specs/<capability-path>/spec.md',
        "Preserve an existing capability's full path",
      ],
      [
        'explore command',
        getOpsxExploreCommandTemplate().content,
        'specs/<capability-path>/spec.md',
        "Preserve an existing capability's full path",
      ],
      [
        'onboard skill',
        deployedText(getOnboardSkillTemplate()),
        '<existing-capability-path>',
        'Use the exact existing path for modified',
      ],
      [
        'onboard command',
        getOpsxOnboardCommandTemplate().content,
        '<existing-capability-path>',
        'Use the exact existing path for modified',
      ],
      [
        'sync skill',
        deployedText(getSyncSpecsSkillTemplate()),
        '<planningHome.root>/openspec/specs/<capability-path>/spec.md',
        'Preserve the full path from each delta spec',
      ],
      [
        'sync command',
        getOpsxSyncCommandTemplate().content,
        '<planningHome.root>/openspec/specs/<capability-path>/spec.md',
        'Preserve the full path from each delta spec',
      ],
    ];

    for (const [label, content, destination, preservationGuidance] of pathAwareTemplates) {
      expect(content, label).toContain(capabilityPathDefinition);
      expect(content, label).toContain(destination);
      expect(content, label).toContain(preservationGuidance);
      expect(content, label).not.toContain('specs/<capability>/spec.md');
    }

    const onboardVariants: Array<[string, string]> = [
      [
        'onboard skill',
        deployedText(getOnboardSkillTemplate()),
      ],
      ['onboard command', getOpsxOnboardCommandTemplate().content],
    ];

    for (const [label, content] of onboardVariants) {
      expect(content, label).toContain(
        '- `<capability-path>`: [brief description]'
      );
      expect(content, label).not.toContain('<capability-name>');
    }

    const bulkArchiveVariants: Array<[string, string]> = [
      [
        'bulk archive skill',
        deployedText(getBulkArchiveChangeSkillTemplate()),
      ],
      ['bulk archive command', getOpsxBulkArchiveCommandTemplate().content],
    ];

    for (const [label, content] of bulkArchiveVariants) {
      expect(content, label).toContain(
        'Build a map keyed by `<capability-path>`, the exact path relative to `specs/`'
      );
      expect(content, label).toContain(
        'billing/user-auth  -> [change-c]            <- OK (different full path)'
      );
      expect(content, label).toContain(
        'identity/user-auth -> [change-a, change-b]  <- CONFLICT'
      );
      expect(content, label).toContain('identity/user-auth (!)');
      expect(content, label).toContain(
        'the exact same `<capability-path>`'
      );
      expect(content, label).toContain(
        'keyed by change and `<capability-path>`'
      );
      expect(content, label).toContain(
        'identity/user-auth spec: Will apply add-oauth then add-jwt'
      );
      expect(content, label).toContain(
        'add-jwt, identity/user-auth: implementation not found'
      );
      expect(content, label).toContain(
        '1 conflict resolved (identity/user-auth: synced add-oauth, skipped add-jwt)'
      );
      expect(content, label).not.toContain('\n   auth -> [change-a');
      expect(content, label).not.toContain('| auth (!)');
      expect(content, label).not.toContain('(auth: synced');
      expect(content, label).not.toContain('add-jwt/auth:');
    }
  });

  it('keeps onboarding task examples aligned with concrete verification guidance (#345)', () => {
    const variants: Array<[string, string]> = [
      ['onboard skill', deployedText(getOnboardSkillTemplate())],
      ['onboard command', getOpsxOnboardCommandTemplate().content],
    ];

    for (const [label, content] of variants) {
      const taskBlock = content.match(
        /Here are the implementation tasks:([\s\S]*?)Each checkbox becomes a unit of work/
      )?.[1];
      expect(taskBlock, label).toBeDefined();
      const checkboxes = taskBlock!
        .split('\n')
        .filter(line => /^- \[ \] \d+\.\d+ /.test(line));
      expect(checkboxes, label).toHaveLength(3);
      expect(
        checkboxes.every(
          line =>
            line.endsWith(
              '[Specific task] — verify: [test, command, observable behavior, or delivered artifact]'
            ) || / Verify .+ with \[.+\]$/.test(line)
        ),
        label
      ).toBe(true);
      expect(content, label).toContain(
        '[Specific task] — verify: [test, command, observable behavior, or delivered artifact]'
      );
      expect(content, label).toContain(
        'Verify [broader integration or system behavior] with [end-to-end test or observable result]'
      );
      expect(content, label).not.toContain('[Verification step]');
    }
  });

  // #1952: the onboarding walkthrough is where a user first meets task groups,
  // so it has to say the same thing the tasks instruction does - tests and docs
  // belong to the group that did the work, not to a trailing catch-up group.
  it('teaches per-group tests and docs in the onboarding walkthrough (#1952)', () => {
    const variants: Array<[string, string]> = [
      ['onboard skill', deployedText(getOnboardSkillTemplate())],
      ['onboard command', getOpsxOnboardCommandTemplate().content],
    ];

    for (const [label, content] of variants) {
      expect(content, label).toContain(
        'Each group carries the tests and documentation for its own work - the last group is only for integration checks.'
      );
      // The trailing group stays integration-only; it must not be renamed back
      // into a general testing/documentation bucket.
      expect(content, label).toContain('## 2. Integration Verification');
    }
  });

  it('generates no workspace-planning residue in any workflow template (4.1)', () => {
    const allSkills: Array<[string, () => SkillTemplate]> = [
      ['openspec-apply-change', getApplyChangeSkillTemplate],
      ['openspec-sync-specs', getSyncSpecsSkillTemplate],
      ['openspec-archive-change', getArchiveChangeSkillTemplate],
      ['openspec-bulk-archive-change', getBulkArchiveChangeSkillTemplate],
      ['openspec-verify-change', getVerifyChangeSkillTemplate],
    ];

    for (const [dirName, createTemplate] of allSkills) {
      const content = deployedText(createTemplate());
      expect(content, dirName).not.toContain('workspace-planning');
      expect(content, dirName).not.toContain('Workspace guard');
    }
  });

  it('does not suggest archiving when only planning is complete', () => {
    const variants: Array<[string, string]> = [
      [
        'skill',
        deployedText(getContinueChangeSkillTemplate()),
      ],
      ['opsx command', getOpsxContinueCommandTemplate().content],
    ];

    for (const [variant, content] of variants) {
      expect(content, variant).toContain('Planning is complete!');
      expect(content, variant).toContain(
        'Once implementation and any tracked work are complete, archive it'
      );
      expect(content, variant).not.toContain('All artifacts created!');
      expect(content, variant).not.toContain('or archive it');
    }
  });

  // #1393: the agent used to sync specs, verify them, and `mv` the change
  // itself, and could archive while a sync was still in flight. `openspec
  // archive` merges, validates, and moves in one call that refuses atomically,
  // so the workflow must hand all three to it.
  it('hands the merge, validation, and move to openspec archive (#1393)', () => {
    const variants: Array<[string, string]> = [
      ['skill', deployedText(getArchiveChangeSkillTemplate())],
      ['opsx command', getOpsxArchiveCommandTemplate().content],
    ];

    for (const [variant, content] of variants) {
      const preview = content.indexOf('openspec archive "<name>" --json\n');
      const archive = content.indexOf('openspec archive "<name>" --json --yes');
      expect(preview, variant).toBeGreaterThanOrEqual(0);
      expect(archive, variant).toBeGreaterThan(preview);
      expect(content, variant).toContain('`archive_confirmation_required`');
      expect(content, variant).toContain('Any other code is a problem `--yes` cannot fix');
      expect(content, variant).toContain('Never pass `--no-validate`');
      expect(content, variant).toContain(
        'Do not edit main specs or move `changeRoot` by hand'
      );
      expect(content, variant).toContain('Pass `--yes` only after the user agrees to what the preview reported');
      expect(content, variant).not.toMatch(/\bmv "/);
      expect(content, variant).not.toContain('/opsx:sync');
    }
  });

  it('requires sync to create a missing main spec from ADDED requirements (#1222, #1264)', () => {
    // `openspec archive` creates the main spec from the delta's ADDED
    // requirements when it does not exist yet (`buildUpdatedSpec`,
    // specs-apply.ts), and archive now runs it directly. The sync workflow
    // still merges by hand, so it must not invent a requirement that has no
    // base to modify or write the empty spec the CLI refuses.
    const syncVariants: Array<[string, string]> = [
      ['sync skill', skillSource(getSyncSpecsSkillTemplate())],
      ['sync command', getOpsxSyncCommandTemplate().content],
    ];

    for (const [variant, content] of syncVariants) {
      const start = content.indexOf('## When the main spec does not exist yet');
      const end = content.indexOf('## Retiring a capability', start);
      expect(start, variant).toBeGreaterThan(-1);
      expect(end, variant).toBeGreaterThan(start);
      const newSpec = content.slice(start, end);

      expect(newSpec, variant).toContain('allows only ADDED requirements here');
      expect(newSpec, variant).toContain('there is no requirement to act on');
      expect(newSpec, variant).toContain('never invent the missing requirement');
      expect(newSpec, variant).toContain('REMOVED: nothing to remove');
      expect(newSpec, variant).toContain('Spec must have at least one requirement');
      expect(newSpec, variant).toContain('Never write an empty');
      expect(newSpec, variant).toContain('create nothing');
    }
  });

  it('offers archiving without updating specs, and Cancel, at the confirmation', () => {
    for (const content of [
      deployedText(getArchiveChangeSkillTemplate()),
      getOpsxArchiveCommandTemplate().content,
    ]) {
      expect(content).toContain('"Archive without updating specs"');
      expect(content).toContain('run step 5 with `--yes --skip-specs`');
      expect(content).toContain('"Cancel" — stop, do not archive');
      expect(content).toContain(
        'If the response still has no `archive` object, show each `status` message and `fix` and stop'
      );
    }
  });

  it('recognizes explicitly retired missing specs during a sync', () => {
    for (const content of [
      skillSource(getSyncSpecsSkillTemplate()),
      getOpsxSyncCommandTemplate().content,
    ]) {
      const newSpec = content.slice(
        content.indexOf('## When the main spec does not exist yet'),
        content.indexOf('## Retiring a capability')
      );
      expect(newSpec).toContain('`retire_capabilities: true`');
      expect(newSpec).toContain('is already retired');
      expect(newSpec).toContain('do not recreate the spec');
      expect(newSpec).toContain('Without that marker, report the sync as blocked');
    }
  });


  it('carries mixed included and excluded bulk-archive deltas through both generated variants', () => {
    const variants: Array<[string, string]> = [
      ['bulk skill', deployedText(getBulkArchiveChangeSkillTemplate())],
      ['bulk opsx command', getOpsxBulkArchiveCommandTemplate().content],
    ];

    for (const [variant, content] of variants) {
      expect(content, variant).toContain(
        'Record an inclusion or exclusion decision for every delta spec, keyed by change and `<capability-path>`'
      );
      expect(content, variant).toContain(
        'A single change can have both included and excluded delta specs'
      );
      expect(content, variant).toContain('with only its included delta paths');
      expect(content, variant).toContain('then archive it with `--skip-specs`');
      expect(content, variant).toContain(
        'A change whose deltas are all excluded is archived with `--skip-specs`'
      );
      expect(content, variant).toContain('report every excluded delta as `sync skipped`'.replace('report', 'Report'));
      expect(content, variant).toContain('that is distinct from skipping the archive');
      expect(content, variant).toContain(
        '1 delta spec sync skipped (add-jwt, identity/user-auth: implementation not found)'
      );
    }
  });

  it('lets the sync workflow honor the delta subset bulk archive hands it', () => {
    // Bulk archive names the deltas to keep, but sync treats existingOutputPaths
    // as its own source of truth. Without an explicit carve-out the callee
    // re-syncs the delta the caller withheld.
    const variants: Array<[string, string]> = [
      ['sync skill', skillSource(getSyncSpecsSkillTemplate())],
      ['sync command', getOpsxSyncCommandTemplate().content],
    ];

    for (const [variant, content] of variants) {
      expect(content, variant).toContain(
        'unless the caller narrowed the set by naming complete entries from `existingOutputPaths`'
      );
      expect(content, variant).toContain('copy those absolute values verbatim');
      expect(content, variant).toContain('/specs/billing/invoices/spec.md');
      expect(content, variant).toContain('Then sync only those and leave the rest untouched');
      expect(content, variant).toContain('Never widen a narrowed set back to the full list');
      expect(content, variant).toContain('For each selected path');
      expect(content, variant).toContain(
        'If a named path is not in `existingOutputPaths`, report it and stop'
      );
      expect(content, variant).toContain(
        'If the named list is empty, report that there is nothing to sync and stop'
      );
    }
  });

  it('requires apply context while keeping guidance advisory and state separate', () => {
    const variants: Array<[string, string]> = [
      ['apply skill', skillSource(getApplyChangeSkillTemplate())],
      ['apply command', getOpsxApplyCommandTemplate().content],
    ];

    for (const [variant, content] of variants) {
      expect(content, variant).toContain('Optional `context`');
      expect(content, variant).toContain('Optional `operationGuidance`');
      expect(content, variant).toContain('Treat `context` as a required prompt-level input');
      expect(content, variant).toContain('apply relevant project facts, conventions, and constraints');
      expect(content, variant).toContain(
        'Treat `operationGuidance` as optional additive advice'
      );
      expect(content, variant).toContain('Read and consider every');
      expect(content, variant).toContain('applicable and compatible with the built-in');
      expect(content, variant).toContain(
        'separate from CLI-returned state, missing artifacts, tasks'
      );
      expect(content, variant).toContain('Neither is evidence that a task is complete');
      expect(content, variant).toContain(
        'Do not use context or operation guidance as proof that a task is complete'
      );
      expect(content, variant).toContain('conflict and preserve the controlling value');
      expect(content, variant).toContain('do not follow it and explain why');
      expect(content, variant).toContain(
        'Do not copy runtime context or operation guidance into implementation files or planning artifacts'
      );
      expect(content, variant).toContain(
        'Preserve CLI-controlled blocked/ready/all-done behavior'
      );
      expect(content, variant).toContain(
        'These are prompt-level behavior contracts, not enforceable checks'
      );
    }
  });

  it('makes the archive-inputs lookup fail open and sync instruction consumption fail closed', () => {
    const archiveVariants: Array<[string, string]> = [
      ['archive skill', deployedText(getArchiveChangeSkillTemplate())],
      ['archive command', getOpsxArchiveCommandTemplate().content],
    ];

    for (const [variant, content] of archiveVariants) {
      expect(content, variant).toContain('openspec instructions archive --change "<name>" --json');
      // The archive-inputs lookup is a newer CLI command, so a skill installed
      // ahead of the CLI (skills.sh) must degrade instead of blocking archiving.
      expect(content, variant).toContain('This lookup is advisory and optional');
      expect(content, variant).toContain('if it fails or returns invalid JSON (for example on an older CLI), continue with neither');
      expect(content, variant).toContain('Do not report an error and do not stop');
      expect(content, variant).toContain('follow `references/runtime-inputs.md`');
      expect(content, variant).toContain('Treat `context` as a required prompt-level input');
      expect(content, variant).toContain('Treat `operationGuidance` as optional additive advice');
      expect(content, variant).toContain('report the conflict and preserve the controlling value');
      expect(content, variant).toContain('do not follow it and explain why');
    }

    const syncVariants: Array<[string, string]> = [
      ['sync skill', skillSource(getSyncSpecsSkillTemplate())],
      ['sync command', getOpsxSyncCommandTemplate().content],
    ];

    for (const [variant, content] of syncVariants) {
      expect(content, variant).toContain(
        '`artifactPaths.specs.existingOutputPaths` is the only source of delta spec paths'
      );
      expect(content, variant).toContain('If it is missing or empty');
      expect(content, variant).toContain('without inferring them from other artifacts');
      expect(content, variant).toContain('or reuse the snapshot a calling workflow already fetched');
      expect(content, variant).toContain('stop before writing any main spec');
      expect(content, variant).toContain('a failure is not the same as having no rules');
      expect(content, variant).toContain('A valid response with no `rules` means none are configured');
      expect(content, variant).toContain('never copying their text into a spec or summary');
    }
  });

  it('loads bulk archive inputs once and never lets that lookup block the batch', () => {
    const variants: Array<[string, string]> = [
      ['bulk skill', deployedText(getBulkArchiveChangeSkillTemplate())],
      ['bulk command', getOpsxBulkArchiveCommandTemplate().content],
    ];

    for (const [variant, content] of variants) {
      expect(content, variant).toContain(
        'openspec instructions archive --change "<selected-change>" --json'
      );
      expect(content, variant).toContain('once for one selected change');
      expect(content, variant).toContain('This lookup is advisory: if it fails or returns invalid JSON, continue with neither');
      expect(content, variant).toContain('`artifactPaths.specs.existingOutputPaths` is the only source');
      expect(content, variant).toContain('never infer them from other artifacts');
      expect(content, variant).toContain('Treat `context` as a required prompt-level input');
      expect(content, variant).toContain('Do not copy runtime context or operation guidance');
    }
  });

  // The archive instructions must mirror `openspec archive`'s date-prefix
  // rule (#1316): a change already named with a `YYYY-MM-DD-` prefix keeps
  // its name, so archived names never stack dates. Guard the caveat, the
  // literal `mv` target, and the success-summary examples an agent would
  // copy verbatim (#1317).
  it('never instructs stacking a date prefix on an already-dated change (#1317)', () => {
    // Archive and bulk archive leave naming to `openspec archive`; onboard is
    // the one walkthrough that still shows the archived path.
    for (const text of [
      deployedText(getArchiveChangeSkillTemplate()),
      deployedText(getBulkArchiveChangeSkillTemplate()),
      getOpsxArchiveCommandTemplate().content,
      getOpsxBulkArchiveCommandTemplate().content,
    ]) {
      expect(text).not.toMatch(/\/YYYY-MM-DD-/);
      expect(text).not.toContain('prepend the current date');
    }

    const archiveInstructions: Array<[string, string]> = [
      ['openspec-onboard', getOnboardSkillTemplate().instructions],
      ['opsx-onboard', getOpsxOnboardCommandTemplate().content],
    ];

    for (const [id, text] of archiveInstructions) {
      expect(text, id).toContain('already starts with a `YYYY-MM-DD-` prefix');

      // Every archive path an agent reproduces must name the derived target,
      // never a hardcoded date.
      expect(text, id).toContain('<target-name>');

      // Discriminator: a `YYYY-MM-DD-` after a path separator belongs to a
      // literal archive path the agent copies verbatim. The rule statements
      // only name the prefix, never place it in a path, so they stay legal.
      expect(text, id).not.toMatch(/\/YYYY-MM-DD-/);
    }
  });

  // Guidance that tells an agent to run `openspec archive` has to pass
  // --yes: the agent cannot answer the confirmation prompts from a tool
  // call, so the bare command aborts (#1479). A golden hash proves the
  // generated file matches its source, never that the source is right, so
  // pin the flag itself.
  it('passes --yes wherever it tells an agent to run openspec archive (#1479)', () => {
    // Sweep the whole corpus, not just the one template that has such an
    // invocation today: the point is to catch the next one.
    const corpus: Array<[string, string]> = [
      ...getSkillTemplates().map(
        ({ dirName, template }) => [dirName, skillSource(template)] as [string, string]
      ),
      ...getCommandContents().map((entry) => [entry.id, entry.body] as [string, string]),
    ];

    // Only runnable invocations count: prose that merely names the command
    // ("same rule as `openspec archive`") has nothing to confirm, and it is
    // always mid-sentence, so requiring the command to open the line
    // separates the two. Everything a runnable line may legitimately carry in
    // front of the command is allowed, because each of these hid an
    // invocation from an earlier, stricter version of this check: indentation,
    // a list marker, a shell prompt, and a global flag between `openspec` and
    // `archive`. Tokenised rather than pattern-matched - the regex this
    // replaces needed nested quantifiers to accept the flags, which is a ReDoS
    // shape even in a test.
    function archiveInvocations(text: string): string[] {
      return text.split('\n').filter((line) => {
        const bare = line
          .trimStart()
          .replace(/^(?:[-*+]|\d+\.)[ \t]+/, '')
          .replace(/^\$[ \t]+/, '');
        const tokens = bare.split(/\s+/).filter(Boolean);
        if (tokens[0] !== 'openspec') return false;
        const archiveAt = tokens.indexOf('archive');
        if (archiveAt < 1) return false;
        // Anything between `openspec` and `archive` has to be a global flag or
        // one's value, or this is a different subcommand that merely mentions
        // the word (`openspec list archive`).
        return tokens
          .slice(1, archiveAt)
          .every((token, i, before) => token.startsWith('-') || !!before[i - 1]?.startsWith('-'));
      });
    }

    let total = 0;
    for (const [id, text] of corpus) {
      const invocations = archiveInvocations(text);
      total += invocations.length;
      for (const invocation of invocations) {
        // `--json` never prompts either: it reports each confirmation as a
        // `status` entry, which is how archive previews before `--yes`.
        expect(invocation.trim(), id).toMatch(/--yes|--json/);
      }
    }

    // Guards the guard, and names the floor rather than trusting `> 0`: the
    // onboarding walkthrough is the one template that is supposed to contain
    // a runnable archive invocation, so a corpus that stops containing it
    // fails here instead of passing vacuously.
    expect(total).toBeGreaterThan(0);
    const onboard = corpus.filter(([id]) => id.includes('onboard'));
    expect(onboard.length).toBeGreaterThan(0);
    for (const [id, text] of onboard) {
      expect(archiveInvocations(text), id).not.toHaveLength(0);
    }
  });

  // Covers both archive paths, not just the bulk one the fix targeted: the
  // single-change routing has been correct since #1357 (current wording from
  // #1394) but was never pinned, so a stale branch could silently reopen the
  // bug #1381 actually reported.
  it('honors Cancel at every archive confirmation (#1381)', () => {
    const variants: Array<[string, string]> = [
      ['bulk skill', deployedText(getBulkArchiveChangeSkillTemplate())],
      ['bulk opsx command', getOpsxBulkArchiveCommandTemplate().content],
      ['single skill', deployedText(getArchiveChangeSkillTemplate())],
      ['single opsx command', getOpsxArchiveCommandTemplate().content],
    ];

    for (const [variant, content] of variants) {
      // Offering "Cancel" without routing it let an agent fall straight through
      // to the archive step and move the changes anyway.
      expect(content, variant).toContain('"Cancel" — stop, do not archive');

      // An unrecognized answer must re-prompt; archiving is never the default.
      expect(content, variant).toContain('Anything else — ask again rather than archiving');
    }
  });

  // The bulk confirmation labels are written by the agent and carry an `N`
  // placeholder, so routing must match intent — matching the literal labels
  // would send every legitimate answer down the "ask again" path forever.
  it('routes the bulk archive confirmation by intent, not by literal label (#1381)', () => {
    const variants: Array<[string, string]> = [
      ['bulk skill', deployedText(getBulkArchiveChangeSkillTemplate())],
      ['bulk opsx command', getOpsxBulkArchiveCommandTemplate().content],
    ];

    for (const [variant, content] of variants) {
      expect(content, variant).toContain('Route on the answer by intent, not by exact label');

      // The ready-only route has to name where "ready" is decided, or the agent
      // cannot tell which subset to archive.
      expect(content, variant).toContain('the changes the status table marks');

      // A cancelled batch must archive nothing, reinforced where agents skim.
      expect(content, variant).toContain(
        'Never archive after the user cancels the confirmation'
      );
    }
  });

  it('makes the schema instruction field authoritative for artifact creation (#777)', () => {
    const variants: Array<[string, string]> = [
      ['propose skill', deployedText(getOpsxProposeSkillTemplate())],
      ['propose command', getOpsxProposeCommandTemplate().content],
      ['continue skill', deployedText(getContinueChangeSkillTemplate())],
      ['continue command', getOpsxContinueCommandTemplate().content],
      ['ff skill', deployedText(getFfChangeSkillTemplate())],
      ['ff command', getOpsxFfCommandTemplate().content],
    ];

    for (const [variant, content] of variants) {
      // The instruction field wins even for familiar artifact names: the old
      // hard-coded "Common artifact patterns" shortcut is what let agents
      // ignore custom schemas that reuse proposal.md/tasks.md file names.
      expect(content, variant).toContain('the authoritative guidance');
      expect(content, variant).not.toContain('Common artifact patterns');

      // Delegated creation is honored at the creation step itself, held to the
      // output path already chosen and checked (#2099), and the delegated
      // skill's output is verified rather than assumed.
      expect(content, variant).toContain(
        'If the `instruction` field delegates creation to a specific skill or command, invoke it only if it can write the artifact to that output path; otherwise stop and tell the user'
      );
      expect(content, variant).toMatch(
        /(?:Then|Either way,) verify the artifact file exists at that output path/u
      );

      // ...and restated in the artifact-creation guidelines.
      expect(content, variant).toContain(
        'If the `instruction` field directs you to use a specific skill or command to create the artifact, invoke it instead of writing the artifact directly - but only once you have chosen and checked the output path, and only if it can write there'
      );
    }
  });

  // A golden hash proves the generated file matches its source, never that the
  // source is right - so a careless `regen:parity-hashes` over a dropped
  // paragraph passes CI silently. The sync skill is the one place an agent
  // learns that retiring a capability needs the marker; pin the fact, not the
  // hash, so losing the guidance fails here instead of shipping.
  it('tells the sync skill that retirement needs the retire_capabilities marker', () => {
    const sync = getSkillTemplates().find(
      ({ dirName }) => dirName === 'openspec-sync-specs'
    );
    expect(sync, 'openspec-sync-specs template').toBeTruthy();
    const variants = [
      ['sync skill', skillSource(sync!.template)],
      ['sync command', getOpsxSyncCommandTemplate().content],
    ] as const;
    for (const [variant, text] of variants) {
      expect(text, variant).toContain('retire_capabilities: true');
      expect(text, variant).toContain('every other nonblank line in the whole file is accounted for');
      expect(text, variant).toContain('resolves inside the real specs root');
      expect(text, variant).toContain('checkout-scoped recovery guidance');
      expect(text, variant).toContain('do not modify the main spec');
      expect(text, variant).toMatch(/Stop\s+the sync for that capability/);
      expect(text, variant).toContain(
        'Never write or leave an empty `## Requirements` section'
      );
      expect(text, variant).not.toContain('any other sections');
      expect(text, variant).not.toContain('Loose prose left under `## Requirements` does NOT block');
    }
  });

  // The explore capture table names spec-driven files; without this caveat an
  // agent on a custom schema offers to write artifacts it never defines (#2084).
  it('scopes the explore capture table to the default schema', () => {
    const variants = [
      ['explore skill', skillSource(getExploreSkillTemplate())],
      ['explore command', getOpsxExploreCommandTemplate().content],
    ] as const;
    for (const [variant, text] of variants) {
      expect(text, variant).toContain(
        "The files below are the default spec-driven schema's. With another schema, capture each insight in whichever artifact from `artifactPaths` fits it"
      );
    }
  });
});

describe('apply skill/command shared instruction core', () => {
  // The apply skill and command are intentionally distinct surfaces, but they
  // differ only in how they are invoked — the generation transformers rewrite
  // the canonical `/opsx:<id>` tokens per surface downstream (asserted in
  // test/utils/command-references.test.ts). The instruction text itself is
  // shared, so this pins the contract: both surfaces render the one canonical
  // core and cannot silently drift apart at the template level.
  it('renders both apply surfaces from the shared instruction core', () => {
    const core = getApplyInstructions();
    const skill = getApplyChangeSkillTemplate();
    expect(skill.instructions).toBe(core);
    // A command has no folder for references, so it carries them appended.
    expect(getOpsxApplyCommandTemplate().content).toBe(withReferences(core, skill.references ?? []));
  });

  it('keeps task completion distinct from archive readiness (#1790)', () => {
    const core = getApplyInstructions();
    expect(core).toContain('All tracked tasks are complete');
    expect(core).toMatch(/Review or verify the change as appropriate\s+before archiving/);
    expect(core).not.toContain('All tasks complete! You can archive');
  });
});

describe('workflow guidance matches the packaged templates (#1138)', () => {
  // Onboard drafts each artifact in the conversation and then saves what it
  // drafted, so a preview missing the template's title writes an untitled file
  // no matter what the template says.
  it('shows every artifact title in the onboarding walkthrough', () => {
    const titles = specDrivenTitles();
    const surfaces: Array<[string, string]> = [
      ['onboard skill', getOnboardSkillTemplate().instructions],
      ['opsx onboard command', getOpsxOnboardCommandTemplate().content],
    ];

    for (const [surface, text] of surfaces) {
      for (const artifactId of ['proposal', 'specs', 'design', 'tasks']) {
        expect(text, `${surface} / ${artifactId}`).toContain(`\n${titles[artifactId]}\n`);
      }
    }
  });

  // The sync workflow prints a delta reference right beside the main-spec one.
  // The two are only telling them apart if the delta carries its own title.
  it('titles the delta spec in the sync format reference', () => {
    const titles = specDrivenTitles();

    for (const [surface, text] of [
      ['sync skill', skillSource(getSyncSpecsSkillTemplate())],
      ['opsx sync command', getOpsxSyncCommandTemplate().content],
    ] as Array<[string, string]>) {
      expect(text, surface).toContain(`\n${titles.specs}\n\n## Purpose\n`);
      expect(text, surface).toContain('\n# <capability> Specification\n');
    }
  });
});
