/**
 * apps/showcase/src/domain/errors.ts
 *
 * Expected, modeled failures. Anything else is a defect.
 */
import { Data } from 'effect'

export class TaskNotFound extends Data.TaggedError('TaskNotFound')<{ readonly taskId: string }> {
  get message() {
    return `Unknown task id: ${this.taskId}`
  }
}

export class InvalidInput extends Data.TaggedError('InvalidInput')<{ readonly message: string }> {}

export class SimulatedFailure extends Data.TaggedError('SimulatedFailure')<{ readonly message: string }> {}

export type DomainError = TaskNotFound | InvalidInput | SimulatedFailure
