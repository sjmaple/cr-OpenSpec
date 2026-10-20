#!/usr/bin/env node
// Runs every scenario against the skills one OpenSpec checkout generates and
// writes one JSON result per run. See README.md.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { SCENARIOS } from './scenarios.mjs';

const HERE = path.dirname(new URL(import.meta.url).pathname);
const WORKFLOWS = ['propose', 'explore', 'apply', 'update', 'sync', 'archive', 'verify'];

const { values } = parseArgs({
  options: {
    label: { type: 'string' },
    cli: { type: 'string' },
    grader: { type: 'string', default: path.resolve(HERE, '../..') },
    model: { type: 'string', default: 'claude-sonnet-5-5' },
    reps: { type: 'string', default: '3' },
    only: { type: 'string' },
    out: { type: 'string', default: path.join(HERE, 'results') },
    parallel: { type: 'string', default: '4' },
  },
});
if (!values.label || !values.cli) {
  console.error('usage: run.mjs --label <name> --cli <openspec checkout> [--model m] [--reps n] [--only a,b] [--out dir]');
  process.exit(2);
}

const cliRoot = path.resolve(values.cli);
const graderRoot = path.resolve(values.grader);
const outDir = path.resolve(values.out, values.label);
fs.mkdirSync(outDir, { recursive: true });

function shim(dir, checkout, configHome) {
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, 'openspec');
  fs.writeFileSync(
    file,
    `#!/bin/sh\nXDG_CONFIG_HOME="${configHome}" OPENSPEC_TELEMETRY=0 OPENSPEC_NO_UPDATE_CHECK=1 exec node "${checkout}/bin/openspec.js" "$@"\n`,
    { mode: 0o755 }
  );
  return dir;
}

function run(cmd, args, opts = {}) {
  const r = spawnSync(cmd, args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, ...opts });
  return { code: r.status ?? 1, out: `${r.stdout ?? ''}${r.stderr ?? ''}` };
}

function makeProject(scenario, work) {
  const root = path.join(work, 'todo-lite');
  fs.cpSync(path.join(HERE, 'fixture'), root, { recursive: true });
  const configHome = path.join(work, 'config');
  fs.mkdirSync(path.join(configHome, 'openspec'), { recursive: true });
  fs.writeFileSync(
    path.join(configHome, 'openspec', 'config.json'),
    JSON.stringify({ profile: 'custom', delivery: 'skills', workflows: WORKFLOWS, telemetry: { noticeSeen: true } })
  );
  const bin = shim(path.join(work, 'bin'), cliRoot, configHome);
  const env = { ...process.env, PATH: `${bin}:${process.env.PATH}` };

  if (scenario.init === false) {
    // Skills are installed for the user, but this repository never adopted OpenSpec.
    const scratch = path.join(work, 'skills-source');
    fs.mkdirSync(scratch);
    run('openspec', ['init', '--tools', 'claude'], { cwd: scratch, env });
    fs.cpSync(path.join(scratch, '.claude'), path.join(root, '.claude'), { recursive: true });
    fs.rmSync(path.join(root, 'openspec'), { recursive: true, force: true });
  } else {
    const init = run('openspec', ['init', '--tools', 'claude'], { cwd: root, env });
    if (init.code !== 0) throw new Error(`openspec init failed:\n${init.out}`);
  }
  scenario.setup?.(root);
  // The starting commit is the baseline every "what changed" check diffs
  // against, so it must exist. Signing is off: it is a throwaway repository.
  run('git', ['init', '-q'], { cwd: root });
  run('git', ['add', '-A'], { cwd: root });
  const commit = run(
    'git',
    ['-c', 'user.name=dev', '-c', 'user.email=dev@example.com', '-c', 'commit.gpgsign=false', 'commit', '-qm', 'start'],
    { cwd: root }
  );
  if (commit.code !== 0) throw new Error(`could not commit the starting fixture:\n${commit.out}`);
  return { root, env, configHome };
}

function grade(scenario, root, configHome, result) {
  const graderBin = shim(path.join(path.dirname(root), 'grader-bin'), graderRoot, configHome);
  const env = { ...process.env, PATH: `${graderBin}:${process.env.PATH}` };
  const ctx = {
    root,
    result,
    read: (file) => (fs.existsSync(path.join(root, file)) ? fs.readFileSync(path.join(root, file), 'utf8') : null),
    exists: (file) => fs.existsSync(path.join(root, file)),
    run: (cmd, args) => run(cmd, args, { cwd: root, env }),
    openspec: (args) => run('openspec', args, { cwd: root, env }),
    openspecJson: (args) => {
      try {
        return JSON.parse(run('openspec', args, { cwd: root, env }).out.replace(/^[^{]*/, ''));
      } catch {
        return null;
      }
    },
    changedFiles: () =>
      run('git', ['status', '--porcelain', '--untracked-files=all'], { cwd: root })
        .out.split('\n')
        .filter(Boolean)
        .map((line) => line.slice(3).replace(/^"|"$/g, ''))
        .filter((file) => !file.startsWith('.claude/')),
  };
  return scenario.checks(ctx);
}

function summarizeStream(stream) {
  const lines = stream.split('\n').filter(Boolean).map((line) => {
    try {
      return JSON.parse(line);
    } catch {
      return null;
    }
  }).filter(Boolean);
  const final = lines.findLast((event) => event.type === 'result') ?? {};
  const reads = [];
  for (const event of lines) {
    if (event.type !== 'assistant') continue;
    for (const part of event.message?.content ?? []) {
      if (part.type === 'tool_use' && part.name === 'Read') reads.push(part.input?.file_path);
      if (part.type === 'tool_use' && part.name === 'Skill') reads.push(`skill:${part.input?.skill ?? part.input?.command}`);
    }
  }
  const usage = final.usage ?? {};
  return {
    result: final.result ?? '',
    isError: final.is_error ?? true,
    costUsd: final.total_cost_usd ?? null,
    turns: final.num_turns ?? null,
    durationMs: final.duration_ms ?? null,
    inputTokens: (usage.input_tokens ?? 0) + (usage.cache_creation_input_tokens ?? 0) + (usage.cache_read_input_tokens ?? 0),
    outputTokens: usage.output_tokens ?? 0,
    skillFilesRead: reads.filter((file) => file && /(^skill:|skills\/)/.test(file)).map((file) => file.replace(/^.*skills\//, '')),
  };
}

function runOne(scenario, rep) {
  const work = fs.mkdtempSync(path.join(os.tmpdir(), 'todo-lite-'));
  const { root, configHome, env } = makeProject(scenario, work);
  const started = Date.now();
  const agent = spawnSync(
    'claude',
    [
      '-p', scenario.prompt,
      '--model', values.model,
      '--output-format', 'stream-json', '--verbose',
      '--setting-sources', 'project,local',
      // Each run gets a throwaway project in a temp directory, so the agent
      // may run any shell command there; web access stays off.
      '--permission-mode', 'bypassPermissions',
      '--disallowedTools', 'WebFetch', 'WebSearch',
      '--no-session-persistence',
      '--max-budget-usd', '5',
    ],
    { cwd: root, env, encoding: 'utf8', maxBuffer: 256 * 1024 * 1024, timeout: 20 * 60 * 1000 }
  );
  const summary = summarizeStream(agent.stdout ?? '');
  const checks = grade(scenario, root, configHome, summary.result);
  const record = {
    label: values.label,
    model: values.model,
    scenario: scenario.id,
    rep,
    pass: !summary.isError && checks.every((check) => check.pass),
    checks,
    ...summary,
    wallMs: Date.now() - started,
  };
  const base = path.join(outDir, `${scenario.id}-${rep}`);
  fs.writeFileSync(`${base}.json`, JSON.stringify(record, null, 2));
  fs.writeFileSync(`${base}.stream.jsonl`, agent.stdout ?? '');
  fs.rmSync(work, { recursive: true, force: true });
  return record;
}

const selected = values.only ? SCENARIOS.filter((s) => values.only.split(',').includes(s.id)) : SCENARIOS;
const jobs = selected.flatMap((scenario) =>
  Array.from({ length: Number(values.reps) }, (_, i) => ({ scenario, rep: i + 1 }))
);

// Run jobs in a worker pool of child processes so agents work concurrently.
if (process.env.SKILL_EVAL_JOB) {
  const { scenario: id, rep } = JSON.parse(process.env.SKILL_EVAL_JOB);
  const record = runOne(SCENARIOS.find((s) => s.id === id), rep);
  console.log(`${record.pass ? 'PASS' : 'FAIL'} ${values.label} ${id}#${rep} $${record.costUsd?.toFixed(2)} ${record.turns} turns`);
} else {
  const { spawn } = await import('node:child_process');
  const queue = [...jobs];
  const worker = async () => {
    while (queue.length) {
      const job = queue.shift();
      await new Promise((resolve) => {
        const child = spawn(process.execPath, [new URL(import.meta.url).pathname, ...process.argv.slice(2)], {
          env: { ...process.env, SKILL_EVAL_JOB: JSON.stringify({ scenario: job.scenario.id, rep: job.rep }) },
          stdio: 'inherit',
        });
        child.on('exit', resolve);
      });
    }
  };
  await Promise.all(Array.from({ length: Number(values.parallel) }, worker));
}
