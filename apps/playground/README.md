# SleekStack Phase 1 Playground — Complete API Example

A runnable demonstration of the SleekStack Phase 1 runtime architecture using a UserAPI service.

## What This Example Shows

This playground demonstrates the complete Phase 1 API:

- **Service Token** (`UserApiToken`): Uniquely identifies a service in the runtime environment
- **Layer Factory** (`UserApiLayer`): Constructs and manages the service lifecycle, including cleanup
- **LayerProvider** (React component): Owns a scope and provides layers to a subtree
- **useService Hook**: Accesses a service within a provider's subtree; integrates with Suspense
- **Error Handling**: ErrorBoundary catches service construction failures
- **Deterministic Cleanup**: Layer finalizers run when the provider unmounts

## Architecture

```
┌─────────────────────────────────────────────┐
│          App.tsx (entry point)              │
│         (renders ApiExample)                │
└─────────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────┐
│          LayerProvider                      │
│        layers={[UserApiLayer]}              │
│                                             │
│  ┌───────────────────────────────────────┐  │
│  │    ErrorBoundary                      │  │
│  │                                       │  │
│  │  ┌─────────────────────────────────┐  │  │
│  │  │  Suspense                       │  │  │
│  │  │  fallback="Loading..."          │  │  │
│  │  │                                 │  │  │
│  │  │  ┌───────────────────────────┐  │  │  │
│  │  │  │  UserDetail Component     │  │  │  │
│  │  │  │  useService(UserApiToken) │  │  │  │
│  │  │  └───────────────────────────┘  │  │  │
│  │  │                                 │  │  │
│  │  │  ┌───────────────────────────┐  │  │  │
│  │  │  │  UsersList Component      │  │  │  │
│  │  │  │  useService(UserApiToken) │  │  │  │
│  │  │  └───────────────────────────┘  │  │  │
│  │  └─────────────────────────────────┘  │  │
│  └───────────────────────────────────────┘  │
│                                             │
│  Resources acquired here are cleaned       │
│  up deterministically when unmount         │
└─────────────────────────────────────────────┘
```

## Code Structure

### 1. Service Definition (api-example.tsx)

```typescript
// Step 1: Define service interface
interface UserApiService {
  getUser(id: string): Promise<User>
  getAllUsers(): Promise<User[]>
  close(): void
}

// Step 2: Create service token (unique identifier)
const UserApiToken = createToken<UserApiService>('UserAPI')
```

### 2. Layer Factory (api-example.tsx)

```typescript
// Step 3: Define layer that constructs and manages the service
const UserApiLayer = layer(UserApiToken, async () => {
  // Async initialization (e.g., establishing connection)
  await initializeConnection()
  
  // Create the service instance
  const service = createUserApiService()
  
  // Return value + cleanup finalizer
  return {
    value: service,
    cleanup: () => {
      service.close()  // Called when provider unmounts
    }
  }
})
```

### 3. React Integration (api-example.tsx)

```typescript
// Step 4: Use LayerProvider to scope the layer
<LayerProvider layers={[UserApiLayer]}>
  <Suspense fallback={<div>Loading service...</div>}>
    {/* Components here can use useService(UserApiToken) */}
  </Suspense>
</LayerProvider>

// Step 5: Access service in components
function UserComponent() {
  const userApi = useService(UserApiToken)
  // userApi is UserApiService instance (or Suspense suspends)
}
```

## Running the Playground

### Prerequisites

- Node.js 22+
- pnpm 10+

### Setup

From the workspace root:

```bash
# Install all dependencies
pnpm install

# Install React + Vite if not already installed
pnpm add -w react react-dom
pnpm add -w -D vite @vitejs/plugin-react
```

### Start Dev Server

```bash
# From workspace root
pnpm --filter ./apps/playground dev

# OR from the playground directory
cd apps/playground
pnpm dev
```

Open `http://localhost:5173` in your browser.

## Expected Behavior

1. **Splash screen**: "Initializing UserAPI service..." (Suspense fallback)
2. **Initialization logs** (check browser console):
   ```
   [UserAPILayer] Initializing UserAPI service
   (300ms delay simulating connection setup)
   [UserDetailComponent] Fetching user 1
   (500ms delay simulating API call)
   ```
3. **Rendered content**:
   - Single user detail card
   - List of all users
   - Explanation of how the system works
4. **Cleanup** (when you unmount or reload):
   ```
   [UserAPIService] Closing connection
   [UserAPILayer] UserAPI service cleaned up
   ```

## Key Concepts Demonstrated

### Lazy Construction

- The UserAPI service is not created until a component calls `useService(UserApiToken)`
- Multiple components share the same instance (single-flight)

### Suspense Integration

- While the service is initializing, `useService` throws a Promise
- React catches and suspends the component tree, showing the Suspense fallback
- On resolution, the component re-renders with the service value

### Deterministic Cleanup

- When the `LayerProvider` unmounts, all cleanup finalizers run deterministically
- This ensures no resource leaks (connections, subscriptions, etc.)

### Error Boundaries

- If service construction fails, the error is caught and displayed
- Developers can wrap providers in `<ErrorBoundary>` for graceful error handling

### Dependency Injection

- Services are provided via tokens, not singletons or globals
- Each provider scope has its own instances
- Parent/child providers can override services independently

## Common Patterns

### Multiple Services

```typescript
const DatabaseToken = createToken<DatabaseService>('Database')
const CacheToken = createToken<CacheService>('Cache')

const DatabaseLayer = layer(DatabaseToken, async () => { /* ... */ })
const CacheLayer = layer(CacheToken, async () => { /* ... */ })

<LayerProvider layers={[DatabaseLayer, CacheLayer]}>
  {/* components can use useService(DatabaseToken) or useService(CacheToken) */}
</LayerProvider>
```

### Service Dependencies

```typescript
const AuthLayer = layer(AuthToken, async (env) => {
  // Request another service from the same provider
  const database = await env.get(DatabaseToken)
  
  const service = createAuthService(database)
  return { value: service, cleanup: () => service.shutdown() }
})
```

### Testing with Overrides

```typescript
const mockUserApi = { /* mock implementation */ }
const MockUserApiLayer = layer(UserApiToken, () => ({ value: mockUserApi }))

<LayerProvider 
  layers={[UserApiLayer]}
  overrides={new Map([[UserApiToken, MockUserApiLayer]])}
>
  {/* components now get mockUserApi */}
</LayerProvider>
```

## Architecture Notes

This example uses a minimal prototype implementation to validate semantics. Future iterations will:

- Switch to Effect TS (`effect` package) for structured concurrency and cancellation
- Add devtools hooks for observing service lifecycle and dependency graphs
- Support generalized request-scoped environments in Next.js
- Add automatic type inference for dependency graphs

## Files

- `src/App.tsx` — Entry point
- `src/api-example.tsx` — Main example (service token, layer, components)
- `src/main.tsx` — Vite bootstrap
- `index.html` — HTML template

## Questions?

Refer to:
- `/packages/react/DESIGN.md` — Behavioral contracts and architecture notes
- `/packages/react/src/types.d.ts` — Full TypeScript interfaces (Token, Layer, LayerProvider, useService, etc.)
- `/packages/core/src/types.d.ts` — Core types (Token, LayerFactory, EnvProxy, etc.)
