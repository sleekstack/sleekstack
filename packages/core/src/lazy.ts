/**
 * packages/core/src/lazy.ts
 *
 * The Resolver: how a generator layer's `yield*`ed Tag is looked up while its scope builds.
 */

import { Context, type Effect } from 'effect'

/** Resolves a Tag for the node being built: from the services built so far in this scope and its parents. */
export type Resolve = (tag: Context.Tag<any, any>) => Effect.Effect<unknown, unknown>

/** @internal Provided while a scope builds a node, so generator layers can resolve their `yield*`s. */
export const Resolver = Context.GenericTag<Resolve>('@sleekstack/core/Resolver')
