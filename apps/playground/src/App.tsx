/**
 * apps/playground/src/App.tsx
 *
 * Main app entry point for Phase 1 playground.
 * Renders the complete API service example demonstrating:
 * - Service tokens
 * - Layer factories
 * - LayerProvider for scoping
 * - useService hook with Suspense
 * - Cleanup on unmount
 */

import React from 'react'
import ApiExample from './api-example'

export default function App() {
  return <ApiExample />
}

