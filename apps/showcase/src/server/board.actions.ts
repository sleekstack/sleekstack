'use server'
/**
 * apps/showcase/src/server/board.actions.ts
 *
 * The board's mutating Server Actions (R5): each is one application of `act` to a Board use case.
 */
import { Board } from '../application/board'
import type { AddComment, CreateTask, MoveTask } from '../domain/inputs'
import { act } from './act.server'

export type { ActionResult } from './act.server'
export type CreateTaskInput = CreateTask
export type MoveTaskInput = MoveTask
export type AddCommentInput = AddComment

export async function createTask(input: CreateTaskInput) { return act(Board.createTask)(input) }

export async function moveTask(input: MoveTaskInput) { return act(Board.moveTask)(input) }

export async function addComment(input: AddCommentInput) { return act(Board.addComment)(input) }
