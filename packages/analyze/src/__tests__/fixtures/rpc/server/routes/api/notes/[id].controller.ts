import { Controller, type Gen } from '@sleekstack/start'
import { Effect } from 'effect'

/** A class Controller the Manifest wraps. */
export default class extends Controller() {
  *GET(input: { readonly params: { readonly id: number } }): Gen<string> {
    return yield* Effect.succeed(String(input.params.id))
  }
}
