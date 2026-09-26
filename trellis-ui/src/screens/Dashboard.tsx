import { useQuery } from '@tanstack/react-query'
import { ArrowRight, Plus } from 'lucide-react'
import { api, date, type Navigate, type Workspace } from '../lib/api'
import { Empty, ErrorNotice, Loading } from '../components/ui'

export default function Dashboard({ onNavigate }: { onNavigate: Navigate }) {
  const { data, error, isPending } = useQuery({
    queryKey: ['workspace'],
    queryFn: () => api<Workspace>('/workspace'),
  })
  if (isPending) return <Loading />
  if (!data) return <ErrorNotice error={error} />
  const recent = data.paths
    .filter((path) => path.last_studied_at && path.resume?.node_id)
    .sort((a, b) => b.last_studied_at!.localeCompare(a.last_studied_at!))
    .slice(0, 4)
  const lastStudied = recent[0]
  const locationDetail =
    lastStudied?.resume?.path_id === data.location.path_id &&
    lastStudied?.resume?.node_id === data.location.node_id &&
    lastStudied?.resume?.thread_id === data.location.thread_id
      ? data.location_detail
      : undefined
  return (
    <div className="screen-enter max-w-6xl mx-auto">
      <div className="mb-8">
        <p className="mb-2 text-xs uppercase tracking-widest text-[#A8A5A0]">
          Your learning workspace
        </p>
        <h1 className="font-display text-4xl font-light">Room to grow.</h1>
        <p className="mt-2 text-sm text-[#7A7870]">
          Follow a thought. Build understanding. Pick up where you left off.
        </p>
      </div>
      <div className="mb-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[
          { label: 'Learning journeys', value: data.stats.paths },
          { label: 'Learning nodes', value: data.stats.nodes },
          { label: 'Nodes completed', value: data.stats.completed },
          { label: 'Notebook items', value: data.stats.notebook_items },
        ].map((stat) => (
          <div key={stat.label} className="rounded-xl border border-[#E3E0D8] bg-white px-5 py-4">
            <p className="font-display text-3xl">{stat.value}</p>
            <p className="text-xs text-[#A8A5A0]">{stat.label}</p>
          </div>
        ))}
      </div>
      {lastStudied && (
        <div className="mb-8 rounded-xl border border-[#C5D9C4] bg-[#EFF4EE] p-6">
          <p className="mb-2 text-xs uppercase tracking-widest text-[#5B7A58]">Continue learning</p>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="font-display text-2xl">{lastStudied.title}</h2>
              {locationDetail?.node_title && (
                <p className="mt-2 text-sm text-[#3D3C38]">
                  Last studied: {locationDetail.node_title}
                  {locationDetail.thread_title && (
                    <span className="block mt-1 text-[#4A5FA5]">
                      Exploring: {locationDetail.thread_title}
                    </span>
                  )}
                </p>
              )}
              <p className="mt-1 text-sm text-[#7A7870]">
                {lastStudied.completed_count} of {lastStudied.node_count} topics completed
              </p>
            </div>
            <button className="btn" onClick={() => onNavigate('node', lastStudied.resume!)}>
              Continue <ArrowRight size={15} />
            </button>
          </div>
        </div>
      )}
      <div className="mb-4 flex items-center justify-between">
        <h2 className="font-display text-xl">Recently studied</h2>
        <div className="flex flex-wrap items-center gap-3">
          <button
            className="text-sm text-[#5B7A58] hover:underline"
            onClick={() => onNavigate('journeys')}
          >
            View all journeys <ArrowRight size={14} className="inline" />
          </button>
          <button className="btn-secondary" onClick={() => onNavigate('create')}>
            <Plus size={15} /> New Journey
          </button>
        </div>
      </div>
      {data.paths.length === 0 ? (
        <Empty title="Begin with something you want to understand.">
          <p className="mb-4">
            Describe a goal or bring an existing curriculum. Your sources, notes and progress stay
            connected.
          </p>
          <button className="btn" onClick={() => onNavigate('create')}>
            Create your first journey
          </button>
        </Empty>
      ) : recent.length === 0 ? (
        <Empty title="Choose a journey to begin studying.">
          <p className="mb-4">Your recently studied journeys will appear here.</p>
          <button className="btn" onClick={() => onNavigate('journeys')}>
            Browse your journeys
          </button>
        </Empty>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {recent.map((path) => (
            <article
              key={path.id}
              aria-label={path.title}
              className="rounded-xl border border-[#E3E0D8] bg-white p-5"
            >
              <h3 className="font-display text-xl">{path.title}</h3>
              <p className="my-2 line-clamp-2 text-sm text-[#7A7870]">{path.description}</p>
              <div className="my-4 h-1.5 rounded-full bg-[#EEF0EB]">
                <div
                  className="h-full rounded-full bg-[#5B7A58]"
                  style={{ width: `${path.progress}%` }}
                />
              </div>
              <div className="flex justify-between text-xs text-[#A8A5A0]">
                <span>
                  {path.completed_count}/{path.node_count} topics · {Math.round(path.progress)}%
                </span>
                <span>Last studied {date(path.last_studied_at!)}</span>
              </div>
              <div className="mt-5 flex flex-wrap items-center gap-3">
                <button
                  className="btn-secondary"
                  onClick={() => onNavigate('graph', { path_id: path.id })}
                >
                  Open journey
                </button>
                {path.resume?.node_id && (
                  <button
                    className="text-sm text-[#5B7A58] hover:underline"
                    onClick={() => onNavigate('node', path.resume!)}
                  >
                    Continue learning <ArrowRight size={14} className="inline" />
                  </button>
                )}
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  )
}
