/**
 * apps/showcase/src/delivery/board.server.ts
 *
 * The board read for pages: runs the application's `loadBoard` through `runApp`.
 */
import 'server-only'
import { loadBoard as loadBoardView } from '../application/board-view'
import { runApp } from './runtime.server'

export const loadBoard = () => runApp(loadBoardView)
