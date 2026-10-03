# ADX: Agent Developer Experience, a design brief for SleekStack

Date: 2026-10-03. Scope: what makes a TypeScript framework easy for AI coding agents and humans to read, write and verify, with SleekStack as the case.

## 0. How to read this document

Every claim is tagged:

- **[S]** sourced: a primary source (spec, official docs, first-party post, paper) says it. The URL is inline.
- **[I]** inference: my reasoning from sourced facts or from reading this repo. Not independently verified.
- **[?]** uncertain or contested.

Method caveats, stated plainly:

- Web pages were read through a fetch tool that summarizes with a small model. Short quotes are as returned by that tool; treat them as close paraphrase unless you re-check the URL. Exact numbers (pass rates, percentages) came from the same path.
- Not read directly: the OpenAI SWE-bench Verified post (HTTP 403) and the SWE-Bench+ paper (numbers below come from a search-result excerpt, not the paper body). Both are cited as "reported", not verified.
- Not found: any Effect-TS official `effect.website/llms.txt` (404 at that URL; absence elsewhere is not proven), and no official Effect MCP docs server was confirmed.
- "Agent" evidence is fast-moving and mostly vendor-run. Several results conflict (section 2.3). Nothing here is a settled law.

## 1. Conventions and specs

### 1.1 AGENTS.md

- **[S]** AGENTS.md is "a simple, open format for guiding coding agents", "a README for agents". It is plain Markdown with no mandatory structure; monorepos can nest files and "the closest one takes precedence"; a user's chat prompt overrides file instructions. Stewarded by the Agentic AI Foundation under the Linux Foundation; roughly 25 agents and IDEs listed as supporting it. https://agents.md
- **[S]** Claude Code reads `CLAUDE.md`, not AGENTS.md, but a `CLAUDE.md` can import another file with `@path` syntax. The Next.js docs use exactly this: `CLAUDE.md` containing `@AGENTS.md`. https://code.claude.com/docs/en/best-practices and https://nextjs.org/docs/app/guides/ai-agents
- **[S]** Anthropic's guidance on what goes in: Bash commands the agent cannot guess, style rules that differ from defaults, test runners, repo etiquette, project-specific architecture decisions, environment quirks, non-obvious gotchas. What stays out: anything derivable from reading the code, standard conventions, long API docs ("link to docs instead"), file-by-file descriptions, frequently changing information. Test per line: "Would removing this cause Claude to make mistakes?" If not, cut. https://code.claude.com/docs/en/best-practices
- **[S]** Advisory vs deterministic: "Unlike CLAUDE.md instructions which are advisory, hooks are deterministic." Same source.

### 1.2 llms.txt

- **[S]** Proposed by Jeremy Howard (Sept 2024): a Markdown file at `/llms.txt` with an H1 title, a blockquote summary, and H2 sections of annotated links; plus clean `.md` variants of pages. https://llmstxt.org
- **[S]** Observed adoption, checked by direct HTTP fetch on 2026-10-03 (all returned 200 with the expected H1 structure): Zod `https://zod.dev/llms.txt`, Drizzle `https://orm.drizzle.team/llms.txt` (plus a 3.7 MB `llms-full.txt`), tRPC `https://trpc.io/llms.txt`, Convex `https://docs.convex.dev/llms.txt`, Next.js `https://nextjs.org/docs/llms.txt`, TanStack `https://tanstack.com/llms.txt`, React `https://react.dev/llms.txt`, Prisma `https://www.prisma.io/docs/llms.txt`. The Prisma file opens with "Do not rely on training data for Prisma features" (observed in the fetched file).
- **[?]** llms.txt is a proposal, not an IETF/W3C standard. Whether agents actually consume it is not established by anything I read; Vercel's own eval (below) found passive in-repo context beat on-demand lookup.

### 1.3 Agent Skills (SKILL.md)

- **[S]** Spec at https://agentskills.io/specification: a directory with `SKILL.md` (YAML frontmatter: `name` max 64 chars lowercase-hyphen and matching the directory; `description` max 1024 chars that says "what the skill does and when to use it"), optional `scripts/`, `references/`, `assets/`. Progressive disclosure in three tiers: metadata (~100 tokens, always loaded), body (<5000 tokens recommended, loaded on activation), resources (on demand). Keep `SKILL.md` under 500 lines; references one level deep. A `skills-ref validate` tool exists.
- **[S]** Anthropic's guidance: use CLAUDE.md for what applies broadly, skills "for domain knowledge or workflows that are only relevant sometimes". https://code.claude.com/docs/en/best-practices

### 1.4 MCP

- **[S]** MCP tools (spec 2025-06-18): `name`, `description`, `inputSchema` (JSON Schema), optional `outputSchema`, optional `annotations`; results may carry `structuredContent` conforming to `outputSchema` ("Servers MUST provide structured results that conform"). Two error channels: JSON-RPC protocol errors, and tool-execution errors returned in the result with `isError: true` so the model can see them. Annotations are untrusted unless the server is trusted. https://modelcontextprotocol.io/specification/2025-06-18/server/tools
- **[S]** Real framework example: Next.js 16+ exposes `/_next/mcp` on the dev server; `next-devtools-mcp` surfaces `get_errors`, `get_routes`, `get_page_metadata`, `get_server_action_by_id`, `get_compilation_issues`, `compile_route`. https://nextjs.org/docs/app/guides/mcp
- **[S]** Cost warning: Anthropic says bloated tool sets "create ambiguous decision points" and tools should be "self-contained, robust to error, and extremely clear". https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents

### 1.5 Anthropic on context and tool design

- **[S]** Context is finite: "as the number of tokens in the context window increases, the model's ability to accurately recall information from that context decreases" ("context rot", an "attention budget"). Prefer just-in-time retrieval via lightweight identifiers (paths, links) over pre-loading; progressive disclosure; compaction. https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents
- **[S]** Claude Code docs: "the context window is the most important resource to manage"; "Give Claude a way to verify its work" (tests, build exit code, linter, script diffing against a fixture); without a check "'looks done' is the only signal available". "CLI tools are the most context-efficient way to interact with external services." https://code.claude.com/docs/en/best-practices
- **[S]** Tool design: namespacing; return "only high signal information"; natural-language identifiers instead of UUIDs; pagination/filtering/truncation with sane defaults; error messages that are "specific and actionable" rather than cryptic codes; a `response_format` concise/detailed switch. https://www.anthropic.com/engineering/writing-tools-for-agents
- **[S]** "Poka-yoke your tools": on their SWE-bench agent, models erred with relative paths after changing directory; requiring absolute paths eliminated the errors. Also: agents need "ground truth" from the environment at each step. https://www.anthropic.com/engineering/building-effective-agents
- **[S]** Long-context position effects: performance is often best at the start or end of context and degrades for information in the middle. Liu et al., "Lost in the Middle", TACL 2024. https://arxiv.org/abs/2307.03172
- **[I]** Combined implication for a framework: every token an agent must read to understand your convention is paid from a fixed budget, so the framework should make correct usage inferable from small, local, high-signal artifacts.

## 2. How agents fail on codebases

### 2.1 Interface matters (SWE-agent)

- **[S]** SWE-agent introduces an "agent-computer interface" (ACI) and argues "LM agents represent a new category of end users with their own needs and abilities, and would benefit from specially-built interfaces"; reported 12.5% pass@1 on SWE-bench and 87.7% on HumanEvalFix, "far exceeding" prior non-interactive LMs (2024 numbers; stale as absolute figures). https://arxiv.org/abs/2405.15793
- **[I]** For a framework, the "interface" an agent sees is: file layout, names, error text, CLI output, docs location. These are the ACI of a library.

### 2.2 Benchmarks overstate; verification quality is the bottleneck

- **[S, reported via search excerpt, not read in full]** SWE-Bench+ found 32.67% of "successful" SWE-bench patches had the solution leaked in the issue text and 31.08% passed because of weak tests; filtering dropped SWE-Agent+GPT-4 from 12.47% to 3.97%. https://arxiv.org/abs/2410.06992
- **[S, title only]** OpenAI published "Why SWE-bench Verified no longer measures frontier coding capabilities". I could not fetch the body (403). https://openai.com/index/why-we-no-longer-evaluate-swe-bench-verified/
- **[I]** Takeaway for framework authors: agents pass weak tests with wrong code. A framework whose invariants are checked by a strong, deterministic, whole-program tool (type checker, graph analyzer) is more trustworthy to an agent than one checked by example tests alone.

### 2.3 Context files: contested evidence

| Study | Finding | Caveat |
|---|---|---|
| Vercel, Next.js 16 API evals. https://vercel.com/blog/agents-md-outperforms-skills-in-our-agent-evals | Baseline 53%; skills (default) 53%; skills with explicit instruction 79%; 8KB docs index in AGENTS.md 100%. Skills not invoked in 56% of cases without instruction. Compressing 40KB to 8KB kept 100%. | First-party, Next.js-specific, APIs deliberately absent from training data; small suite. [?] generalization. |
| arXiv 2601.20404 (authors not checked), 10 repos / 124 PRs. https://arxiv.org/abs/2601.20404 | With AGENTS.md: median runtime -28.64%, output tokens -16.58%, completion consistent. | 5-page study; efficiency not correctness. |
| Gloaguen et al., ETH. https://arxiv.org/abs/2602.11988 | Context files "do not generally improve task success", raise inference cost >20%; instructions are followed; repository overviews "are not helpful"; useful for non-standard practices. | LLM-generated and dev-written files both tested; authors urge rigorous evaluation. |

- **[I]** Reconciling these: context files help when they contain information the model cannot derive (version-specific APIs, non-obvious commands, unusual conventions) and hurt or waste tokens when they restate the repo. This matches Anthropic's include/exclude table. Treat any AGENTS.md as a hypothesis to evaluate, not a given.
- **[S]** Vercel's stated mechanisms for passive context winning: no decision friction, always available, no sequencing problem. Same Vercel post. Next.js now ships docs inside the package and says "always-available context outperforms on-demand retrieval". https://nextjs.org/docs/app/guides/ai-agents

### 2.4 Type feedback

- **[S]** Type-constrained decoding "reduces compilation errors by more than half" and improves functional correctness on HumanEval/MBPP, formalized and demonstrated for TypeScript. Mündler et al. https://arxiv.org/abs/2504.09246
- **[I]** This supports "types as a feedback channel": a type error is a precise, cheap, local signal. It does not prove that a more type-heavy API is easier for agents; heavy conditional types produce unreadable errors (see 3.2).

### 2.5 Failure modes, consolidated

Tagged as to whether the root claim is sourced.

1. Stale training data on new APIs. [S] Vercel/Next.js sources above.
2. Context exhaustion and degraded recall on large explorations. [S] Anthropic.
3. Agent stops at "looks done" without a check. [S] Claude Code docs.
4. Hidden conventions not derivable from code. [S] Claude Code docs list them as the main thing worth writing down.
5. Long feedback loops (full build to learn about one error). [S] Next.js added `compile_route` and `get_compilation_issues` so agents need not run `next build` (https://nextjs.org/docs/app/guides/mcp).
6. Ambiguous names and duplicate concepts causing wrong-symbol edits. [I] (not directly measured in any source I read).
7. Implicit magic (reflection, decorators, runtime registries, global state) invisible to static reading. [I]

## 3. Framework traits that help agents (with real examples)

### 3.1 Docs shipped with the package, version-matched

- **[S]** Next.js bundles docs at `node_modules/next/dist/docs/`; `create-next-app` generates `AGENTS.md` and `CLAUDE.md` (`@AGENTS.md`); `next dev` auto-writes a managed block in existing files when an agent is detected (16.3+), idempotently upserted between marker comments, with an opt-out `agentRules: false`. The block's text: "This is NOT the Next.js you know... Read the relevant guide in `node_modules/next/dist/docs/`". Also `.md` suffix and `Accept: text/markdown` for the website, plus `llms.txt` and `llms-full.txt`. https://nextjs.org/docs/app/guides/ai-agents
- **[S]** Earlier versions used a codemod `npx @next/codemod@canary agents-md` to download version-matched docs to `.next-docs/`. Same page.
- **[I]** The pattern worth copying: docs live in the artifact the agent already has, are version-locked, and the pointer to them is one short, machine-managed block.

### 3.2 Errors that tell the agent what to do

- **[S]** Next.js errors list labeled fixes (`[stream]`, `[cache]`, `[block]`), with a `Learn more` URL to a per-error page "written for agents to read", each with canonical patterns, trade-offs and likely gotchas; the same menu prints in `next dev` and `next build` so CI logs carry it. https://nextjs.org/docs/app/guides/ai-agents
- **[S]** Anthropic tool-error guidance (specific, actionable) applies equally. https://www.anthropic.com/engineering/writing-tools-for-agents
- **[I]** Principle: stable error code + located (file:line) + the rule violated + enumerated fixes + doc URL, in both human text and JSON.

### 3.3 Runtime visibility and fast checks

- **[S]** Next.js forwards browser console errors to the terminal, writes server PID/port to `.next/dev/lock` so a second `next dev` reports the existing server, and exposes MCP tools. Same pages.
- **[S]** Effect's own repository AGENTS.md (via `Effect-TS/effect-smol`; read through the summarizing fetch tool, verify at https://raw.githubusercontent.com/Effect-TS/effect-smol/main/AGENTS.md) gives per-change-type validation: lint-fix, targeted test, `pnpm check`; type changes use `pnpm test-types <file>`; `pnpm codegen` after module-structure changes; changesets for API changes; pattern files under `.patterns/` ("prefer `Effect.fnUntraced`", "avoid async/await", "never `Date.now()`, use Clock"). It also states a "Surgical changes / simplicity first" behavior section. [?] I did not confirm the main `Effect-TS/effect` repo has an AGENTS.md (the raw URL returned 404); a third-party index claims `.agents/AGENTS.md` exists there.
- **[I]** Per-change-type verification commands (not "run the tests") are a concrete, cheap ADX win.

### 3.4 Types, schema and "less code to get wrong"

- **[S]** Convex's own stated rationale: queries are pure TypeScript with end-to-end types, "less code to write, and thus less code to get wrong", transactional guarantees. It ships llms.txt, a rules file, AGENTS.md/CLAUDE.md, plugins for Claude Code/Codex/Cursor, an MCP server for the dev deployment, and Agent Skills. https://docs.convex.dev/ai (first-party marketing-adjacent; the effect claim is not measured there).
- **[I]** Zod, tRPC, Drizzle share a trait: one schema/definition is the single source of truth, types are inferred, so an agent edits one place and the type checker reports drift. I did not find first-party evals showing these are better for agents; this is inference.

### 3.5 Codemods and skills for migrations

- **[S]** Next.js ships `@next/codemod` upgrade flows and skills for multi-step adoption (`next-cache-components-adoption`, `next-dev-loop`) as "workflows rather than lookups"; "framework knowledge comes from the bundled docs, not from Skills". https://nextjs.org/docs/app/guides/ai-agents
- **[I]** Division of labour: docs for lookup (always-available), skills for procedures, codemods for mechanical changes (deterministic beats generated).

### 3.6 Traits list, with evidence status

| Trait | Evidence |
|---|---|
| Explicit over implicit | [I] plus README of SleekStack itself; Convex cites explicit typed queries [S] |
| Static types as feedback | [S] Mündler et al.; [S] Anthropic "ground truth"; [?] heavy types hurt readability |
| One canonical way | [I] no direct eval found; Effect AGENTS.md encodes preferred patterns [S] |
| Greppable, unique names | [I] |
| Colocated contracts | [I] |
| Machine-readable errors | [S] MCP `isError`/structured output; Next.js labeled fixes |
| Fast deterministic checks | [S] Claude Code docs; Effect AGENTS.md |
| Codemods | [S] Next.js |
| Introspection endpoint | [S] Next.js `/_next/mcp`, Convex MCP |
| Docs in package | [S] Next.js; [S] eval by Vercel; [?] vendor-run |

## 4. Proposal

### 4.1 ADX principles

1. **Infer-from-local.** A correct edit should be derivable from the file and its imports. If a convention lives elsewhere, it must be enforced by a checker, not remembered. [I]
2. **One canonical form per concept**, with a deprecation path for the others. [I]
3. **Names are unique and greppable.** One symbol name means one thing across the public surface. [I]
4. **Every invariant has a deterministic checker** that exits non-zero, prints `file:line CODE: message`, and offers `--json`. [I, builds on S: Claude Code verify guidance]
5. **Errors carry the fix.** Stable code, location, violated rule, enumerated remedies, doc URL. [S for the pattern: Next.js]
6. **Introspect, do not guess.** A command or MCP tool returns the real graph/routes/config. [S: Next.js MCP]
7. **Docs ship in the package, version-locked, small, and passively pointed to** from a managed AGENTS.md block. [S: Next.js, Vercel eval; [?] generalization]
8. **Tiered context.** Always-on file short (rules not derivable from code); procedures as skills; reference as bundled docs. [S: Anthropic, agentskills.io]
9. **Mechanical changes are codemods**, not prose instructions. [S: Next.js]
10. **Evaluate it.** Maintain a small agent eval (tasks, pass/fail, token cost) and re-run when docs change. [S: Gloaguen et al. urge rigorous evaluation; Vercel built evals]

### 4.2 ADX checklist (per release)

- [ ] Root `AGENTS.md` under ~100 lines; contains only non-derivable rules and exact commands.
- [ ] `CLAUDE.md` is `@AGENTS.md` (one source), plus Claude-only extras.
- [ ] Per-package `AGENTS.md` only where a package has local rules.
- [ ] Bundled docs in the published package; `llms.txt` and `.md` page variants on the site.
- [ ] Check CLI: documented exit codes, `--json`, stable error codes with doc URLs, `--fix` or codemod where the fix is mechanical.
- [ ] Every public symbol has one-line JSDoc stating when to use it.
- [ ] Unique public names; no two exports with the same name from different entry points unless unavoidable.
- [ ] Package-local `test`, `typecheck`, `lint` commands that run in seconds; a "verify this change" table by change type.
- [ ] Agent eval suite checked in with a baseline score and token cost.
- [ ] Skills for multi-step procedures (add a module, add a layer, migrate), each under 500 lines.

### 4.3 ADX scorecard (0 = absent, 1 = partial, 2 = good). Score is my own rubric [I], not a published standard.

| # | Dimension | 0 | 1 | 2 |
|---|---|---|---|---|
| 1 | Always-on agent context | none | exists but long/stale | short, tested, non-derivable only |
| 2 | Docs location | website only | llms.txt | bundled in package and version-matched |
| 3 | Canonical way | many equal ways | preferred way documented | one way, others deprecated/lint-flagged |
| 4 | Name uniqueness | collisions common | few collisions, documented | none in public API |
| 5 | Static checkability | runtime-only errors | partial static checks | whole-model checker, located errors |
| 6 | Error quality | opaque | message only | code+location+fix+URL, JSON too |
| 7 | Feedback speed | full build to verify | targeted tests | per-file check, seconds |
| 8 | Introspection | none | debug logs | CLI/MCP returns real structure |
| 9 | Migrations | prose guide | partial codemod | codemod + skill + docs |
| 10 | Measured | never evaluated | ad hoc | eval suite with baseline |

Max 20. Suggested reading: below 8, agents will mostly rely on training data; 8 to 14, usable with supervision; above 14, unattended work is plausible. These cutoffs are my guess, not measured.

### 4.4 SleekStack today, scored (from reading this repo on 2026-10-03)

Evidence is files read: `CLAUDE.md`, `.claude/CLAUDE.md`, `CONTEXT.md`, `docs/adr/`, `.flow/specs/`, `packages/cli/src/check.ts`, `packages/analyze/src/model.ts`, `packages/core/src/errors.ts`, `packages/kit/src/*`.

| # | Dimension | Score | Evidence in repo |
|---|---|---|---|
| 1 | Always-on context | 1 | `CLAUDE.md` is mostly flow-next tool instructions, not framework rules for consuming apps. No root `AGENTS.md`. `.claude/CLAUDE.md` (project) points to specs/CONTEXT/ADR. This is contributor context, not user-app context. |
| 2 | Docs location | 1 | A Fumadocs site exists (`apps/docs`, ADR 0007), per-package READMEs exist. No `llms.txt`, no docs bundled in package tarballs (`packages/cli/package.json` `files` is `bin`, `src`). [I] I did not check whether the docs app emits `llms.txt`. |
| 3 | Canonical way | 1 | Two public layers by design: core (Effect) and kit (Effect-free facade) (ADR 0001/0004, CONTEXT.md). Defensible, but doubles the surface an agent must choose between. |
| 4 | Name uniqueness | 0 to 1 | `effect` is exported from `packages/kit/src/effect.ts` (side effect with deps) and from `packages/kit/src/next/action.ts` (runs a Kit Operation inline); CONTEXT.md acknowledges: "Not the same as `effect(gen, opts?)` from `@sleekstack/kit/next`". Also `Layer`/`Kit Layer`/`Declared Layer` and Effect's own `Layer`. |
| 5 | Static checkability | 2 | ADR 0011: analyzer validates missing, cyclic, captive, ambiguous, private-Tag, module-cycle, duplicate-module with file:line, via the TypeScript checker, fail-closed. This is the strongest ADX asset in the repo. |
| 6 | Error quality | 1 | Stable codes (`MissingDependency`, `CaptiveDependency`, ...) and `file:line CODE: message` lines; `--json` available (`check.ts`). `AnalyzeError` has only `file`, `line`, `code`, `message`: no `fix`, no doc URL, no column. |
| 7 | Feedback speed | 1 | `turbo run test/typecheck/lint` at root; check CLI exists. [?] I did not time them. |
| 8 | Introspection | 1 to 2 | `sleekstack check --json` emits the graph per root (nodes, edges, lifetimes) and a devtools package exists (fn-11). No MCP server found in the repo (not exhaustively searched). |
| 9 | Migrations | 0 | No codemods found. Many ADRs are "superseded in part" (0001, 0004, 0005, 0006, 0009, 0012), so churn is real; an agent trained on any earlier shape will be wrong. |
| 10 | Measured | 0 | No agent eval found in the repo. |

Total about 8 to 10 of 20 [I].

### 4.5 Recommendations for SleekStack

Ordered by value per effort. Each ties to a finding above.

1. **Add a root `AGENTS.md` for contributors and ship a different one for consumers.** Contributors: exact commands per change type (as Effect's AGENTS.md does), the "verify" table, and the five-line vocabulary rule pointing at `CONTEXT.md`. Move flow-next boilerplate out of the always-on file if it is not needed every session (Anthropic: bloat makes rules get lost). Make `CLAUDE.md` `@AGENTS.md` plus Claude-only extras. [S: Anthropic, agents.md, Next.js pattern]
2. **Ship docs in the packages.** Add a `docs/` (or `llms.md`) folder to `@sleekstack/kit` and each adapter `files` list: a compact (target under 8KB) index of the canonical patterns, the lifetime matrix, and the error codes. Add a managed AGENTS.md block that `sleekstack` can write (`sleekstack init-agents`, idempotent between marker comments, opt-out flag) modeled on Next.js. [S: Next.js, Vercel eval; [?] result may not generalize to a small framework]
3. **Make `sleekstack check` the agent's verifier.**
   - Add `fix` hints and a `docs` URL per error code (for example `CaptiveDependency` lists the three remedies: change lifetime, inject a factory, move the dependency).
   - Add column and end positions to `AnalyzeError`.
   - Document exit codes (already 0/1/2 in code) in AGENTS.md.
   - Provide `--explain <CODE>` that prints the rule and remedies. [S: Next.js error pattern; I: the specific flags]
4. **Expose the graph via MCP.** A small `sleekstack-mcp` with `get_graph`, `get_errors`, `explain_service <tag>`, `list_modules`, reading the same analyzer output as `check --json`. Keep the tool set tiny (Anthropic warns against sprawling tool sets). [S: MCP spec, Next.js MCP, Anthropic tool design; I: the tool names]
5. **Resolve the `effect` name collision.** Rename the `kit/next` inline runner (for example `run`) or the kit side effect (for example `onScope`). One name, one meaning keeps grep results trustworthy. [I]
6. **Shrink the choice surface.** Document core vs kit as "kit for apps, core for library authors", and state in AGENTS.md which one an agent should reach for by default. Lint (or analyzer-flag) mixing in one app. [I]
7. **Write a "current shape" page and a codemod for each superseded ADR that changed user code** (ADR 0005 dependency arrays to generator `yield*`, ADR 0011 amendments). Agents trained on older text will emit the old form; a codemod plus a deprecation error code catches it. [S: Next.js codemods; I: applicability]
8. **Add a small agent eval.** 10 to 20 tasks in `evals/` ("add a request-scoped service with a dependency", "fix this captive dependency", "export a private Tag"), each judged by `sleekstack check` plus typecheck plus tests; record pass rate and tokens with and without the shipped docs. This also tests whether recommendation 2 is worth its cost, since the evidence is mixed. [S: Vercel and Gloaguen et al. disagree; I: the specific tasks]
9. **Keep `CONTEXT.md` as the vocabulary source and mirror its "Avoid" lists into a lint or a docs section.** It already lists banned synonyms (Token, Provider, Container...). [I]
10. **Skills for procedures, not facts.** `add-module`, `migrate-to-generator-layers`, `diagnose-captive-dependency`, each under 500 lines per the spec. Facts go in bundled docs. [S: Next.js "docs for lookup, skills for workflows"; agentskills.io]

### 4.6 What not to do

- Do not paste the architecture or ADR text into the always-on file. Gloaguen et al. found repository overviews unhelpful. [S]
- Do not publish `llms.txt` as the only agent doc and assume it is read. [?]
- Do not add MCP tools that duplicate `check --json`. Anthropic: CLI is the context-efficient default. [S]
- Do not treat the scorecard as validated. [I]

## 5. Open questions

- **Baseline (2026-10-03, `evals/`, sonnet, 11 tasks x 1 run per condition):** with bundled docs 11/11 pass, mean 214.5k tokens, $1.93 total; without 11/11 pass, mean 218.4k tokens, $1.86 total. No measurable gain: the suite hits a ceiling, and kit ships its TypeScript source with JSDoc examples, so an agent without `llms.md` reads `node_modules/@sleekstack/kit/src` and `sleekstack check`'s fix/docs lines instead. Per-task token deltas swing both ways (-50% to +40%) with one run each, so they are noise. Next: harder multi-step tasks, N >= 3 runs, and a condition with the source stripped (published `dist-types` only) before drawing a conclusion. [I]
- Does a small, young framework gain from bundled docs the way Next.js did, when models have little or no training data on it at all? Vercel's suite specifically used APIs absent from training data, which is SleekStack's situation, but the result is first-party and unreplicated. [?]
- Whether Effect-specific idioms (generators, Layers) are well represented in current model training is not established by any source I read. [?]
- Whether `llms.txt` is consumed by coding agents in practice. [?]

## 6. Source index

- AGENTS.md: https://agents.md
- llms.txt proposal: https://llmstxt.org
- Anthropic, context engineering: https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents
- Anthropic, writing tools for agents: https://www.anthropic.com/engineering/writing-tools-for-agents
- Anthropic, building effective agents (ACI appendix): https://www.anthropic.com/engineering/building-effective-agents
- Claude Code best practices: https://code.claude.com/docs/en/best-practices
- Agent Skills spec: https://agentskills.io/specification
- MCP tools spec: https://modelcontextprotocol.io/specification/2025-06-18/server/tools
- Next.js agent guide: https://nextjs.org/docs/app/guides/ai-agents ; MCP guide: https://nextjs.org/docs/app/guides/mcp
- Vercel eval post: https://vercel.com/blog/agents-md-outperforms-skills-in-our-agent-evals
- SWE-agent: https://arxiv.org/abs/2405.15793
- SWE-Bench+: https://arxiv.org/abs/2410.06992 ; OpenAI note: https://openai.com/index/why-we-no-longer-evaluate-swe-bench-verified/
- AGENTS.md studies: https://arxiv.org/abs/2601.20404 and https://arxiv.org/abs/2602.11988
- Type-constrained generation: https://arxiv.org/abs/2504.09246
- Lost in the Middle: https://arxiv.org/abs/2307.03172
- Convex AI docs: https://docs.convex.dev/ai
- Effect (smol) AGENTS.md: https://raw.githubusercontent.com/Effect-TS/effect-smol/main/AGENTS.md
- llms.txt in the wild (fetched): https://zod.dev/llms.txt, https://orm.drizzle.team/llms.txt, https://trpc.io/llms.txt, https://docs.convex.dev/llms.txt, https://nextjs.org/docs/llms.txt, https://tanstack.com/llms.txt, https://react.dev/llms.txt, https://www.prisma.io/docs/llms.txt
