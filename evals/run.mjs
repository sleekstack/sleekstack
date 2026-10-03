#!/usr/bin/env node
// Agent eval runner (manual, not CI). See README.md.
//   node evals/run.mjs --selfcheck                      judges only: base fixture passes, every task starts failing
//   node evals/run.mjs [--runs N] [--model M] [--tasks a,b] [--conditions with,without]
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const repo = path.dirname(here)
const kit = path.join(repo, 'packages/kit')
const cli = path.join(repo, 'packages/cli/bin/cli.js')
const tsc = path.join(kit, 'node_modules/typescript/bin/tsc')
const tasks = JSON.parse(fs.readFileSync(path.join(here, 'tasks.json'), 'utf8'))

const arg = (k, d) => { const i = process.argv.indexOf(`--${k}`); return i < 0 ? d : process.argv[i + 1] }
const runs = Number(arg('runs', '1'))
const model = arg('model', 'sonnet')
const only = arg('tasks')?.split(',')
const conditions = arg('conditions', 'with,without').split(',')

/** A fresh app: the fixture, the task's starting files, and @sleekstack/kit (with or without llms.md). */
function workdir(task, withDocs) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), `ss-eval-${task.id}-`))
  fs.cpSync(path.join(here, 'fixture'), dir, { recursive: true })
  for (const [f, body] of Object.entries(task.files ?? {})) fs.writeFileSync(path.join(dir, f), body)
  const pkg = path.join(dir, 'node_modules/@sleekstack/kit')
  fs.mkdirSync(pkg, { recursive: true })
  // Symlink kit's entries one by one, so "without" can drop llms.md; kit's own deps resolve through the real path.
  for (const e of fs.readdirSync(kit)) if (withDocs || e !== 'llms.md') fs.symlinkSync(path.join(kit, e), path.join(pkg, e))
  fs.mkdirSync(path.join(dir, 'node_modules/.bin'))
  fs.writeFileSync(path.join(dir, 'node_modules/.bin/sleekstack'), `#!/bin/sh\nexec node ${JSON.stringify(cli)} "$@"\n`, { mode: 0o755 })
  if (withDocs) spawnSync('node', [cli, 'init-agents'], { cwd: dir })
  return dir
}

/** pass | fail | unjudged, from sleekstack check, tsc and the task's file patterns. */
function judge(task, dir) {
  const notes = []
  const check = spawnSync('node', [cli, 'check'], { cwd: dir, encoding: 'utf8' })
  const types = spawnSync('node', [tsc, '-p', 'tsconfig.json'], { cwd: dir, encoding: 'utf8' })
  if (check.error || types.error || check.status === null || types.status === null) return { verdict: 'unjudged', notes: [String(check.error ?? types.error ?? 'killed')] }
  if (check.status !== 0) notes.push(`check exit ${check.status}: ${check.stderr.trim().split('\n').slice(0, 3).join(' | ')}`)
  if (types.status !== 0) notes.push(`tsc: ${types.stdout.trim().split('\n')[0]}`)
  const read = (f) => { try { return fs.readFileSync(path.join(dir, f), 'utf8') } catch { return '' } }
  for (const [f, res] of Object.entries(task.match ?? {})) for (const re of res) if (!new RegExp(re).test(read(f))) notes.push(`${f} lacks /${re}/`)
  for (const [f, res] of Object.entries(task.forbid ?? {})) for (const re of res) if (new RegExp(re).test(read(f))) notes.push(`${f} has /${re}/`)
  return { verdict: notes.length ? 'fail' : 'pass', notes }
}

if (process.argv.includes('--selfcheck')) {
  let bad = 0
  const base = judge({}, workdir({ id: 'base' }, true))
  if (base.verdict !== 'pass') (bad++, console.log('base fixture must pass:', base.notes))
  for (const t of tasks) {
    const j = judge(t, workdir(t, true))
    if (j.verdict !== 'fail') (bad++, console.log(`${t.id}: must fail before the agent runs, got ${j.verdict}`))
    else console.log(`${t.id}: fails as expected (${j.notes[0]})`)
  }
  console.log(bad ? `${bad} problem(s)` : `ok: ${tasks.length} tasks`)
  process.exit(bad ? 1 : 0)
}

const results = []
for (const t of tasks.filter((t) => !only || only.includes(t.id))) {
  for (const cond of conditions) {
    for (let n = 0; n < runs; n++) {
      const dir = workdir(t, cond === 'with')
      const a = spawnSync('claude', ['-p', t.prompt, '--output-format', 'json', '--model', model, '--dangerously-skip-permissions'], { cwd: dir, encoding: 'utf8', timeout: 600_000 })
      let out = {}
      try { out = JSON.parse(a.stdout) } catch {}
      const u = out.usage ?? {}
      const tokens = (u.input_tokens ?? 0) + (u.output_tokens ?? 0) + (u.cache_read_input_tokens ?? 0) + (u.cache_creation_input_tokens ?? 0)
      const r = { task: t.id, cond, run: n, ...judge(t, dir), tokens, cost: out.total_cost_usd ?? null, turns: out.num_turns ?? null }
      results.push(r)
      console.log(`${t.id} [${cond}] #${n}: ${r.verdict} tokens=${tokens}${r.notes.length ? ' — ' + r.notes.join('; ') : ''}`)
      fs.rmSync(dir, { recursive: true, force: true })
    }
  }
}
const summary = Object.fromEntries(conditions.map((c) => {
  const rs = results.filter((r) => r.cond === c)
  const judged = rs.filter((r) => r.verdict !== 'unjudged')
  return [c, { runs: rs.length, pass: judged.filter((r) => r.verdict === 'pass').length, judged: judged.length, meanTokens: Math.round(rs.reduce((s, r) => s + r.tokens, 0) / (rs.length || 1)), cost: rs.reduce((s, r) => s + (r.cost ?? 0), 0) }]
}))
console.table(summary)
fs.mkdirSync(path.join(here, 'results'), { recursive: true })
fs.writeFileSync(path.join(here, 'results', `${new Date().toISOString().slice(0, 10)}-${model}.json`), JSON.stringify({ model, runs, summary, results }, null, 2) + '\n')
