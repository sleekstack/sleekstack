---
satisfies: [R8]
---
# fn-18-resumable-rendering-spike-for.5 docs: ADR 0017, CONTEXT terms and Analyzer code listing

Touches: [docs/adr/0017-resumable-host-first-components.md, docs/adr/README.md, CONTEXT.md, packages/analyze/README.md]

## Description
Record the spike's answer (R8): ADR 0017, the new vocabulary, and the new Analyzer code in the places that list the codes. Finalization is one task by design.

**Size:** S
**Files:** `docs/adr/0017-resumable-host-first-components.md` (new), `docs/adr/README.md`, `CONTEXT.md`, `packages/analyze/README.md`.
**Touches:** [docs/adr/0017-resumable-host-first-components.md, docs/adr/README.md, CONTEXT.md, packages/analyze/README.md]

### Approach
- ADR format follows `docs/adr/0010-islands-over-resumability.md` and `docs/adr/0015-host-first-component-framework.md` (title, status Proposed, considered options, consequences). Reference 0010 (which this re-opens) and 0015. Index row format in `docs/adr/README.md`; 0016 is reserved by fn-17, so use 0017.
- Record: the question, the chosen design, the measured gzipped size from task 4, the known gaps (no replay of pre-resume events, guests not resumable, `mount` renders `Bind` statically), the deliberate divergence from fn-17's decode policy, and a yes/no answer with next steps.
- `CONTEXT.md`: add Handler, Resume and Manifest in the existing term format with an `_Avoid_:` line (terms near Component :116, Host :121, Guest :124-126); add `NonResumableHandler` to the component-pass code list at :65. `packages/analyze/README.md:32-36`: add the code bullet.

### Investigation targets
**Required** (read before coding):
- `docs/adr/0010-islands-over-resumability.md` and `docs/adr/0015-host-first-component-framework.md` — ADR shape and what is re-opened
- `CONTEXT.md:60-130` — term format, the code list and ui terms
- `docs/adr/README.md` — index row format

### Acceptance
- [ ] ADR 0017 exists with the measured number and the yes/no answer, and the index has its row
- [ ] CONTEXT.md has Handler, Resume, Manifest (each with `_Avoid_`) and lists `NonResumableHandler`; the Analyzer README lists it
- [ ] `pnpm --filter docs test` passes

## Acceptance
- [ ] TBD

## Done summary
Added ADR 0017 (resumable host-first components: design, measured size 78,633 B gzip entry dominated by Effect / 183 B gzip handler chunk, decode-policy divergence, known gaps, yes-as-spike answer, next steps) with its index row; CONTEXT.md gains Handler, Resume, Manifest (each with _Avoid_) and lists NonResumableHandler; packages/analyze/README.md lists NonResumableHandler. Not done (outside Touches): UnsupportedAtom / NonResumableHandler in the apps/docs errors page — a follow-up.

Tier: implementer opus at medium
stage: impl-review - ran (codex fan-out NEEDS_WORK -> 2 wording fixes -> SHIP)
## Evidence
- Commits: 7ed079b94747f8617aff0c4573e947abc551b95c, 4e8aafa655fa2b07442d95a7199ac05adf1f80f5
- Tests: pnpm --filter docs test
- PRs: