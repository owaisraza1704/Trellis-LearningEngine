import { useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowRight, BookOpen, ChevronLeft, ChevronRight, Plus, Search, Trash2 } from 'lucide-react'
import { api, date, type Navigate, type PathSummary, type Workspace } from '../lib/api'
import { Empty, ErrorNotice, Loading, Status } from '../components/ui'

function journeyStatus(path: PathSummary) {
  if (path.node_count > 0 && path.completed_count === path.node_count) return 'completed'
  if (path.last_studied_at || path.resume?.node_id || path.completed_count > 0) return 'in_progress'
  return 'not_started'
}

export default function JourneyLibrary({
  mode,
  onNavigate,
}: {
  mode: 'journeys' | 'notebooks'
  onNavigate: Navigate
}) {
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('all')
  const [sort, setSort] = useState('recent')
  const [page, setPage] = useState(1)
  const heading = useRef<HTMLHeadingElement>(null)
  const client = useQueryClient()
  const { data, error, isPending, refetch } = useQuery({
    queryKey: ['workspace'],
    queryFn: () => api<Workspace>('/workspace'),
  })
  const deleteJourney = useMutation({
    mutationFn: (id: string) => api<void>(`/paths/${id}`, 'DELETE'),
    onSuccess: () => client.invalidateQueries(),
  })
  if (isPending) return <Loading />
  if (!data)
    return (
      <div>
        <ErrorNotice error={error} />
        <button className="btn-secondary" onClick={() => void refetch()}>
          Retry
        </button>
      </div>
    )

  const notebooks = mode === 'notebooks'
  const query = search.trim().toLowerCase()
  const filtered = data.paths
    .filter(
      (path) =>
        `${path.title} ${path.description}`.toLowerCase().includes(query) &&
        (status === 'all' || journeyStatus(path) === status),
    )
    .sort((a, b) => {
      if (sort === 'name') return a.title.localeCompare(b.title)
      const first = notebooks ? a.notebook_updated_at : a.last_studied_at
      const second = notebooks ? b.notebook_updated_at : b.last_studied_at
      return (second || '').localeCompare(first || '') || a.title.localeCompare(b.title)
    })
  const pageCount = Math.max(1, Math.ceil(filtered.length / 12))
  const currentPage = Math.min(page, pageCount)
  const start = (currentPage - 1) * 12
  const visible = filtered.slice(start, start + 12)

  return (
    <div className="screen-enter mx-auto max-w-6xl">
      <div className="mb-7 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 ref={heading} className="font-display text-4xl font-light">
            {notebooks ? 'Notebooks' : 'My Journeys'}
          </h1>
          <p className="mt-2 text-sm text-[#7A7870]">
            {notebooks
              ? 'Find the notes you have collected for each learning journey.'
              : 'Explore your journeys or continue from where you last studied.'}
          </p>
        </div>
        <button className="btn" onClick={() => onNavigate('create')}>
          <Plus size={16} /> New Journey
        </button>
      </div>
      <ErrorNotice error={deleteJourney.error} />

      {data.paths.length === 0 ? (
        <Empty
          title={
            notebooks
              ? 'Your notebooks begin with a journey.'
              : 'Create your first learning journey.'
          }
        >
          <p className="mb-4">
            Choose something you want to understand. Its curriculum, notebook and sources will stay
            together.
          </p>
          <button className="btn" onClick={() => onNavigate('create')}>
            Create your first journey
          </button>
        </Empty>
      ) : (
        <>
          <div className="mb-4 flex flex-wrap items-end gap-4">
            <div className="min-w-60 flex-1">
              <label htmlFor="journey-search" className="mb-2 block text-sm text-[#7A7870]">
                {notebooks ? 'Search notebooks by journey' : 'Search journeys'}
              </label>
              <div className="relative">
                <Search
                  size={17}
                  className="pointer-events-none absolute left-3 top-3 text-[#A8A5A0]"
                />
                <input
                  id="journey-search"
                  type="search"
                  className="field !pl-10"
                  placeholder="Search by name or description"
                  value={search}
                  onChange={(event) => {
                    setSearch(event.target.value)
                    setPage(1)
                  }}
                />
              </div>
            </div>
            <div>
              <label htmlFor="journey-sort" className="mb-2 block text-sm text-[#7A7870]">
                Sort by
              </label>
              <select
                id="journey-sort"
                className="field"
                value={sort}
                onChange={(event) => {
                  setSort(event.target.value)
                  setPage(1)
                }}
              >
                <option value="recent">
                  {notebooks ? 'Notebook last updated' : 'Recently studied'}
                </option>
                <option value="name">Name A–Z</option>
              </select>
            </div>
          </div>
          <div role="group" aria-label="Journey status" className="mb-5 flex flex-wrap gap-2">
            {[
              ['all', 'All'],
              ['in_progress', 'In progress'],
              ['not_started', 'Not started'],
              ['completed', 'Completed'],
            ].map(([value, label]) => (
              <button
                key={value}
                aria-pressed={status === value}
                className={status === value ? 'btn' : 'btn-secondary'}
                onClick={() => {
                  setStatus(value)
                  setPage(1)
                }}
              >
                {label}
              </button>
            ))}
          </div>
          <p role="status" className="mb-4 text-sm text-[#7A7870]">
            {filtered.length === 0 ? '0' : `${start + 1}–${Math.min(start + 12, filtered.length)}`}{' '}
            of {filtered.length}{' '}
            {notebooks
              ? filtered.length === 1
                ? 'notebook'
                : 'notebooks'
              : filtered.length === 1
                ? 'journey'
                : 'journeys'}
            {filtered.length !== data.paths.length && ` · ${data.paths.length} total`}
          </p>
          {visible.length === 0 ? (
            <Empty title={notebooks ? 'No matching notebooks.' : 'No matching journeys.'}>
              <p className="mb-4">Try another search or clear your filters.</p>
              <button
                className="btn-secondary"
                onClick={() => {
                  setSearch('')
                  setStatus('all')
                  setPage(1)
                }}
              >
                Clear filters
              </button>
            </Empty>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {visible.map((path) => (
                <article
                  key={path.id}
                  aria-label={path.title}
                  className="flex flex-col rounded-xl border border-[#E3E0D8] bg-white p-5"
                >
                  <div className="mb-3 flex items-start justify-between gap-3">
                    {notebooks && <BookOpen size={20} className="mt-1 shrink-0 text-[#5B7A58]" />}
                    <h2 className="min-w-0 flex-1 font-display text-xl">{path.title}</h2>
                    <Status value={journeyStatus(path)} />
                  </div>
                  <p className="mb-4 line-clamp-2 text-sm text-[#7A7870]">{path.description}</p>
                  <div className="mt-auto">
                    {notebooks ? (
                      <>
                        <p className="text-sm text-[#3D3C38]">
                          {path.notebook_item_count || 0}{' '}
                          {(path.notebook_item_count || 0) === 1 ? 'note' : 'notes'}
                        </p>
                        <p className="mt-2 text-xs text-[#7A7870]">
                          {path.notebook_updated_at
                            ? `Notebook updated ${date(path.notebook_updated_at)}`
                            : 'No notes added yet'}
                        </p>
                      </>
                    ) : (
                      <>
                        <div className="mb-2 h-1.5 rounded-full bg-[#EEF0EB]">
                          <div
                            className="h-full rounded-full bg-[#5B7A58]"
                            style={{ width: `${path.progress}%` }}
                          />
                        </div>
                        <p className="text-xs text-[#7A7870]">
                          {path.completed_count} of {path.node_count} topics complete ·{' '}
                          {Math.round(path.progress)}%
                        </p>
                        <p className="mt-2 text-xs text-[#7A7870]">
                          {path.last_studied_at
                            ? `Last studied ${date(path.last_studied_at)}`
                            : 'Not studied yet'}
                        </p>
                      </>
                    )}
                    <div className="mt-5 flex flex-wrap items-center gap-3">
                      <button
                        className="btn-secondary"
                        onClick={() =>
                          onNavigate(notebooks ? 'notebook' : 'graph', { path_id: path.id })
                        }
                      >
                        {notebooks ? 'Open notebook' : 'Open journey'}
                      </button>
                      {!notebooks && path.resume?.node_id && (
                        <button
                          className="text-sm text-[#5B7A58] hover:underline"
                          onClick={() => onNavigate('node', path.resume!)}
                        >
                          Continue learning <ArrowRight size={14} className="inline" />
                        </button>
                      )}
                      {!notebooks && (
                        <button
                          type="button"
                          aria-label={`Delete journey ${path.title}`}
                          className="inline-flex items-center gap-1 text-sm text-[#A8554E] hover:underline"
                          disabled={deleteJourney.isPending}
                          onClick={() => {
                            if (
                              confirm(
                                `Delete "${path.title}" permanently? Its curriculum, progress, conversations, notebook, and PDF exports will be removed. Sources you added will return to your source library; web pages Trellis found for this journey will be removed.`,
                              )
                            )
                              deleteJourney.mutate(path.id)
                          }}
                        >
                          <Trash2 size={14} /> Delete journey
                        </button>
                      )}
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
          {pageCount > 1 && (
            <nav
              aria-label="Collection pages"
              className="mt-6 flex items-center justify-center gap-4"
            >
              <button
                className="btn-secondary"
                disabled={currentPage === 1}
                onClick={() => {
                  setPage(currentPage - 1)
                  heading.current?.scrollIntoView({ block: 'start' })
                }}
              >
                <ChevronLeft size={16} /> Previous
              </button>
              <span className="text-sm text-[#7A7870]">
                Page {currentPage} of {pageCount}
              </span>
              <button
                className="btn-secondary"
                disabled={currentPage === pageCount}
                onClick={() => {
                  setPage(currentPage + 1)
                  heading.current?.scrollIntoView({ block: 'start' })
                }}
              >
                Next <ChevronRight size={16} />
              </button>
            </nav>
          )}
        </>
      )}
    </div>
  )
}
