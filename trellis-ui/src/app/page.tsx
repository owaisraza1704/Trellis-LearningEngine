import App from '@/App'
import { Suspense } from 'react'

export default function Page() {
  return (
    <Suspense fallback={<div className="p-8">Opening Trellis…</div>}>
      <App />
    </Suspense>
  )
}
