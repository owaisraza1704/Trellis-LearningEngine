import { ChevronRight } from 'lucide-react'
import type { Navigate, PathSummary, Screen } from '../lib/api'

export default function JourneyNavigation({
  journey,
  screen,
  onNavigate,
}: {
  journey: PathSummary
  screen: Screen
  onNavigate: Navigate
}) {
  return (
    <header className="flex-shrink-0 border-b border-[#E3E0D8] bg-[#FCFBF8] px-5 pt-4 lg:px-8">
      <nav aria-label="Journey breadcrumb" className="flex min-w-0 items-center gap-2 text-sm">
        <button
          className="shrink-0 text-[#5B7A58] hover:underline"
          onClick={() => onNavigate('journeys')}
        >
          My Journeys
        </button>
        <ChevronRight size={14} className="shrink-0 text-[#A8A5A0]" />
        <span className="truncate font-medium" title={journey.title}>
          {journey.title}
        </span>
      </nav>
      <nav aria-label="Journey sections" className="mt-3 flex gap-1 overflow-x-auto">
        {[
          { screen: 'graph', label: 'Curriculum' },
          { screen: 'notebook', label: 'Notebook' },
          { screen: 'sources', label: 'Sources' },
          { screen: 'session', label: 'Study' },
        ].map((tab) => {
          const selected = screen === tab.screen || (screen === 'node' && tab.screen === 'graph')
          return (
            <button
              key={tab.screen}
              aria-current={selected ? 'page' : undefined}
              className={`shrink-0 border-b-2 px-2 py-3 text-xs sm:px-4 sm:text-sm ${selected ? 'border-[#5B7A58] font-medium text-[#345231]' : 'border-transparent text-[#7A7870] hover:text-[#345231]'}`}
              onClick={() => onNavigate(tab.screen as Screen, { path_id: journey.id })}
            >
              {tab.label}
            </button>
          )
        })}
      </nav>
    </header>
  )
}
