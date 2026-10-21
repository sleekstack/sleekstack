import { Data } from 'effect'

export class Point {
  constructor(readonly x: number) {}
}
export class Plain extends Data.Error<{ readonly why: string }> {}
