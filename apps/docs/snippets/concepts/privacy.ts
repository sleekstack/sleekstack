import { layer, module, tag } from '@sleekstack/kit'

interface Pool {
  size: number
}
interface Users {
  count(): number
}
const Pool = tag<Pool>('Pool')
const Users = tag<Users>('Users')

// Only Users is exported; Pool is private to 'users'. Its own entries may require it,
// anything outside gets PrivateDependency.
export const UsersModule = module({
  name: 'users',
  provide: [layer(Pool, { size: 4 }), layer(Users, (pool) => ({ count: () => pool.size }), [Pool])],
  exports: [Users],
})

export const AppModule = module({ name: 'app', imports: [UsersModule] })
