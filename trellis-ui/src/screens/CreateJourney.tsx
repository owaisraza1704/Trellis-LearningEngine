import { useEffect, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowRight, BookOpen, Eye, Plus, X } from 'lucide-react'
import { api, type Navigate, type PathDetail, type Source } from '../lib/api'
import { sourceOriginLabel } from '../lib/source'
import { ErrorNotice, Loading, Modal, Status } from '../components/ui'
import { SourcePreview } from '../components/SourcePreview'
import { SourceForm } from './Sources'

export default function CreateJourney({ onNavigate }: { onNavigate: Navigate }) {
  const client = useQueryClient()
  const [input, setInput] = useState('')
  const [mode, setMode] = useState<'goal' | 'outline'>('goal')
  const [chosen, setChosen] = useState<string[]>([])
  const [adding, setAdding] = useState(false)
  const [librarySelection, setLibrarySelection] = useState<string[] | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [elapsedSeconds, setElapsedSeconds] = useState(0)
  const startedAt = useRef(0)
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
  useEffect(() => {
    if (!create.isPending) return
    const timer = window.setInterval(() => {
      setElapsedSeconds(Math.floor((Date.now() - startedAt.current) / 1000))
    }, 1000)
    return () => window.clearInterval(timer)
  }, [create.isPending])
  const available = sources.data?.filter((source) => !source.path_id && source.kind !== 'web') || []
  const processing = chosen.some(
    (id) =>
      !available.some(
        (source) => source.id === id && source.status === 'ready' && !source.needs_reindex,
      ),
  )
  return (
    <div className="screen-enter mx-auto max-w-2xl py-8">
      <div className="mb-9 text-center">
        <p className="mb-3 text-xs uppercase tracking-widest text-[#A8A5A0]">
          A new learning journey
        </p>
        <h1 className="font-display text-4xl font-light">What do you want to learn?</h1>
        <p className="mt-3 text-sm text-[#7A7870]">
          Start with a learning goal or an existing curriculum. Both support phases, topics and
          subtopics.
        </p>
      </div>
      <form
        onSubmit={(event) => {
          event.preventDefault()
          if (!create.isPending && !processing) {
            startedAt.current = Date.now()
            setElapsedSeconds(0)
            create.mutate()
          }
        }}
      >
        <div className="mb-4 flex justify-center gap-2">
          <button
            type="button"
            disabled={create.isPending}
            aria-pressed={mode === 'goal'}
            className={mode === 'goal' ? 'btn' : 'btn-secondary'}
            onClick={() => setMode('goal')}
          >
            Learning goal
          </button>
          <button
            type="button"
            disabled={create.isPending}
            aria-pressed={mode === 'outline'}
            className={mode === 'outline' ? 'btn' : 'btn-secondary'}
            onClick={() => setMode('outline')}
          >
            Existing curriculum
          </button>
        </div>
        <p id="journey-mode-description" className="mb-4 text-sm leading-relaxed text-[#7A7870]">
          {mode === 'goal'
            ? 'Trellis plans from your goal and preserves explicit topics. For a short topic with a matching roadmap source, it follows that roadmap.'
            : 'Paste an outline to preserve its hierarchy, or enter a title and select one roadmap source to import its sections.'}
        </p>
        <label className="field-label" htmlFor="journey-input">
          {mode === 'goal' ? 'Your goal' : 'Curriculum or syllabus'}
        </label>
        <textarea
          id="journey-input"
          aria-describedby="journey-mode-description"
          required
          disabled={create.isPending}
          className="field min-h-40"
          placeholder={
            mode === 'goal'
              ? 'e.g. Understand databases well enough to design my first application'
              : 'Paste an outline, or enter a title and select one roadmap source…'
          }
          value={input}
          onChange={(event) => setInput(event.target.value)}
        />
        <div className="mt-6 rounded-xl border border-[#E3E0D8] bg-white p-5">
          <div className="mb-2 flex items-center justify-between gap-3">
            <h2 className="font-display text-lg">Learning material</h2>
            {chosen.length > 0 && (
              <span className="text-xs text-[#7A7870]">
                {chosen.length} {chosen.length === 1 ? 'source' : 'sources'} selected
              </span>
            )}
          </div>
          <p className="mb-4 text-xs text-[#7A7870]">
            {mode === 'outline'
              ? 'With a pasted outline, selected sources support later study. With only a title, select one roadmap source to import its sections.'
              : 'Selected material takes priority. A matching roadmap source can supply a short topic path. Trellis searches the web when more evidence is needed as your questions grow.'}
          </p>
          <div className="mb-4 flex flex-wrap gap-2">
            <button
              type="button"
              className="btn-secondary"
              disabled={create.isPending}
              onClick={() => setAdding(true)}
            >
              <Plus size={14} /> Add files or URLs
            </button>
            <button
              type="button"
              className="btn-secondary"
              disabled={create.isPending}
              onClick={() => setLibrarySelection([...chosen])}
            >
              <BookOpen size={14} /> Choose from source library
            </button>
          </div>
          {chosen.length === 0 && (
            <div className="rounded-lg border border-dashed border-[#E3E0D8] p-5 text-center">
              <p className="text-sm text-[#5A5850]">No material selected</p>
              <p className="mt-1 text-xs text-[#7A7870]">
                Add your own material or choose saved sources for this journey.
              </p>
            </div>
          )}
          {chosen.map((id) => {
            const source = sources.data?.find((item) => item.id === id)
            const title = source?.title || 'Unavailable source'
            return (
              <article key={id} className="border-t border-[#F0EEE9] py-3 text-sm">
                <div className="flex flex-wrap items-start gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="break-words font-medium">{title}</p>
                    {source && (
                      <p className="mt-1 text-xs text-[#7A7870]">
                        {sourceOriginLabel(source.kind)}
                      </p>
                    )}
                  </div>
                  {source && <Status value={source.status} />}
                  <div className="flex gap-2">
                    {source && (
                      <button
                        type="button"
                        className="icon-button"
                        aria-label={`Preview ${title}`}
                        title="Preview source"
                        disabled={create.isPending}
                        onClick={() => setPreview(id)}
                      >
                        <Eye size={16} />
                      </button>
                    )}
                    <button
                      type="button"
                      className="icon-button"
                      aria-label={`Remove ${title} from selection`}
                      title="Remove from selection"
                      disabled={create.isPending}
                      onClick={() => setChosen((ids) => ids.filter((item) => item !== id))}
                    >
                      <X size={16} />
                    </button>
                  </div>
                </div>
                <ErrorNotice error={source?.error} />
                {source?.needs_reindex && (
                  <p className="mt-2 text-xs text-[#946B32]">
                    Open the preview to reindex this source before using it.
                  </p>
                )}
                {!available.some((item) => item.id === id) && !sources.isPending && (
                  <p className="mt-2 text-xs text-[#946B32]">
                    This source is no longer available for a new journey. Remove it from this
                    selection.
                  </p>
                )}
              </article>
            )
          })}
          {chosen.length > 0 && (
            <p className="mt-3 text-xs text-[#7A7870]">
              Removing a selection keeps the source in your library. Permanently delete sources from
              Sources in the sidebar.
            </p>
          )}
          <ErrorNotice error={sources.error} />
        </div>
        <ErrorNotice error={create.error} />
        {processing && (
          <p role="status" className="mt-3 text-xs text-[#7A7870]">
            All selected sources must be ready before building the path. Open a preview to retry or
            reindex, or remove the source from this selection.
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
          <div className="mt-4 rounded-xl border border-[#DDE7DD] bg-[#F4F7F2] p-4">
            <div className="flex items-center justify-between gap-3">
              <p role="status" className="text-sm font-medium text-[#3D5D40]">
                Trellis is working on your learning path
              </p>
              <span className="shrink-0 font-mono text-xs text-[#5B7A58]">
                {Math.floor(elapsedSeconds / 60)}:{String(elapsedSeconds % 60).padStart(2, '0')}{' '}
                elapsed
              </span>
            </div>
            <div
              role="progressbar"
              aria-label="Building learning path"
              className="mt-3 h-1.5 overflow-hidden rounded-full bg-[#DFE8DD]"
            >
              <div className="journey-progress-indicator h-full w-1/3 rounded-full bg-[#5B7A58]" />
            </div>
            <p className="mt-3 text-xs leading-relaxed text-[#5A6857]">
              Planning topics, finding supporting material, and checking coverage. Larger curricula
              can take a few minutes.
            </p>
          </div>
        )}
      </form>
      {adding && (
        <Modal title="Add learning material" onClose={() => setAdding(false)}>
          <SourceForm
            onDone={(source) => {
              client.setQueryData<Source[]>(['sources'], (current = []) => [
                source,
                ...current.filter((item) => item.id !== source.id),
              ])
              setChosen((ids) => [...ids, source.id])
              setAdding(false)
            }}
          />
        </Modal>
      )}
      {librarySelection !== null && (
        <Modal title="Choose from source library" onClose={() => setLibrarySelection(null)}>
          <p className="mb-4 text-sm text-[#7A7870]">
            Your uploaded files, added URLs and pasted text that are not yet attached to a journey.
            Automatically discovered web pages stay with your learning evidence.
          </p>
          <ErrorNotice error={sources.error} />
          {sources.isPending && <Loading label="Loading your source library…" />}
          {!sources.isPending && available.length === 0 && (
            <p className="py-4 text-sm text-[#7A7870]">
              No saved material is available for a new journey. Close this library and add files or
              URLs to get started.
            </p>
          )}
          {available.map((source) => (
            <div key={source.id} className="flex items-start gap-3 border-t border-[#F0EEE9] py-3">
              <label className="flex min-w-0 flex-1 items-start gap-3 text-sm">
                <input
                  type="checkbox"
                  className="mt-1"
                  aria-label={source.title}
                  checked={librarySelection.includes(source.id)}
                  onChange={() =>
                    setLibrarySelection((ids) =>
                      ids?.includes(source.id)
                        ? ids.filter((id) => id !== source.id)
                        : [...(ids || []), source.id],
                    )
                  }
                />
                <span className="min-w-0">
                  <span className="block break-words">{source.title}</span>
                  <span className="mt-1 block text-xs text-[#7A7870]">
                    {sourceOriginLabel(source.kind)}
                  </span>
                </span>
              </label>
              <Status value={source.status} />
              <button
                type="button"
                className="icon-button"
                aria-label={`Preview ${source.title}`}
                title="Preview source"
                onClick={() => setPreview(source.id)}
              >
                <Eye size={16} />
              </button>
            </div>
          ))}
          <div className="mt-5 flex flex-wrap justify-end gap-2">
            <button className="btn-secondary" onClick={() => setLibrarySelection(null)}>
              Cancel
            </button>
            <button
              className="btn"
              disabled={sources.isPending || !!sources.error}
              onClick={() => {
                setChosen(
                  librarySelection.filter((id) => available.some((source) => source.id === id)),
                )
                setLibrarySelection(null)
              }}
            >
              Use selected sources
            </button>
          </div>
        </Modal>
      )}
      {preview && <SourcePreview sourceId={preview} onClose={() => setPreview(null)} />}
    </div>
  )
}
