import { existsSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import * as path from 'node:path'
import type { DatabaseSync } from 'node:sqlite'
import { Effect } from 'effect'
import { afterEach, expect, it } from 'vitest'
import { Db, DbLive } from '../server/db'

const withDb = <A>(file: string, f: (db: DatabaseSync) => A) =>
  Effect.runPromise(Effect.provide(Effect.map(Db, f), DbLive(file)))

const now = new Date(0).toISOString()
const seed = (db: DatabaseSync) => {
  db.prepare(`INSERT INTO users (id, email, username, password_hash) VALUES (1, 'a@x.io', 'a', 'h')`).run()
  db.prepare(
    `INSERT INTO articles (id, slug, title, description, body, author_id, created_at, updated_at) VALUES (1, 's', 't', 'd', 'b', 1, ?, ?)`,
  ).run(now, now)
}

let dir: string | undefined
afterEach(() => dir && rmSync(dir, { recursive: true, force: true }))

it('creates the data directory, and the schema again on a second boot without losing rows', async () => {
  dir = mkdtempSync(path.join(tmpdir(), 'realworld-db-'))
  const file = path.join(dir, 'data', 'conduit.db')
  await withDb(file, seed)
  expect(existsSync(file)).toBe(true)
  expect(await withDb(file, (db) => db.prepare('SELECT count(*) AS n FROM articles').get())).toEqual({ n: 1 })
})

it('enforces foreign keys', async () => {
  await expect(
    withDb(':memory:', (db) =>
      db
        .prepare(
          `INSERT INTO articles (slug, title, description, body, author_id, created_at, updated_at) VALUES ('s', 't', 'd', 'b', 99, ?, ?)`,
        )
        .run(now, now),
    ),
  ).rejects.toThrow(/FOREIGN KEY/)
})

it('deleting an article deletes its tags, favorites and comments', async () => {
  const left = await withDb(':memory:', (db) => {
    seed(db)
    db.exec(`INSERT INTO tags (id, name) VALUES (1, 'x'); INSERT INTO article_tags VALUES (1, 1);`)
    db.exec(`INSERT INTO favorites VALUES (1, 1)`)
    db.prepare(
      `INSERT INTO comments (article_id, author_id, body, created_at, updated_at) VALUES (1, 1, 'c', ?, ?)`,
    ).run(now, now)
    db.exec('DELETE FROM articles WHERE id = 1')
    return ['article_tags', 'favorites', 'comments'].map(
      (t) => (db.prepare(`SELECT count(*) AS n FROM ${t}`).get() as { n: number }).n,
    )
  })
  expect(left).toEqual([0, 0, 0])
})
