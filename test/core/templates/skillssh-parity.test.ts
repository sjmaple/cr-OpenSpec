import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import {
  generateSkillFiles,
  getSkillTemplates,
} from '../../../src/core/shared/skill-generation.js';
import { transformToSkillReferences } from '../../../src/utils/command-references.js';
// @ts-expect-error - plain ESM helper shared with the generator script
import { SKILLS_DIR, stripVolatileFrontmatter } from '../../../scripts/skillssh-shared.mjs';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');

// The committed `skills/<name>/` tree is the skills.sh distribution
// (`npx skills add Fission-AI/OpenSpec`). It must match what the generator
// would produce from the live templates; regenerate with `pnpm generate:skills`.
describe('skills.sh distribution parity', () => {
  it('keeps committed skills/ in sync with the workflow templates', () => {
    for (const { template, dirName } of getSkillTemplates()) {
      for (const file of generateSkillFiles(template, 'skills.sh', transformToSkillReferences)) {
        const committedPath = join(repoRoot, SKILLS_DIR, dirName, file.relativePath);
        const committed = readFileSync(committedPath, 'utf8');
        expect(
          committed,
          `${dirName}/${file.relativePath} is stale — run \`pnpm generate:skills\``
        ).toBe(stripVolatileFrontmatter(file.content));
      }
    }
  });

  // Guard against extra, renamed, or symlinked entries that the per-template
  // loop above would never visit: the committed tree must be exactly what the
  // generator owns — README.md plus one real directory per template, each
  // holding a real SKILL.md and exactly the reference files it generates.
  it('commits exactly the generated file set — no extra or symlinked entries', () => {
    const skillsRoot = join(repoRoot, SKILLS_DIR);
    const expectedDirs = getSkillTemplates()
      .map(({ dirName }) => dirName)
      .sort();

    const entries = readdirSync(skillsRoot, { withFileTypes: true });
    for (const entry of entries) {
      expect(entry.isSymbolicLink(), `skills/${entry.name} must not be a symlink`).toBe(false);
    }

    // Untracked OS droppings like .DS_Store would fail the exact-set check
    // without telling us anything about the published tree, so hidden *files*
    // are tolerated; hidden directories still fail the dirs assertion.
    const dirs = entries.filter((e) => e.isDirectory()).map((e) => e.name).sort();
    const files = entries
      .filter((e) => e.isFile() && !e.name.startsWith('.'))
      .map((e) => e.name)
      .sort();
    expect(dirs).toEqual(expectedDirs);
    expect(files).toEqual(['README.md']);

    const generated = new Map(
      getSkillTemplates().map(({ template, dirName }) => [
        dirName,
        generateSkillFiles(template, 'skills.sh', transformToSkillReferences).map(
          (file) => file.relativePath
        ),
      ])
    );
    for (const dir of dirs) {
      const listed: string[] = [];
      for (const entry of readdirSync(join(skillsRoot, dir), { withFileTypes: true, recursive: true })) {
        if (entry.isFile() && entry.name.startsWith('.')) continue;
        const relative = join(entry.parentPath, entry.name).slice(join(skillsRoot, dir).length + 1);
        expect(entry.isSymbolicLink(), `skills/${dir}/${relative} must not be a symlink`).toBe(false);
        if (entry.isFile()) listed.push(relative.split('\\').join('/'));
      }
      expect(listed.sort(), `skills/${dir} must contain only its generated files`).toEqual(
        [...generated.get(dir)!].sort()
      );
    }
  });
});
