import { Controller, type Gen } from '@sleekstack/start'
import { Effect, type Schema } from 'effect'
import type { Name } from '../../../src/schemas'
import { Viewer } from '../../../src/viewer'

export const bodyLimit = 32

/** Declares the viewer, which the directory `wrap` provides per request. */
export default class Users extends Controller({ viewer: Viewer }) {
  *GET(input: { readonly params: { readonly id: number } }): Gen<{ readonly id: number; readonly by: string }> {
    return { id: input.params.id, by: this.viewer }
  }

  *PUT(input: {
    readonly params: { readonly id: number }
    readonly body: { readonly name: Schema.Schema.Type<typeof Name> }
  }): Gen<string> {
    return `${this.viewer} names ${input.params.id} ${input.body.name}`
  }

  *DELETE(_input: { readonly params: { readonly id: number } }): Gen<string> {
    return yield* Effect.die('boom')
  }
}
