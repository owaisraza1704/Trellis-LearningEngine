import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { FileText, Link as LinkIcon, Plus, RefreshCw, Trash2, Upload } from 'lucide-react'
import { api, date, type Source } from '../lib/api'
import { Empty, ErrorNotice, Loading, Modal, Status } from '../components/ui'

export function SourceForm({
  pathId,
  onDone,
}: {
  pathId?: string
  onDone: (source: Source) => void
}) {
  const client = useQueryClient()
  const [kind, setKind] = useState('file')
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [url, setUrl] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const submit = useMutation({
    mutationFn: async () => {
      if (kind === 'file') {
        const form = new FormData()
        form.append('file', file!)
        if (pathId) form.append('path_id', pathId)
        return api<Source>('/sources/upload', 'POST', form)
      }
      return api<Source>(
        `/sources/${kind}`,
        'POST',
        kind === 'url'
          ? { url, path_id: pathId || null }
          : { title, content, path_id: pathId || null },
      )
    },
    onSuccess: (source) => {
      client.invalidateQueries({ queryKey: ['sources'] })
      onDone(source)
    },
  })
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault()
        submit.mutate()
      }}
    >
      <div className="mb-5 flex gap-2">
        {[
          { id: 'file', label: 'Upload file', Icon: Upload },
          { id: 'url', label: 'Web page', Icon: LinkIcon },
          { id: 'text', label: 'Paste text', Icon: FileText },
        ].map(({ id, label, Icon }) => (
          <button
            key={id}
            type="button"
            className={kind === id ? 'btn' : 'btn-secondary'}
            onClick={() => setKind(id)}
          >
            <Icon size={14} />
            {label}
          </button>
        ))}
      </div>
      {kind === 'file' ? (
        <>
          <label className="field-label" htmlFor="source-file">
            PDF, Markdown or text
          </label>
          <input
            id="source-file"
            type="file"
            accept=".pdf,.md,.txt"
            className="field"
            onChange={(event) => setFile(event.target.files?.[0] || null)}
          />
        </>
      ) : kind === 'url' ? (
        <>
          <label htmlFor="source-url" className="field-label">
            Source URL
          </label>
          <input
            id="source-url"
            type="url"
            required
            className="field"
            value={url}
            onChange={(event) => setUrl(event.target.value)}
            placeholder="https://…"
          />
          <p className="mt-2 text-xs text-[#A8A5A0]">
            Use a publicly readable article or documentation page.
          </p>
        </>
      ) : (
        <>
          <label htmlFor="source-title" className="field-label">
            Source title
          </label>
          <input
            id="source-title"
            className="field"
            required
            value={title}
            onChange={(event) => setTitle(event.target.value)}
          />
          <label htmlFor="source-content" className="field-label">
            Source text
          </label>
          <textarea
            id="source-content"
            className="field min-h-48"
            required
            value={content}
            onChange={(event) => setContent(event.target.value)}
          />
        </>
      )}
      <ErrorNotice error={submit.error} />
      <button
        className="btn mt-5"
        disabled={
          submit.isPending ||
          (kind === 'file'
            ? !file
            : kind === 'url'
              ? !url.trim()
              : !title.trim() || !content.trim())
        }
      >
        {submit.isPending ? 'Adding source…' : 'Add Source'}
      </button>
    </form>
  )
}

export default function Sources({ pathId }: { pathId?: string }) {
  const client = useQueryClient()
  const [scope, setScope] = useState<'all' | 'path'>(pathId ? 'path' : 'all')
  const [adding, setAdding] = useState(false)
  const [selected, setSelected] = useState<string | null>(null)
  const filter = scope === 'path' ? pathId : undefined
  const sources = useQuery({
    queryKey: ['sources', filter],
    queryFn: () => api<Source[]>(`/sources${filter ? `?path_id=${filter}` : ''}`),
    refetchInterval: (query) =>
      query.state.data?.some((source) =>
        ['processing', 'pending', 'queued'].includes(source.status),
      )
        ? 2000
        : false,
  })
  const detail = useQuery({
    queryKey: ['source', selected],
    queryFn: () => api<Source>(`/sources/${selected}`),
    enabled: !!selected,
    refetchInterval: (query) =>
      ['pending', 'processing'].includes(query.state.data?.status || '') ? 2000 : false,
  })
  const action = useMutation({
    mutationFn: ({ id, remove }: { id: string; remove: boolean }) =>
      api(`/sources/${id}${remove ? '' : '/retry'}`, remove ? 'DELETE' : 'POST'),
    onSuccess: (_, { id, remove }) => {
      if (remove && selected === id) setSelected(null)
      client.invalidateQueries({ queryKey: ['sources'] })
      client.invalidateQueries({ queryKey: ['source'] })
    },
  })
  return (
    <div className="screen-enter max-w-5xl mx-auto">
      <div className="mb-7 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-light">Your sources</h1>
          <p className="mt-1 text-sm text-[#7A7870]">
            The material behind your learning. Attach sources when creating a journey.
          </p>
        </div>
        <button className="btn" onClick={() => setAdding(true)}>
          <Plus size={15} /> Add Source
        </button>
      </div>
      {pathId && (
        <div className="mb-5 flex gap-2">
          <button
            className={scope === 'all' ? 'btn' : 'btn-secondary'}
            onClick={() => setScope('all')}
          >
            All sources
          </button>
          <button
            className={scope === 'path' ? 'btn' : 'btn-secondary'}
            onClick={() => setScope('path')}
          >
            Current journey
          </button>
        </div>
      )}
      <ErrorNotice error={sources.error || action.error} />
      {sources.isPending && <Loading />}
      {sources.data?.length === 0 && (
        <Empty title="Bring your learning material">
          <p>
            Upload a document, paste text or add a link. Source text and locations stay attached to
            saved evidence.
          </p>
        </Empty>
      )}
      <div className="space-y-3">
        {sources.data?.map((source) => (
          <article key={source.id} className="rounded-xl border border-[#E3E0D8] bg-white p-5">
            <div className="flex items-start gap-3">
              <FileText size={20} className="mt-1 flex-shrink-0 text-[#5B7A58]" />
              <div className="min-w-0 flex-1">
                <button
                  className="text-left font-medium hover:text-[#5B7A58]"
                  onClick={() => setSelected(source.id)}
                >
                  {source.title}
                </button>
                <p className="mt-1 text-xs text-[#A8A5A0]">
                  {source.kind} · {source.chunk_count} passages ·{' '}
                  {source.path_id ? 'Attached to a journey' : 'Available for a new journey'} ·{' '}
                  {date(source.created_at)}
                </p>
                {source.url && (
                  <a
                    href={source.url}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-1 block truncate text-xs text-[#4A5FA5]"
                  >
                    {source.url}
                  </a>
                )}
                <ErrorNotice error={source.error} />
                {source.needs_reindex && (
                  <p className="mt-2 text-xs text-[#946B32]">
                    Reindex needed to match the current embedding settings.
                  </p>
                )}
              </div>
              <Status value={source.status} />
              {['ready', 'failed'].includes(source.status) && (
                <button
                  title={source.status === 'failed' ? 'Retry source' : 'Reindex source'}
                  aria-label={`${source.status === 'failed' ? 'Retry' : 'Reindex'} ${source.title}`}
                  className="btn-secondary"
                  disabled={action.isPending}
                  onClick={() => action.mutate({ id: source.id, remove: false })}
                >
                  <RefreshCw size={16} />
                  {source.status === 'failed' ? 'Retry' : 'Reindex'}
                </button>
              )}
              <button
                aria-label={`Delete ${source.title}`}
                className="icon-button"
                disabled={action.isPending || ['pending', 'processing'].includes(source.status)}
                onClick={() => {
                  if (confirm('Remove this source? Previously saved evidence will remain.'))
                    action.mutate({ id: source.id, remove: true })
                }}
              >
                <Trash2 size={16} />
              </button>
            </div>
          </article>
        ))}
      </div>
      {adding && (
        <Modal title="Add learning material" onClose={() => setAdding(false)}>
          <p className="mb-4 text-sm text-[#7A7870]">
            {filter
              ? 'This source will be attached to the current journey.'
              : 'This source will be available when creating a journey.'}
          </p>
          <SourceForm pathId={filter} onDone={() => setAdding(false)} />
        </Modal>
      )}
      {selected && (
        <Modal title={detail.data?.title || 'Source passages'} onClose={() => setSelected(null)}>
          {detail.isPending ? (
            <Loading />
          ) : (
            <>
              <ErrorNotice error={detail.error || detail.data?.error || action.error} />
              {detail.data && (
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                  <Status value={detail.data.status} />
                  {['ready', 'failed'].includes(detail.data.status) && (
                    <button
                      className="btn-secondary"
                      disabled={action.isPending}
                      onClick={() => action.mutate({ id: detail.data!.id, remove: false })}
                    >
                      <RefreshCw size={14} />{' '}
                      {detail.data.status === 'failed' ? 'Retry source' : 'Reindex source'}
                    </button>
                  )}
                </div>
              )}
              {detail.data?.needs_reindex && (
                <p className="mb-4 text-sm text-[#946B32]">
                  Reindex this source before using it with the current embedding settings.
                </p>
              )}
              {detail.data?.excerpts?.map((excerpt, index) => (
                <div key={index} className="mb-4 border-b border-[#E3E0D8] pb-4">
                  <p className="mb-1 text-xs text-[#A8A5A0]">
                    {excerpt.location || `Passage ${index + 1}`}
                  </p>
                  <p className="whitespace-pre-wrap text-sm">
                    {excerpt.content || excerpt.text || excerpt.excerpt}
                  </p>
                </div>
              ))}
            </>
          )}
        </Modal>
      )}
    </div>
  )
}
