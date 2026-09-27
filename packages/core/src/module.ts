/**
 * packages/core/src/module.ts
 *
 * module() and declareLayer(). module() validates only its own structure;
 * everything needing the whole graph (cycles, duplicate names, deps) lives in buildGraph.
 */

import { Context, Layer } from 'effect'
import type { AnyServiceDefinition, Lifetime } from './service'
import { InvalidModule } from './errors'

type AnyTag = Context.Tag<any, any>

/** A raw Layer wrapped with the Tags it provides/requires: a full graph node. */
export interface DeclaredLayer {
  readonly _tag: 'DeclaredLayer'
  readonly layer: Layer.Layer<any, any, any>
  readonly provides: readonly AnyTag[]
  readonly requires: readonly AnyTag[]
  readonly lifetime?: Lifetime
}

/** Bare raw Layers must be self-contained (requirement type `never`). */
export type BareLayer = Layer.Layer<any, any, never>

export type Entry = AnyServiceDefinition | DeclaredLayer | BareLayer

export type Imports = readonly Module[] | (() => readonly Module[])

export interface Module {
  readonly _tag: 'Module'
  readonly name: string
  readonly entries: readonly Entry[]
  readonly imports: Imports
  readonly exports: readonly AnyTag[]
  readonly lifetime?: Lifetime
}

export function declareLayer<ROut, E, RIn>(
  layer: Layer.Layer<ROut, E, RIn>,
  options: { readonly provides: readonly AnyTag[]; readonly requires?: readonly AnyTag[]; readonly lifetime?: Lifetime },
): DeclaredLayer {
  if (!Layer.isLayer(layer)) throw new InvalidModule({ message: 'declareLayer(): expected an Effect Layer' })
  if (!options.provides?.length) {
    throw new InvalidModule({ message: 'declareLayer(): `provides` must list at least one Tag' })
  }
  return {
    _tag: 'DeclaredLayer',
    layer,
    provides: options.provides,
    requires: options.requires ?? [],
    ...(options.lifetime && { lifetime: options.lifetime }),
  }
}

const isTagged = (x: unknown, tag: string): boolean =>
  typeof x === 'object' && x !== null && (x as { _tag?: unknown })._tag === tag

export const isModule = (x: unknown): x is Module => isTagged(x, 'Module')
export const isDeclaredLayer = (x: unknown): x is DeclaredLayer => isTagged(x, 'DeclaredLayer')
export const isServiceDefinition = (x: unknown): x is AnyServiceDefinition => isTagged(x, 'ServiceDefinition')

export function module(config: {
  readonly name: string
  readonly entries?: readonly Entry[]
  readonly imports?: Imports
  readonly exports?: readonly AnyTag[]
  readonly lifetime?: Lifetime
}): Module {
  const { name } = config
  if (typeof name !== 'string' || name.trim().length === 0) {
    throw new InvalidModule({ message: `module(): 'name' must be a non-empty string, got: ${JSON.stringify(name)}` })
  }
  const entries = config.entries ?? []
  entries.forEach((e, i) => {
    if (!isServiceDefinition(e) && !isDeclaredLayer(e) && !Layer.isLayer(e)) {
      throw new InvalidModule({
        name,
        message: `module("${name}"): entry ${i} is not a service definition, declared Layer, or Layer`,
      })
    }
  })
  const imports = config.imports ?? []
  if (typeof imports !== 'function' && !Array.isArray(imports)) {
    throw new InvalidModule({ name, message: `module("${name}"): 'imports' must be an array or a thunk` })
  }
  return {
    _tag: 'Module',
    name,
    entries,
    imports,
    exports: config.exports ?? [],
    ...(config.lifetime && { lifetime: config.lifetime }),
  }
}
