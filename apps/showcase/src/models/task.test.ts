import { Effect, Either, ParseResult, Schema } from 'effect'
import { describe, expect, it } from 'vitest'
import { NewTaskDraft, ProjectNames, TaskCommentDraft, TaskModel, type TaskDto } from './task'

const dto: TaskDto = { id: 't1', projectId: 'p1', title: 'Ship it', status: 'in_progress', createdAt: 0 }
const names = new Map([['p1', 'Launch']])
const build = (d: TaskDto) =>
  Effect.runSync(TaskModel.fromDto(d).pipe(Effect.provideService(ProjectNames, { get: (id) => names.get(id) })))

describe('TaskModel.fromDto', () => {
  it('resolves labels and context', () => {
    expect(build(dto)).toEqual({
      id: 't1',
      title: 'Ship it',
      status: 'in_progress',
      statusLabel: 'In progress',
      projectName: 'Launch',
      createdAtIso: '1970-01-01T00:00:00.000Z',
    })
  })
  it('falls back to the id for an unknown project', () => {
    expect(build({ ...dto, projectId: 'zz' }).projectName).toBe('zz')
  })
  it('is pure: same input, same output', () => {
    expect(build(dto)).toEqual(build(dto))
  })
})

const valid = (schema: Schema.Schema<any, any>, v: unknown) => Either.isRight(Schema.decodeUnknownEither(schema)(v))
const messages = (schema: Schema.Schema<any, any>, v: unknown) => {
  const r = Schema.decodeUnknownEither(schema, { errors: 'all' })(v)
  return Either.isLeft(r) ? ParseResult.ArrayFormatter.formatErrorSync(r.left).map((i) => i.message) : []
}

describe('NewTaskDraft', () => {
  const pctx = { projectId: 'p1' }
  it('blank create fails its own schema until filled', () => {
    expect(valid(NewTaskDraft.schema(), NewTaskDraft.create())).toBe(false)
  })
  it('reports the designed message', () => {
    expect(messages(NewTaskDraft.schema(), NewTaskDraft.create())).toEqual(['Please enter a title'])
  })
  it('toDto trims and shapes the wire body', () => {
    expect(Effect.runSync(NewTaskDraft.toDto({ title: '  Write docs ', simulateFailure: true }, pctx))).toEqual({
      projectId: 'p1',
      title: 'Write docs',
      simulateFailure: true,
    })
  })
})

describe('TaskCommentDraft', () => {
  const cctx = { taskId: 't1', authorId: 'u1' }
  it('rejects a blank body and accepts a filled one', () => {
    const schema = TaskCommentDraft.schema()
    expect(valid(schema, TaskCommentDraft.create())).toBe(false)
    expect(valid(schema, { body: ' hi ' })).toBe(true)
  })
  it('toDto carries the context', () => {
    expect(Effect.runSync(TaskCommentDraft.toDto({ body: ' hi ' }, cctx))).toEqual({
      taskId: 't1',
      authorId: 'u1',
      body: 'hi',
    })
  })
})
