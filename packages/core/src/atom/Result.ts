/**
 * packages/core/src/atom/Result.ts
 *
 * The async state of an Effect or Stream atom, modeled on effect-atom's Result.
 */

import { Cause, Option } from 'effect'

/** No value yet. `waiting` is true while the first load runs. */
export interface Initial<A, E = never> {
  readonly _tag: 'Initial'
  readonly waiting: boolean
  /** @internal phantom */ readonly _A?: A
  /** @internal phantom */ readonly _E?: E
}

/** A value. `waiting` is true while a refresh (or a still-open Stream) runs. */
export interface Success<A, E = never> {
  readonly _tag: 'Success'
  readonly value: A
  readonly waiting: boolean
  /** @internal phantom */ readonly _E?: E
}

/** A failure with its full Cause, keeping the last successful value when there was one. */
export interface Failure<A, E = never> {
  readonly _tag: 'Failure'
  readonly cause: Cause.Cause<E>
  readonly previousValue: Option.Option<A>
  readonly waiting: boolean
}

/** `Initial | Success | Failure`, each carrying a `waiting` flag. */
export type Result<A, E = never> = Initial<A, E> | Success<A, E> | Failure<A, E>

/** Builds an `Initial` result. */
export const initial = <A = never, E = never>(waiting = false): Result<A, E> => ({ _tag: 'Initial', waiting })

/** Builds a `Success` result. */
export const success = <A, E = never>(value: A, options?: { readonly waiting?: boolean }): Result<A, E> => ({
  _tag: 'Success',
  value,
  waiting: options?.waiting ?? false,
})

/** Builds a `Failure` result from a Cause. */
export const failure = <A = never, E = never>(
  cause: Cause.Cause<E>,
  options?: { readonly previousValue?: Option.Option<A>; readonly waiting?: boolean },
): Result<A, E> => ({
  _tag: 'Failure',
  cause,
  previousValue: options?.previousValue ?? Option.none(),
  waiting: options?.waiting ?? false,
})

/** Returns `previous` marked `waiting`, or a waiting `Initial` when there is none. */
export const waitingFrom = <A, E>(previous: Result<A, E> | undefined): Result<A, E> =>
  previous === undefined ? initial(true) : { ...previous, waiting: true }

/** The last successful value: a `Success`'s value or a `Failure`'s `previousValue`. */
export const value = <A, E>(self: Result<A, E>): Option.Option<A> =>
  self._tag === 'Success' ? Option.some(self.value) : self._tag === 'Failure' ? self.previousValue : Option.none()

/** Guard: `Initial`. */
export const isInitial = <A, E>(self: Result<A, E>): self is Initial<A, E> => self._tag === 'Initial'
/** Guard: `Success`. */
export const isSuccess = <A, E>(self: Result<A, E>): self is Success<A, E> => self._tag === 'Success'
/** Guard: `Failure`. */
export const isFailure = <A, E>(self: Result<A, E>): self is Failure<A, E> => self._tag === 'Failure'
/** True while the result is loading or refreshing. */
export const isWaiting = <A, E>(self: Result<A, E>): boolean => self.waiting

/** Folds a result by its tag. */
export const match = <A, E, X, Y, Z>(
  self: Result<A, E>,
  cases: {
    readonly onInitial: (result: Initial<A, E>) => X
    readonly onSuccess: (result: Success<A, E>) => Y
    readonly onFailure: (result: Failure<A, E>) => Z
  },
): X | Y | Z =>
  self._tag === 'Initial' ? cases.onInitial(self) : self._tag === 'Success' ? cases.onSuccess(self) : cases.onFailure(self)
