import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowRight, Plus } from 'lucide-react'
import { api, type Navigate, type PathDetail, type Source } from '../lib/api'
import { ErrorNotice, Modal, Status } from '../components/ui'
import { SourceForm } from './Sources'

export default function CreateJourney({ onNavigate }: { onNavigate: Navigate }) {
  const client = useQueryClient()
  const [input, setInput] = useState('')
  const [mode, setMode] = useState<'goal' | 'outline'>('goal')
  const [chosen, setChosen] = useState<string[]>([])
  const [adding, setAdding] = useState(false)
  const sources = useQuery({
    queryKey: ['sources'],
    queryFn: () => api<Source[]>('/sources'),
    refetchInterval: (query) =>
      query.state.data?.some((source) =>
        ['processing', 'pending', 'queued'].includes(source.status),
      )
        ? 2000
        : false,
  })
  const create = useMutation({
    mutationFn: () => api<PathDetail>('/paths', 'POST', { input, mode, source_ids: chosen }),
    onSuccess: (data) => {
      client.invalidateQueries({ queryKey: ['workspace'] })
      client.invalidateQueries({ queryKey: ['paths'] })
      client.invalidateQueries({ queryKey: ['sources'] })
      onNavigate('graph', { path_id: data.id })
    },
  })
  const available = sources.data?.filter((source) => !source.path_id) || []
  const processing = chosen.some(
    (id) => !available.some((source) => source.id === id && source.status === 'ready'),
  )
  return (
    <div className="screen-enter mx-auto max-w-2xl py-8">
      <div className="mb-9 text-center">
        <p className="mb-3 text-xs uppercase tracking-widest text-[#A8A5A0]">
          A new learning journey
        </p>
        <h1 className="font-display text-4xl font-light">What do you want to learn?</h1>
        <p className="mt-3 text-sm text-[#7A7870]">
          Start with a goal or bring a curriculum. Trellis will build a connected path.
        </p>
      </div>
      <form
        onSubmit={(event) => {
          event.preventDefault()
          create.mutate()
        }}
      >
        <div className="mb-4 flex justify-center gap-2">
          <button
            type="button"
            className={mode === 'goal' ? 'btn' : 'btn-secondary'}
            onClick={() => setMode('goal')}
          >
            Learning goal
          </button>
          <button
            type="button"
            className={mode === 'outline' ? 'btn' : 'btn-secondary'}
            onClick={() => setMode('outline')}
          >
            Existing curriculum
          </button>
        </div>
        <label className="field-label" htmlFor="journey-input">
          {mode === 'goal' ? 'Your goal' : 'Curriculum or syllabus'}
        </label>
        <textarea
          id="journey-input"
          required
          className="field min-h-40"
          placeholder={
            mode === 'goal'
              ? 'e.g. Understand databases well enough to design my first application'
              : 'Paste your topics, modules and subtopics here…'
          }
          value={input}
          onChange={(event) => setInput(event.target.value)}
        />
        <div className="mt-6 rounded-xl border border-[#E3E0D8] bg-white p-5">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="font-display text-lg">Learning material</h2>
            <button type="button" className="btn-secondary" onClick={() => setAdding(true)}>
              <Plus size={14} /> Add Source
            </button>
          </div>
          <p className="mb-4 text-xs text-[#7A7870]">
            Selected material takes priority. With no sources selected, Trellis looks for web
            evidence.
          </p>
          {available.length === 0 && (
            <p className="text-sm text-[#A8A5A0]">No unattached sources yet.</p>
          )}
          {available.map((source) => (
            <label
              key={source.id}
              className="flex items-center gap-3 border-t border-[#F0EEE9] py-3 text-sm"
            >
              <input
                type="checkbox"
                checked={chosen.includes(source.id)}
                onChange={() =>
                  setChosen((ids) =>
                    ids.includes(source.id)
                      ? ids.filter((id) => id !== source.id)
                      : [...ids, source.id],
                  )
                }
              />
              <span className="flex-1">{source.title}</span>
              <Status value={source.status} />
            </label>
          ))}
          <ErrorNotice error={sources.error} />
        </div>
        <ErrorNotice error={create.error} />
        {processing && (
          <p role="status" className="mt-3 text-xs text-[#7A7870]">
            All selected sources must finish processing before building the path. Remove failed
            sources or retry them in Sources.
          </p>
        )}
        <button
          className="btn mt-6 w-full !py-3.5"
          disabled={create.isPending || !input.trim() || processing}
        >
          {create.isPending ? 'Building your learning path…' : 'Build My Learning Path'}
          {!create.isPending && <ArrowRight size={15} />}
        </button>
        {create.isPending && (
          <p role="status" className="mt-3 text-center text-xs text-[#7A7870]">
            Organizing concepts and checking the available material. This can take a minute.
          </p>
        )}
      </form>
      {adding && (
        <Modal title="Add learning material" onClose={() => setAdding(false)}>
          <SourceForm
            onDone={(source) => {
              setChosen((ids) => [...ids, source.id])
              setAdding(false)
            }}
          />
        </Modal>
      )}
    </div>
  )
}
