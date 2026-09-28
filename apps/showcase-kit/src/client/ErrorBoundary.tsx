'use client'
/**
 * apps/showcase-kit/src/client/ErrorBoundary.tsx
 *
 * R7: catches a failing component-scope acquisition (the "break detail"
 * control's `makeBrokenDraftEditorLayer`) for its own subtree only, so a
 * sibling project or task list stays mounted. Pattern:
 * apps/playground/src/api-example.tsx:139-150.
 */
import React from 'react'

interface ErrorBoundaryState {
  readonly error: Error | null
}

export class ErrorBoundary extends React.Component<{ readonly children: React.ReactNode }, ErrorBoundaryState> {
  constructor(props: { readonly children: React.ReactNode }) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error }
  }

  render() {
    if (this.state.error) {
      return (
        <div role="alert" style={{ border: '2px solid #c00', borderRadius: 4, padding: '12px', margin: '8px 0' }}>
          <strong>Error loading task detail</strong>
          <p>{this.state.error.message}</p>
        </div>
      )
    }
    return this.props.children
  }
}
