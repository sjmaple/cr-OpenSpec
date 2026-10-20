// Each scenario is one realistic request a user makes of an agent.
// `setup` shapes the project before the agent starts; `checks` grade the
// result with the OpenSpec CLI and the file system, never with the agent's
// own report of what it did.
import fs from 'node:fs';
import path from 'node:path';
import { applyClearCompleted } from './seeds/add-clear-completed/implementation.patch.mjs';

// Runs are headless, so nobody can answer a question. Requests that should
// finish on their own say so, the way a user stepping away would.
const AUTONOMOUS = ' Use your best judgment instead of asking me questions.';

const SEEDS = path.join(path.dirname(new URL(import.meta.url).pathname), 'seeds');

function seedChange(root, name) {
  fs.cpSync(path.join(SEEDS, name), path.join(root, 'openspec', 'changes', name), {
    recursive: true,
    filter: (source) => !source.endsWith('.mjs'),
  });
}

function onlyOpenspecChanged(ctx) {
  const outside = ctx.changedFiles().filter((file) => !file.startsWith('openspec/'));
  return {
    name: 'no files changed outside openspec/',
    pass: outside.length === 0,
    detail: outside.join(', '),
  };
}

function nothingChanged(ctx) {
  const changed = ctx.changedFiles();
  return { name: 'no files changed', pass: changed.length === 0, detail: changed.join(', ') };
}

function newChangeNames(ctx) {
  const dir = path.join(ctx.root, 'openspec', 'changes');
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((name) => name !== 'archive' && fs.statSync(path.join(dir, name)).isDirectory());
}

function tasksDone(ctx, name) {
  const text = ctx.read(`openspec/changes/${name}/tasks.md`) ?? '';
  const open = (text.match(/^\s*- \[ \]/gm) ?? []).length;
  const done = (text.match(/^\s*- \[x\]/gim) ?? []).length;
  return { open, done };
}

export const SCENARIOS = [
  {
    id: 'propose',
    prompt:
      '/openspec-propose Todos need an optional due date, and callers need a way to list the todos that are overdue.' + AUTONOMOUS,
    checks: (ctx) => {
      const names = newChangeNames(ctx);
      const name = names[0];
      const results = [
        { name: 'exactly one change created', pass: names.length === 1, detail: names.join(', ') },
      ];
      if (!name) return results;
      const status = ctx.openspecJson(['status', '--change', name, '--json']);
      const artifacts = status?.artifacts ?? [];
      const missing = artifacts.filter((a) => a.status !== 'done').map((a) => a.id);
      results.push({
        name: 'every artifact written',
        pass: artifacts.length > 0 && missing.length === 0,
        detail: missing.join(', '),
      });
      const validate = ctx.openspec(['validate', name, '--strict']);
      results.push({ name: 'change validates (strict)', pass: validate.code === 0, detail: validate.out.slice(-300) });
      const delta = ctx.read(`openspec/changes/${name}/specs/todo-list/spec.md`);
      results.push({
        name: 'delta targets the existing todo-list capability',
        pass: Boolean(delta && /## (ADDED|MODIFIED) Requirements/.test(delta)),
      });
      results.push(onlyOpenspecChanged(ctx));
      return results;
    },
  },
  {
    id: 'apply',
    setup: (root) => seedChange(root, 'add-priority'),
    prompt: '/openspec-apply-change add-priority.' + AUTONOMOUS,
    checks: (ctx) => {
      const { open, done } = tasksDone(ctx, 'add-priority');
      const tests = ctx.run('node', ['--test']);
      const src = ctx.read('src/todo.js') ?? '';
      return [
        { name: 'every task checked off', pass: open === 0 && done === 3, detail: `open=${open} done=${done}` },
        { name: 'project tests pass', pass: tests.code === 0, detail: tests.out.slice(-300) },
        { name: 'PRIORITIES exported', pass: /export\s+(const|let)\s+PRIORITIES/.test(src) },
        {
          name: 'tests cover priority',
          pass: /priority/i.test(ctx.read('test/todo.test.js') ?? ''),
        },
        {
          name: 'change not archived',
          pass: ctx.exists('openspec/changes/add-priority/proposal.md'),
        },
      ];
    },
  },
  {
    id: 'verify',
    setup: (root) => {
      seedChange(root, 'add-priority');
      // Tasks claim done, but the implementation never rejects unknown priorities.
      const tasks = path.join(root, 'openspec/changes/add-priority/tasks.md');
      fs.writeFileSync(tasks, fs.readFileSync(tasks, 'utf8').replaceAll('- [ ]', '- [x]'));
      const src = path.join(root, 'src/todo.js');
      fs.writeFileSync(
        src,
        fs
          .readFileSync(src, 'utf8')
          .replace('export class TodoList {', "export const PRIORITIES = ['low', 'normal', 'high'];\n\nexport class TodoList {")
          .replace('  add(title) {', "  add(title, { priority = 'normal' } = {}) {")
          .replace('done: false };', 'done: false, priority };')
      );
    },
    prompt: '/openspec-verify-change add-priority',
    checks: (ctx) => [
      {
        name: 'reports the missing rejection of unknown priorities',
        pass: /(reject|unknown|invalid|urgent|allowed)/i.test(ctx.result) && /(1\.2|not implemented|missing|no (check|validation)|does not|doesn't|isn't|is not|never|gap|critical|fail)/i.test(ctx.result),
      },
      { ...nothingChanged(ctx), name: 'verify is read-only' },
    ],
  },
  {
    id: 'sync',
    setup: (root) => {
      seedChange(root, 'add-clear-completed');
      applyClearCompleted(root);
    },
    prompt: '/openspec-sync-specs add-clear-completed.' + AUTONOMOUS,
    checks: (ctx) => {
      const main = ctx.read('openspec/specs/todo-list/spec.md') ?? '';
      const validate = ctx.openspec(['validate', '--specs', '--strict']);
      return [
        { name: 'main spec gains the requirement', pass: /### Requirement: Clearing completed todos/.test(main) },
        { name: 'existing requirements kept', pass: /### Requirement: Adding a todo/.test(main) && /### Requirement: Reading todos/.test(main) },
        { name: 'no delta headers left in main spec', pass: !/## (ADDED|MODIFIED|REMOVED|RENAMED) Requirements/.test(main) },
        { name: 'main specs validate (strict)', pass: validate.code === 0, detail: validate.out.slice(-300) },
        { name: 'change not archived', pass: ctx.exists('openspec/changes/add-clear-completed/proposal.md') },
      ];
    },
  },
  {
    id: 'archive',
    setup: (root) => {
      seedChange(root, 'add-clear-completed');
      applyClearCompleted(root);
    },
    prompt: '/openspec-archive-change add-clear-completed. It is finished, so sync the specs and archive it.' + AUTONOMOUS,
    checks: (ctx) => {
      const archiveDir = path.join(ctx.root, 'openspec/changes/archive');
      const archived = fs.existsSync(archiveDir)
        ? fs.readdirSync(archiveDir).filter((name) => name.endsWith('add-clear-completed'))
        : [];
      const main = ctx.read('openspec/specs/todo-list/spec.md') ?? '';
      const validate = ctx.openspec(['validate', '--all', '--strict']);
      return [
        { name: 'change moved to the archive', pass: archived.length === 1 && !ctx.exists('openspec/changes/add-clear-completed') },
        { name: 'main spec gains the requirement', pass: /### Requirement: Clearing completed todos/.test(main) },
        { name: 'everything validates (strict)', pass: validate.code === 0, detail: validate.out.slice(-300) },
        { name: 'no source files changed', pass: ctx.changedFiles().every((file) => file.startsWith('openspec/')) },
      ];
    },
  },
  {
    // Unfinished work: archiving must stop and ask, never archive on its own.
    id: 'archive-unfinished',
    setup: (root) => seedChange(root, 'add-priority'),
    prompt: '/openspec-archive-change add-priority',
    checks: (ctx) => [
      { name: 'change is not archived', pass: ctx.exists('openspec/changes/add-priority/proposal.md') },
      { name: 'main spec unchanged', pass: !/Todo priority/.test(ctx.read('openspec/specs/todo-list/spec.md') ?? '') },
      { name: 'warns about the incomplete tasks', pass: /incomplete|unfinished|not (yet )?(complete|done)|0\/3|3 (open|remaining)/i.test(ctx.result) },
    ],
  },
  {
    // A request that asks for implementation must still stop after planning.
    id: 'propose-then-stop',
    prompt:
      '/openspec-propose Add a `rename(id, title)` method to the todo list, then go ahead and implement it.' + AUTONOMOUS,
    checks: (ctx) => {
      const names = newChangeNames(ctx);
      const results = [{ name: 'a change was created', pass: names.length === 1, detail: names.join(', ') }];
      if (names[0]) {
        const validate = ctx.openspec(['validate', names[0], '--strict']);
        results.push({ name: 'change validates (strict)', pass: validate.code === 0, detail: validate.out.slice(-300) });
      }
      results.push({ ...onlyOpenspecChanged(ctx), name: 'no code written (planning only)' });
      return results;
    },
  },
  {
    id: 'explore',
    prompt: '/openspec-explore Should due dates be stored as Date objects or ISO strings in this library?',
    checks: (ctx) => [
      { ...nothingChanged(ctx), name: 'explore writes nothing' },
      { name: 'gives an answer', pass: /(iso|date object|string)/i.test(ctx.result) },
    ],
  },
  {
    id: 'no-project',
    init: false,
    prompt: '/openspec-propose Add an optional due date to todos.',
    checks: (ctx) => [
      { name: 'does not create openspec/', pass: !ctx.exists('openspec') },
      { ...nothingChanged(ctx), name: 'writes nothing' },
    ],
  },
];
