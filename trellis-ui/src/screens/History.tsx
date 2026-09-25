import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowRight, Clock } from 'lucide-react'
import { api, date, type Activity, type Navigate } from '../lib/api'
import { Empty, ErrorNotice, Loading, Status } from '../components/ui'

interface LearningSession {
  id: string
  path_id: string
  node_id?: string
  thread_id?: string
  started_at: string
  last_active_at: string
  ended_at?: string
}
export default function History({ onNavigate }: { onNavigate: Navigate }) {
  const client = useQueryClient()
  const history = useQuery({
    queryKey: ['history'],
    queryFn: () => api<Activity[]>('/history'),
  })
  const sessions = useQuery({
    queryKey: ['learning-sessions'],
    queryFn: () => api<LearningSession[]>('/learning-sessions'),
  })
  const endSession = useMutation({
    mutationFn: () => api('/learning-sessions/end', 'POST'),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: ['learning-sessions'] })
      client.invalidateQueries({ queryKey: ['history'] })
    },
  })
  const active = sessions.data?.find((session) => !session.ended_at)
  return (
    <div className="screen-enter mx-auto max-w-3xl">
      <div className="mb-7">
        <h1 className="font-display text-3xl font-light">Learning history</h1>
        <p className="mt-1 text-sm text-[#7A7870]">
          Your learning activity, connected to where it happened.
        </p>
      </div>
      <ErrorNotice error={history.error || sessions.error || endSession.error} />
      {active && (
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#C5D9C4] bg-[#EFF4EE] p-5">
          <div>
            <p className="text-sm font-medium text-[#5B7A58]">Current study session</p>
            <p className="mt-1 text-xs text-[#7A7870]">Started {date(active.started_at)}</p>
          </div>
          <div className="flex gap-2">
            <button
              className="btn-secondary"
              disabled={endSession.isPending}
              onClick={() => endSession.mutate()}
            >
              End session
            </button>
            <button
              className="btn"
              onClick={() => onNavigate(active.node_id ? 'node' : 'graph', active)}
            >
              Resume <ArrowRight size={13} />
            </button>
          </div>
        </div>
      )}
      {history.isPending ? (
        <Loading />
      ) : history.data?.length === 0 ? (
        <Empty title="Your journey starts here">
          <p>Open a learning node, ask a question or save an insight to begin your history.</p>
        </Empty>
      ) : (
        <div className="space-y-3">
          {history.data?.map((item) => (
            <button
              key={item.id}
              className="flex w-full items-center gap-4 rounded-xl border border-[#E3E0D8] bg-white p-4 text-left hover:border-[#B8B5AD]"
              onClick={() => onNavigate(item.node_id ? 'node' : 'graph', item)}
            >
              <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-[#F0EEE9] text-[#5B7A58]">
                <Clock size={16} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium">{item.label}</span>
                <span className="mt-1 block text-xs text-[#A8A5A0]">
                  {date(item.created_at)} · {item.kind.replaceAll('_', ' ')}
                </span>
              </span>
              <ArrowRight size={14} className="text-[#A8A5A0]" />
            </button>
          ))}
        </div>
      )}
      {!!sessions.data?.length && (
        <section className="mt-8">
          <h2 className="mb-4 font-display text-xl">Study sessions</h2>
          <div className="space-y-2">
            {sessions.data.map((session) => (
              <div
                key={session.id}
                className="flex items-center justify-between gap-3 rounded-lg border border-[#E3E0D8] bg-white p-4"
              >
                <div>
                  <p className="text-sm">{date(session.started_at)}</p>
                  <p className="mt-1 text-xs text-[#A8A5A0]">
                    {session.ended_at
                      ? `Ended ${date(session.ended_at)}`
                      : `Last activity ${date(session.last_active_at)}`}
                  </p>
                </div>
                <Status value={session.ended_at ? 'closed' : 'open'} />
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
