import { describe, expect, it } from 'vitest'
import { layer, module, snapshot, tag, SleekStackError } from '../index'
import { validateProvide } from '../module'
import { coreTag } from '../tag'
import { boot, err } from './helpers'

interface Db { q(): string }
const Db = tag<Db>('Db')
abstract class Users { abstract find(): string }

describe('tag', () => {
  it('tag and abstract-class Tags resolve in a built graph', async () => {
    const App = module({ name: 'App', provide: [layer(Db, { q: () => 'db' }), layer(Users, (db) => ({ find: () => `u:${db.q()}` }), [Db])] })
    const { get } = await boot(App)
    expect(get<Users>(Users).find()).toBe('u:db')
  })

  it.each(['', '  ', 42])('invalid name %j throws InvalidTag', (name) => {
    const e = err(() => tag(name as string))
    expect(e).toBeInstanceOf(SleekStackError)
    expect(e.code).toBe('InvalidTag')
  })

  it('same abstract class twice maps to the same core Tag', () => {
    expect(coreTag(Users)).toBe(coreTag(Users))
  })

  it('distinct same-key Tags in one set -> DuplicateTag (direct and via snapshot); across sets allowed', () => {
    const Db2 = tag<Db>('Db')
    const a = layer(Db, { q: () => '' })
    const b = layer(Users, () => ({ find: () => '' }), [Db2])
    expect(err(() => validateProvide([a, b])).code).toBe('DuplicateTag')
    expect(err(() => snapshot(module({ name: 'App', provide: [a], imports: [module({ name: 'Lib', provide: [b] })] }))).code).toBe('DuplicateTag')
    expect(() => { validateProvide([a]); validateProvide([layer(Db2, { q: () => '' })]) }).not.toThrow()
  })
})
