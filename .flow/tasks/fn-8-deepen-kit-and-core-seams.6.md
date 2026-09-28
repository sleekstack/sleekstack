---
satisfies: [R7]
---
# fn-8-deepen-kit-and-core-seams.6 De-flake the showcase board scope test

## Description
Harden apps/showcase/src/__tests__/board.test.tsx: the test 'opening task detail logs 1 acquire…' timed out on CI waiting for 'write spec' (findByRole default 1 s while the project was still loading). Give async queries explicit timeouts (for example, wait for the project to load first), and check the showcase-kit twin for the same pattern.

Touches: apps/showcase/src/__tests__/board.test.tsx, apps/showcase-kit/src/__tests__/board.test.tsx

## Acceptance
- [ ] The test passes 20 times in a row locally (loop evidence in the done summary).
- [ ] No async findBy* in those files relies on the default 1 s timeout for project loading.


## Done summary
TBD

## Evidence
- Commits:
- Tests:
- PRs:
