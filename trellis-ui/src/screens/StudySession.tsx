import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowDown, ArrowUp, Download, Plus } from 'lucide-react'
import {
  api,
  date,
  type ExportRecord,
  type Navigate,
  type NotebookPage,
  type StudySet,
  type Workspace,
} from '../lib/api'
import { Empty, ErrorNotice, Loading, Modal, Status } from '../components/ui'

export default function StudySession({
  pathId,
  onNavigate,
}: {
  pathId?: string
  onNavigate: Navigate
}) {
  const client = useQueryClient()
  const [setId, setSetId] = useState('')
  const [creating, setCreating] = useState(false)
  const [renaming, setRenaming] = useState(false)
  const [title, setTitle] = useState('')
  const [result, setResult] = useState<ExportRecord | null>(null)
  const workspace = useQuery({
    queryKey: ['workspace'],
    queryFn: () => api<Workspace>('/workspace'),
  })
  const journey = workspace.data?.paths.find((path) => path.id === pathId)
  const sets = useQuery({
    queryKey: ['study-sets', pathId],
    queryFn: () => api<StudySet[]>(`/study-sessions?path_id=${encodeURIComponent(pathId!)}`),
    enabled: !!pathId,
  })
  const pages = useQuery({
    queryKey: ['notebook', pathId],
    queryFn: () => api<NotebookPage[]>(`/notebook/pages?path_id=${encodeURIComponent(pathId!)}`),
    enabled: !!pathId,
  })
  const exports = useQuery({
    queryKey: ['exports', pathId],
    queryFn: () => api<ExportRecord[]>(`/exports?path_id=${encodeURIComponent(pathId!)}`),
    enabled: !!pathId,
    refetchInterval: (query) =>
      query.state.data?.some((record) => ['pending', 'processing'].includes(record.status))
        ? 2000
        : false,
  })
  const selectedSet = sets.data?.find((set) => set.id === setId) || sets.data?.[0]
  const allItems = pages.data?.flatMap((page) => page.items) || []
  const selectedItems =
    selectedSet?.item_ids
      .map((id) => allItems.find((item) => item.id === id))
      .filter((item) => !!item) || []
  const update = useMutation({
    onMutate: () => setResult(null),
    mutationFn: ({ id, body }: { id?: string; body: { title?: string; item_ids?: string[] } }) =>
      api<StudySet>(
        id ? `/study-sessions/${id}` : '/study-sessions',
        id ? 'PATCH' : 'POST',
        id ? body : { ...body, path_id: pathId },
      ),
    onSuccess: (data) => {
      setSetId(data.id)
      setCreating(false)
      setRenaming(false)
      return client.invalidateQueries({ queryKey: ['study-sets'] })
    },
  })
  const exportPdf = useMutation({
    mutationFn: () =>
      api<ExportRecord>('/exports', 'POST', {
        path_id: pathId,
        title: selectedSet!.title,
        item_ids: selectedSet!.item_ids,
        study_session_id: selectedSet!.id,
      }),
    onSuccess: (data) => {
      setResult(data)
      client.invalidateQueries({ queryKey: ['exports'] })
    },
  })
  function toggle(id: string) {
    if (!selectedSet) return
    const ids = selectedSet.item_ids
    update.mutate({
      id: selectedSet.id,
      body: {
        item_ids: ids.includes(id) ? ids.filter((item) => item !== id) : [...ids, id],
      },
    })
  }
  function reorder(index: number, delta: number) {
    const ids = [...selectedSet!.item_ids]
    ;[ids[index], ids[index + delta]] = [ids[index + delta], ids[index]]
    update.mutate({ id: selectedSet!.id, body: { item_ids: ids } })
  }
  if (workspace.isPending || (pathId && (sets.isPending || pages.isPending))) return <Loading />
  return (
    <div className="screen-enter mx-auto max-w-5xl">
      <div className="mb-7 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-light">Study material</h1>
          <p className="mt-1 text-sm text-[#7A7870]">
            {journey ? `${journey.title} notebook · ` : ''}Choose notes from your sections. PDF
            pages are created automatically.
          </p>
        </div>
        <button
          className="btn-secondary"
          disabled={!journey || update.isPending || exportPdf.isPending}
          onClick={() => {
            update.reset()
            setTitle('')
            setCreating(true)
          }}
        >
          <Plus size={14} /> New study selection
        </button>
      </div>
      <div className="mb-6 max-w-md">
        <label className="field-label" htmlFor="study-journey">
          Learning journey
        </label>
        <select
          id="study-journey"
          className="field"
          value={journey?.id || ''}
          disabled={update.isPending || exportPdf.isPending}
          onChange={(event) => onNavigate('session', { path_id: event.target.value })}
        >
          <option value="" disabled>
            Choose a learning journey
          </option>
          {workspace.data?.paths.map((path) => (
            <option key={path.id} value={path.id}>
              {path.title}
            </option>
          ))}
        </select>
      </div>
      <ErrorNotice
        error={workspace.error || sets.error || pages.error || update.error || exportPdf.error}
      />
      {!journey ? (
        <Empty title="Choose a learning journey">
          <p>Study selections and exports belong to that journey’s notebook.</p>
        </Empty>
      ) : !sets.data?.length ? (
        <Empty title="Make a study selection">
          <p className="mb-4">
            Combine notes, explanations and source excerpts into a focused reading set.
          </p>
          <button
            className="btn"
            onClick={() => {
              update.reset()
              setTitle('')
              setCreating(true)
            }}
          >
            Create a study selection
          </button>
        </Empty>
      ) : (
        selectedSet && (
          <>
            <div className="mb-5 flex flex-wrap items-center gap-3">
              <select
                aria-label="Study selection"
                className="field max-w-sm"
                value={selectedSet.id}
                disabled={update.isPending || exportPdf.isPending}
                onChange={(event) => {
                  setSetId(event.target.value)
                  setResult(null)
                  update.reset()
                  exportPdf.reset()
                }}
              >
                {sets.data.map((set) => (
                  <option key={set.id} value={set.id}>
                    {set.title}
                  </option>
                ))}
              </select>
              <button
                className="btn-secondary"
                disabled={update.isPending || exportPdf.isPending}
                onClick={() => {
                  update.reset()
                  setTitle(selectedSet.title)
                  setRenaming(true)
                }}
              >
                Rename
              </button>
              <span role="status" className="text-xs text-[#A8A5A0]">
                {update.isPending
                  ? 'Saving selection…'
                  : update.error
                    ? 'Selection was not saved.'
                    : 'Selection saved locally'}
              </span>
            </div>
            <div className="grid gap-5 lg:grid-cols-2">
              <section className="rounded-xl border border-[#E3E0D8] bg-white p-5">
                <h2 className="mb-4 font-display text-xl">Notebook material</h2>
                {allItems.length === 0 && (
                  <p className="text-sm text-[#7A7870]">Save or write a notebook item first.</p>
                )}
                {pages.data
                  ?.filter((page) => page.items.length)
                  .map((page) => (
                    <div key={page.id} className="mb-5">
                      <p className="mb-2 text-xs uppercase tracking-wide text-[#A8A5A0]">
                        {page.title}
                      </p>
                      {page.items.map((item) => (
                        <label
                          key={item.id}
                          className="flex cursor-pointer items-start gap-3 rounded-lg py-3"
                        >
                          <input
                            className="mt-1"
                            type="checkbox"
                            checked={selectedSet.item_ids.includes(item.id)}
                            disabled={update.isPending || exportPdf.isPending}
                            onChange={() => toggle(item.id)}
                          />
                          <div>
                            <p className="text-sm">{item.title}</p>
                            <p className="mt-1 line-clamp-2 text-xs text-[#A8A5A0]">
                              {item.content}
                            </p>
                          </div>
                        </label>
                      ))}
                    </div>
                  ))}
              </section>
              <section className="self-start rounded-xl border border-[#E3E0D8] bg-white p-5">
                <h2 className="mb-1 font-display text-xl">{selectedSet.title}</h2>
                <p className="mb-5 text-xs text-[#A8A5A0]">
                  {selectedItems.length} selected items · PDF keeps this order
                </p>
                {selectedItems.length === 0 && (
                  <p className="py-5 text-sm text-[#7A7870]">Select items from your notebook.</p>
                )}
                {selectedItems.map((item, index) => (
                  <div
                    key={item.id}
                    className="flex items-center gap-3 border-t border-[#F0EEE9] py-3"
                  >
                    <span className="font-mono text-xs text-[#A8A5A0]">{index + 1}</span>
                    <p className="flex-1 text-sm">{item.title}</p>
                    <button
                      aria-label={`Move ${item.title} earlier`}
                      className="icon-button"
                      disabled={index === 0 || update.isPending || exportPdf.isPending}
                      onClick={() => reorder(index, -1)}
                    >
                      <ArrowUp size={14} />
                    </button>
                    <button
                      aria-label={`Move ${item.title} later`}
                      className="icon-button"
                      disabled={
                        index === selectedItems.length - 1 ||
                        update.isPending ||
                        exportPdf.isPending
                      }
                      onClick={() => reorder(index, 1)}
                    >
                      <ArrowDown size={14} />
                    </button>
                  </div>
                ))}
                <button
                  className="btn mt-5 w-full"
                  disabled={!selectedItems.length || exportPdf.isPending || update.isPending}
                  onClick={() => {
                    setResult(null)
                    exportPdf.mutate()
                  }}
                >
                  <Download size={14} />
                  {exportPdf.isPending ? 'Preparing PDF…' : 'Export PDF'}
                </button>
                {result && (
                  <div className="mt-4">
                    <Status value={result.status} />
                    <ErrorNotice error={result.error} />
                    {result.download_url && (
                      <a
                        className="mt-3 block text-sm text-[#5B7A58] underline"
                        href={result.download_url}
                        download
                      >
                        Download prepared PDF
                      </a>
                    )}
                  </div>
                )}
              </section>
            </div>
          </>
        )
      )}
      {journey && (
        <section className="mt-8">
          <h2 className="mb-4 font-display text-xl">Previous exports</h2>
          <ErrorNotice error={exports.error} />
          {exports.data?.length === 0 && (
            <p className="text-sm text-[#A8A5A0]">Your prepared PDFs will appear here.</p>
          )}
          <div className="space-y-2">
            {exports.data?.map((record) => (
              <div
                className="flex flex-wrap items-center gap-3 rounded-lg border border-[#E3E0D8] bg-white p-4"
                key={record.id}
              >
                <div className="flex-1">
                  <p className="text-sm">{record.title}</p>
                  <p className="text-xs text-[#A8A5A0]">{date(record.created_at)}</p>
                  {record.error && <p className="mt-1 text-xs text-[#A8554E]">{record.error}</p>}
                </div>
                <Status value={record.status} />
                {record.download_url && (
                  <a className="btn-secondary" href={record.download_url} download>
                    <Download size={14} /> Download
                  </a>
                )}
              </div>
            ))}
          </div>
        </section>
      )}
      {(creating || renaming) && (
        <Modal
          title={renaming ? 'Rename study selection' : 'New study selection'}
          onClose={() => {
            setCreating(false)
            setRenaming(false)
            update.reset()
          }}
        >
          <form
            onSubmit={(event) => {
              event.preventDefault()
              update.mutate(
                renaming
                  ? { id: selectedSet!.id, body: { title: title.trim() } }
                  : { body: { title: title.trim(), item_ids: [] } },
              )
            }}
          >
            <label className="field-label" htmlFor="study-title">
              Selection title
            </label>
            <input
              id="study-title"
              disabled={update.isPending}
              maxLength={200}
              className="field"
              value={title}
              required
              onChange={(event) => setTitle(event.target.value)}
              placeholder="e.g. Concepts to revisit"
            />
            <ErrorNotice error={update.error} />
            <button className="btn mt-5" disabled={update.isPending || !title.trim()}>
              {renaming ? 'Save title' : 'Create selection'}
            </button>
          </form>
        </Modal>
      )}
    </div>
  )
}
