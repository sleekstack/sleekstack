---
satisfies: [R7]
---
# fn-20-adx-agent-developer-experience.6 evals: agent task suite, runner and baseline with/without bundled docs

## Description
Measure whether the shipped docs pay off. Manual runner, not CI.

**Size:** M
**Files:** evals/ (new: tasks, runner, README), docs/research/adx-agent-developer-experience.md (record result)
**Touches:** [evals/**, docs/research/adx-agent-developer-experience.md]

### Approach
- 10+ tasks (e.g. add a request-scoped service with a dependency, fix a captive dependency, export a private Tag); each judged by `sleekstack check`, typecheck and tests exit codes; a judge that cannot run reports unjudged.
- N runs per task; "without docs" via fixture install with `llms.md` removed.
- Record pass rate and tokens; write the outcome into the brief's section 5 open questions.
- Read brief section 2.3 for why results conflict.

## Acceptance
- [ ] at least 10 tasks, runner and README
- [ ] baseline with and without docs recorded
- [ ] result written into the brief

## Done summary
TBD

## Evidence
- Commits:
- Tests:
- PRs:
