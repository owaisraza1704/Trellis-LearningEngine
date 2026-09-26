'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  QueryClient,
  QueryClientProvider,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'
import {
  BookOpen,
  ChevronLeft,
  ChevronRight,
  Files,
  History as HistoryIcon,
  House,
  Network,
  Plus,
  Settings as SettingsIcon,
} from 'lucide-react'
import Landing, { TrellisLogo } from './screens/Landing'
import Dashboard from './screens/Dashboard'
import JourneyLibrary from './screens/JourneyLibrary'
import JourneyNavigation from './components/JourneyNavigation'
import CurriculumGraph from './screens/CurriculumGraph'
import LearningNode from './screens/LearningNode'
import CreateJourney from './screens/CreateJourney'
import Notebook from './screens/Notebook'
import History from './screens/History'
import Settings from './screens/Settings'
import StudySession from './screens/StudySession'
import Sources from './screens/Sources'
import { api, ApiError, type Location, type Navigate, type Screen, type Workspace } from './lib/api'
import { ErrorNotice } from './components/ui'

export default function App() {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            retry: (failures, error) =>
              failures < 1 &&
              error instanceof ApiError &&
              [0, 408, 429, 500, 502, 503, 504].includes(error.status),
            refetchOnWindowFocus: false,
          },
          mutations: { retry: false },
        },
      }),
  )
  return (
    <QueryClientProvider client={client}>
      <WorkspaceApp />
    </QueryClientProvider>
  )
}

function WorkspaceApp() {
  const router = useRouter()
  const params = useSearchParams()
  const client = useQueryClient()
  const requestedScreen = (params.get('screen') || 'landing') as Screen
  const pathId = ['dashboard', 'journeys', 'notebooks', 'history', 'settings', 'create'].includes(
    requestedScreen,
  )
    ? undefined
    : params.get('path') || undefined
  const screen =
    !pathId && requestedScreen === 'graph'
      ? 'journeys'
      : !pathId && ['notebook', 'session'].includes(requestedScreen)
        ? 'notebooks'
        : requestedScreen
  const [collapsed, setCollapsed] = useState(false)
  const [locationError, setLocationError] = useState<Error | null>(null)
  const locationRevision = useRef(0)
  const workspace = useQuery({
    queryKey: ['workspace'],
    queryFn: () => api<Workspace>('/workspace'),
  })
  const nodeId = params.get('node') || undefined
  const threadId = params.get('thread') || undefined
  const currentPath = workspace.data?.paths.find((path) => path.id === pathId)
  useEffect(() => {
    setCollapsed(localStorage.getItem('sidebar-collapsed') === 'true')
  }, [])
  const { mutate: persistLocation } = useMutation({
    scope: { id: 'workspace-location' },
    mutationFn: ({ location, revision }: { location: Location; revision: number }) =>
      revision === locationRevision.current
        ? api<Location>('/location', 'PUT', location)
        : Promise.resolve(null),
    onSuccess: (_, { revision }) => {
      if (revision === locationRevision.current) {
        setLocationError(null)
        return client.invalidateQueries({ queryKey: ['workspace'] })
      }
    },
    onError: (error, { revision }) => {
      if (revision === locationRevision.current) setLocationError(error)
    },
  })
  useEffect(() => {
    if (screen !== 'node' || !pathId || !nodeId) return
    const location: Location = { path_id: pathId, node_id: nodeId, thread_id: threadId || null }
    setLocationError(null)
    persistLocation({ location, revision: ++locationRevision.current })
  }, [screen, pathId, nodeId, threadId, persistLocation])

  const navigate: Navigate = (next, location) => {
    const query = new URLSearchParams({ screen: next })
    const nextPath = location?.path_id
    if (nextPath) query.set('path', nextPath)
    if (location?.node_id) query.set('node', location.node_id)
    if (location?.thread_id) query.set('thread', location.thread_id)
    if (location?.interaction_id) query.set('interaction', location.interaction_id)
    if (location?.notebook_item_id) query.set('note', location.notebook_item_id)
    router.push(`/?${query}`)
  }
  if (screen === 'landing') return <Landing onEnter={() => navigate('dashboard')} />

  const nav = [
    { screen: 'dashboard', label: 'Home', Icon: House },
    { screen: 'journeys', label: 'My Journeys', Icon: Network },
    { screen: 'notebooks', label: 'Notebooks', Icon: BookOpen },
    { screen: 'sources', label: 'Source Library', Icon: Files },
    { screen: 'create', label: 'New Journey', Icon: Plus },
  ] as const
  return (
    <div className="flex h-screen bg-[#F7F6F2] overflow-hidden">
      <aside
        className={`workspace-sidebar ${
          collapsed ? 'w-[68px]' : 'w-56'
        } relative flex flex-shrink-0 flex-col border-r border-[#E3E0D8] bg-[#F2F0EC] py-5 transition-all`}
      >
        <button
          className="absolute -right-3 top-6 z-20 flex h-6 w-6 items-center justify-center rounded-full border border-[#E3E0D8] bg-white text-[#7A7870] shadow-sm"
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          onClick={() => {
            localStorage.setItem('sidebar-collapsed', String(!collapsed))
            setCollapsed(!collapsed)
          }}
        >
          {collapsed ? <ChevronRight size={12} /> : <ChevronLeft size={12} />}
        </button>
        <div className={`flex flex-1 flex-col overflow-hidden ${collapsed ? 'px-3' : 'px-4'}`}>
          <button
            className="mb-7 flex items-center gap-2.5 px-2 text-[#5B7A58]"
            onClick={() => navigate('landing')}
            title="Trellis"
          >
            <TrellisLogo />
            {!collapsed && (
              <span className="sidebar-label font-display text-base font-medium text-[#1A1916]">
                Trellis
              </span>
            )}
          </button>
          <nav aria-label="Main navigation" className="flex-1 space-y-1">
            {nav.map(({ screen: target, label, Icon }) => (
              <button
                key={target}
                title={label}
                onClick={() => navigate(target)}
                className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm transition-all ${
                  (screen === target && !currentPath) || (target === 'journeys' && !!currentPath)
                    ? 'border border-[#E3E0D8] bg-white text-[#1A1916] shadow-sm'
                    : 'border border-transparent text-[#7A7870] hover:bg-[#EAE8E3]'
                }`}
              >
                <Icon size={16} className="flex-shrink-0" />
                {!collapsed && <span className="sidebar-label">{label}</span>}
              </button>
            ))}
          </nav>
          <div className="space-y-1 border-t border-[#E3E0D8] pt-3">
            {[
              { screen: 'history', label: 'History', Icon: HistoryIcon },
              { screen: 'settings', label: 'Settings', Icon: SettingsIcon },
            ].map(({ screen: target, label, Icon }) => (
              <button
                key={target}
                className={`flex w-full items-center gap-2.5 rounded-lg p-3 text-sm text-[#7A7870] ${
                  screen === target ? 'bg-white' : 'hover:bg-[#EAE8E3]'
                }`}
                title={label}
                onClick={() => navigate(target as Screen)}
              >
                <Icon size={16} />
                {!collapsed && <span className="sidebar-label">{label}</span>}
              </button>
            ))}
            {!collapsed && (
              <div className="sidebar-label px-3 pt-3 text-xs text-[#A8A5A0]">
                Your local workspace
              </div>
            )}
          </div>
        </div>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        {currentPath && ['graph', 'node', 'notebook', 'sources', 'session'].includes(screen) && (
          <JourneyNavigation journey={currentPath} screen={screen} onNavigate={navigate} />
        )}
        <main
          className={`min-h-0 min-w-0 flex-1 overflow-y-auto ${screen === 'node' ? '' : 'p-5 lg:p-8'}`}
        >
          <ErrorNotice error={locationError} />
          {screen === 'dashboard' && <Dashboard onNavigate={navigate} />}
          {screen === 'journeys' && (
            <JourneyLibrary key="journeys" mode="journeys" onNavigate={navigate} />
          )}
          {screen === 'notebooks' && (
            <JourneyLibrary key="notebooks" mode="notebooks" onNavigate={navigate} />
          )}
          {screen === 'graph' && (
            <CurriculumGraph key={pathId} onNavigate={navigate} pathId={pathId} />
          )}
          {screen === 'node' && (
            <LearningNode
              onNavigate={navigate}
              nodeId={nodeId}
              threadId={threadId}
              interactionId={params.get('interaction') || undefined}
            />
          )}
          {screen === 'create' && <CreateJourney onNavigate={navigate} />}
          {screen === 'notebook' && (
            <Notebook
              key={pathId}
              pathId={pathId}
              onNavigate={navigate}
              itemId={params.get('note') || undefined}
            />
          )}
          {screen === 'history' && <History onNavigate={navigate} />}
          {screen === 'settings' && <Settings />}
          {screen === 'session' && (
            <StudySession key={pathId} pathId={pathId} onNavigate={navigate} />
          )}
          {screen === 'sources' && <Sources key={pathId} pathId={pathId} />}
        </main>
      </div>
    </div>
  )
}
