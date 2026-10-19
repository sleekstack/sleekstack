import { Context, Effect, Layer } from 'effect'
import { declareLayer, module } from '@sleekstack/core'

class Pool extends Context.Tag('Pool')<Pool, { size: number }>() {}
class Users extends Context.Tag('Users')<Users, { count(): number }>() {}

// Only Users is exported; Pool is private to 'users'. Its own entries may require it,
// anything outside gets PrivateDependency.
export const UsersModule = module({
  name: 'users',
  entries: [
    declareLayer(Layer.succeed(Pool, { size: 4 })),
    declareLayer(
      Layer.effect(
        Users,
        Effect.map(Pool, (pool) => ({ count: () => pool.size })),
      ),
    ),
  ],
  exports: [Users],
})

export const AppModule = module({ name: 'app', imports: [UsersModule] })
