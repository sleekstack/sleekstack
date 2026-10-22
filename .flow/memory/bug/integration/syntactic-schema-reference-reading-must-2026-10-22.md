---
title: "Syntactic Schema-reference reading must check each use, not each AST node"
date: "2026-10-22"
track: bug
category: integration
module: packages/analyze/src/typeSchema.ts
tags: [analyzer, schema, typescript, aliases]
problem_type: integration
symptoms: second alias use inside a generic wrapper silently printed structurally; Schema.Never rejected
root_cause: consumed-set keyed by shared alias AST nodes; Schema check from decoded-type flags
resolution_type: fix
related_to: [bug/integration/all-optional-structural-page-type-2026-10-19, bug/integration/analyzer-framework-tags-and-control-2026-10-17, bug/integration/analyzer-must-nest-file-route-pages-2026-10-21, bug/integration/analyzer-reads-every-file-route-through-2026-10-20, bug/integration/new-ui-component-factory-needs-analyzer-2026-10-09, bug/integration/removing-a-facade-must-keep-reading-its-2026-10-17, bug/integration/sleekstack-check-cannot-read-router-2026-10-15]
---

## Problem
The analyzer reads `Schema.Schema.Type<typeof X>` from the signature's text, because the resolved type no longer names `X`. The first version tracked which reference nodes it had read in one set per method, then reported any it had never reached. A same-file alias used twice (`{ direct: Body; wrapped: Wrap<Body> }`) marked the alias's one reference node as read on the first use. The second use, inside a generic wrapper, was then printed as its structural type with no diagnostic, so the Schema constraint (for example `NonEmptyString`) was dropped. Generic alias bodies (`type Box<T> = { value: Ref; extra: T }`) were not searched at all. The same review found two more defects. "Is X a Schema" was judged from the decoded type's flags, which rejected `Schema.Unknown` and `Schema.Never`. The `any` check walked arrow-function bodies.

## What Didn't Work
A global consumed-set plus an end-of-method "unread reference" check. A syntax node is shared by every use of its alias, so node identity cannot stand for a use.

## Solution
`packages/analyze/src/typeSchema.ts` `convert` checks each use where it happens. A written type node that holds a reference (searched through every same-file alias, generic ones included) is followed structurally: a union node member by member, an array node by its element, an object literal by its property declarations. Any other form throws `Unreadable` at that node. A mapped or instantiated (transient) property whose original declaration holds a reference is refused. For the Schema check, the value's type must be assignable to `Schema.Schema.All`, not `Any`, because invariance keeps `never` out of `Any`. `serverServices.ts` `writesAny` reads only the type parameters, parameter types and return type.

## Prevention
A syntactic reader over a type must make its decision per use (per conversion path), never per AST node, because aliases share nodes. Test each reference form twice in one signature: once in a supported position and once in an unsupported one. Test the type-level Schema check with the degenerate Schemas (`Unknown`, `Never`).
