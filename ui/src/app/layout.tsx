import type { Metadata } from 'next'
import type { ReactNode } from 'react'

import '../index.css'

export const metadata: Metadata = {
  title: 'Trellis - AI-Powered Learning Engine',
  description: 'A structured, context-preserving and persistent learning environment.',
}

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
