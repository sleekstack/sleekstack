import type { ReactNode } from 'react'
import Link from 'next/link'

export const metadata = {
  title: 'SleekStack Showcase',
  description: 'Team Task Board — every SleekStack feature exercised in real code.',
}

export default function RootLayout({ children }: { readonly children: ReactNode }) {
  return (
    <html lang="en">
      <body style={{ fontFamily: 'system-ui, sans-serif', margin: 0, padding: '1.5rem' }}>
        <nav style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem' }}>
          <Link href="/">Board</Link>
          <Link href="/log">Log</Link>
          <Link href="/graph">Graph</Link>
          <Link href="/errors">Errors</Link>
        </nav>
        {children}
      </body>
    </html>
  )
}
