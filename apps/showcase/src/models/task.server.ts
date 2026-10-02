/**
 * apps/showcase/src/models/task.server.ts
 *
 * Each Model's `fromDto` asks for `ProjectNames` from the
 * environment; `ProjectNamesLive` builds that lookup once from `BoardStore` and is provided once per load,
 * so N tasks share one read.
 */
import 'server-only'
import { Effect, Layer } from 'effect'
import { BoardStore } from '../domain/tags'
import { ProjectNames } from './task'

export const ProjectNamesLive = Layer.effect(
  ProjectNames,
  Effect.gen(function* () {
    const store = yield* BoardStore
    const names = new Map((yield* store.projects()).map((p) => [p.id, p.name]))
    return { get: (id: string) => names.get(id) }
  }),
)
