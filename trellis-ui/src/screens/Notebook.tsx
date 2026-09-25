import { useState } from 'react'
import Link from 'next/link'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowDown, ArrowUp, Download, FileText, Pencil, Plus, Search, Trash2 } from 'lucide-react'
import {
  api,
  date,
  type Navigate,
  type NotebookItem,
  type NotebookPage,
  type Workspace,
} from '../lib/api'
import { Empty, ErrorNotice, Loading, Markdown, Modal } from '../components/ui'
import SaveToNotebook from '../components/SaveToNotebook'

export default function Notebook({
  pathId,
  onNavigate,
}: {
  pathId?: string
  onNavigate: Navigate
}) {
  const client = useQueryClient()
  const [pageId, setPageId] = useState('all')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [newNote, setNewNote] = useState(false)
  const [noteSaved, setNoteSaved] = useState(false)
  const [pageEditor, setPageEditor] = useState<NotebookPage | 'new' | null>(null)
  const [pageTitle, setPageTitle] = useState('')
  const [editing, setEditing] = useState(false)
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const workspace = useQuery({
    queryKey: ['workspace'],
    queryFn: () => api<Workspace>('/workspace'),
  })
  const journey = workspace.data?.paths.find((path) => path.id === pathId)
  const pages = useQuery({
    queryKey: ['notebook', pathId],
    queryFn: () => api<NotebookPage[]>(`/notebook/pages?path_id=${encodeURIComponent(pathId!)}`),
    enabled: !!pathId,
  })
  const action = useMutation({
    mutationFn: ({ path, method, body }: { path: string; method: string; body?: unknown }) =>
      api(path, method, body),
    onSuccess: (data, variables) => {
      client.invalidateQueries({ queryKey: ['notebook'] })
      client.invalidateQueries({ queryKey: ['study-sets'] })
      client.invalidateQueries({ queryKey: ['workspace'] })
      client.invalidateQueries({ queryKey: ['learning-sessions'] })
      client.invalidateQueries({ queryKey: ['history'] })
      if (variables.path === '/notebook/pages' && variables.method === 'POST') {
        setPageId((data as NotebookPage).id)
        setSelectedId(null)
      }
      if (variables.method === 'DELETE' && variables.path === `/notebook/pages/${pageId}`)
        setPageId('all')
      setEditing(false)
      setPageEditor(null)
    },
  })
  const all = pages.data?.flatMap((page) => page.items) || []
  const items = all.filter(
    (item) =>
      (pageId === 'all' || item.page_id === pageId) &&
      `${item.title} ${item.content}`.toLowerCase().includes(search.toLowerCase()),
  )
  const selected = items.find((item) => item.id === selectedId) || items[0]
  const selectedPage = pages.data?.find((page) => page.id === selected?.page_id)
  function reorder(item: NotebookItem, delta: number) {
    const page = pages.data!.find((candidate) => candidate.id === item.page_id)!
    const ids = page.items.map((candidate) => candidate.id)
    const index = ids.indexOf(item.id)
    ;[ids[index], ids[index + delta]] = [ids[index + delta], ids[index]]
    action.mutate({
      path: `/notebook/pages/${page.id}/reorder`,
      method: 'POST',
      body: { item_ids: ids },
    })
  }
  return (
    <div className="screen-enter">
      <div className="mb-7 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-light">
            {journey ? `${journey.title} notebook` : 'Your notebooks'}
          </h1>
          <p className="mt-1 text-sm text-[#7A7870]">
            Group related notes into sections, in your own order.
          </p>
        </div>
        <div className="flex gap-2">
          {journey && (
            <Link
              className="btn-secondary"
              href={`/?screen=session&path=${encodeURIComponent(journey.id)}`}
            >
              <Download size={14} /> Study & export
            </Link>
          )}
          <button
            className="btn"
            disabled={!journey}
            onClick={() => {
              setNoteSaved(false)
              action.reset()
              setNewNote(true)
            }}
          >
            <Plus size={14} /> New note
          </button>
        </div>
      </div>
      <div className="mb-6 max-w-md">
        <label className="field-label" htmlFor="notebook-journey">
          Learning journey
        </label>
        <select
          id="notebook-journey"
          className="field"
          value={journey?.id || ''}
          disabled={workspace.isPending}
          onChange={(event) => onNavigate('notebook', { path_id: event.target.value })}
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
        <p className="mt-2 text-xs text-[#7A7870]">
          Each journey has its own notebook. Your study resume position stays the same.
        </p>
      </div>
      <ErrorNotice error={workspace.error || pages.error || action.error} />
      {noteSaved && (
        <p role="status" className="mb-4 rounded-lg bg-[#EFF4EE] p-3 text-sm text-[#5B7A58]">
          Note saved to Notebook
        </p>
      )}
      {workspace.isPending ? (
        <Loading />
      ) : !journey ? (
        <Empty title="Choose a learning journey">
          <p>Open a journey’s notebook to create sections and keep your notes together.</p>
        </Empty>
      ) : pages.isPending ? (
        <Loading />
      ) : (
        <div className="flex flex-col gap-5 lg:flex-row">
          <aside className="w-full flex-shrink-0 lg:w-44">
            <button
              className={`mb-1 w-full rounded-lg px-3 py-2 text-left text-sm ${
                pageId === 'all' ? 'bg-[#2D2C28] text-white' : 'text-[#7A7870]'
              }`}
              onClick={() => {
                action.reset()
                setPageId('all')
                setEditing(false)
              }}
            >
              All notes <span className="float-right text-xs opacity-60">{all.length}</span>
            </button>
            {pages.data?.map((page) => (
              <div key={page.id} className="group flex items-center">
                <button
                  className={`min-w-0 flex-1 rounded-lg px-3 py-2 text-left text-sm ${
                    pageId === page.id ? 'bg-white text-[#1A1916]' : 'text-[#7A7870]'
                  }`}
                  onClick={() => {
                    action.reset()
                    setPageId(page.id)
                    setEditing(false)
                  }}
                >
                  <span className="block truncate">{page.title}</span>
                </button>
                <button
                  className="icon-button"
                  aria-label={`Edit section ${page.title}`}
                  onClick={() => {
                    action.reset()
                    setPageTitle(page.title)
                    setPageEditor(page)
                  }}
                >
                  <Pencil size={12} />
                </button>
              </div>
            ))}
            <button
              className="mt-4 flex items-center gap-1 px-3 text-xs text-[#5B7A58]"
              onClick={() => {
                action.reset()
                setPageTitle('')
                setPageEditor('new')
              }}
            >
              <Plus size={13} /> New section
            </button>
          </aside>
          <section className="w-full flex-shrink-0 lg:w-64 xl:w-72">
            <div className="relative mb-4">
              <Search className="absolute left-3 top-3 text-[#A8A5A0]" size={14} />
              <input
                aria-label="Search notebook"
                className="field !pl-9 !text-xs"
                placeholder="Search notes…"
                value={search}
                onChange={(event) => {
                  action.reset()
                  setSearch(event.target.value)
                  setEditing(false)
                }}
              />
            </div>
            {items.length === 0 && (
              <Empty title="A place for your ideas">
                <p>Save an explanation from a learning node, or write your own note.</p>
              </Empty>
            )}
            <div className="space-y-2">
              {items.map((item) => (
                <button
                  key={item.id}
                  className={`w-full rounded-lg border p-4 text-left ${
                    selected?.id === item.id
                      ? 'border-[#C5D9C4] bg-[#EFF4EE]'
                      : 'border-[#E3E0D8] bg-white'
                  }`}
                  onClick={() => {
                    setSelectedId(item.id)
                    setEditing(false)
                  }}
                >
                  <p className="text-sm font-medium">{item.title}</p>
                  <div className="mt-2 text-[#7A7870]">
                    <Markdown compact>{item.content}</Markdown>
                  </div>
                  <p className="mt-2 text-[10px] text-[#A8A5A0]">
                    {pages.data?.find((page) => page.id === item.page_id)?.title}
                  </p>
                </button>
              ))}
            </div>
          </section>
          {selected && (
            <article className="min-w-0 flex-1 rounded-xl border border-[#E3E0D8] bg-white p-5 lg:p-7">
              <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
                <p className="text-xs text-[#A8A5A0]">{date(selected.created_at)}</p>
                <div className="flex gap-1">
                  <button
                    aria-label="Move note up"
                    className="icon-button"
                    disabled={action.isPending || selectedPage?.items[0]?.id === selected.id}
                    onClick={() => reorder(selected, -1)}
                  >
                    <ArrowUp size={14} />
                  </button>
                  <button
                    aria-label="Move note down"
                    className="icon-button"
                    disabled={action.isPending || selectedPage?.items.at(-1)?.id === selected.id}
                    onClick={() => reorder(selected, 1)}
                  >
                    <ArrowDown size={14} />
                  </button>
                  <button
                    aria-label="Edit selected note"
                    className="icon-button"
                    onClick={() => {
                      action.reset()
                      setTitle(selected.title)
                      setContent(selected.content)
                      setEditing(true)
                    }}
                  >
                    <Pencil size={14} />
                  </button>
                  <button
                    aria-label="Delete selected note"
                    className="icon-button"
                    disabled={action.isPending}
                    onClick={() => {
                      if (confirm('Delete this note? Existing PDF exports will remain unchanged.'))
                        action.mutate({
                          path: `/notebook/items/${selected.id}`,
                          method: 'DELETE',
                        })
                    }}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
              {editing ? (
                <form
                  onSubmit={(event) => {
                    event.preventDefault()
                    if (!title.trim() || !content.trim()) return
                    action.mutate({
                      path: `/notebook/items/${selected.id}`,
                      method: 'PATCH',
                      body: { title: title.trim(), content: content.trim() },
                    })
                  }}
                >
                  <label htmlFor="edit-note-title" className="field-label">
                    Title
                  </label>
                  <input
                    id="edit-note-title"
                    disabled={action.isPending}
                    maxLength={200}
                    className="field"
                    required
                    value={title}
                    onChange={(event) => setTitle(event.target.value)}
                  />
                  <label htmlFor="edit-note-content" className="field-label">
                    Content · Markdown supported
                  </label>
                  <textarea
                    id="edit-note-content"
                    disabled={action.isPending}
                    className="field min-h-64 font-mono !text-xs"
                    required
                    value={content}
                    onChange={(event) => setContent(event.target.value)}
                  />
                  <div className="mt-4 flex gap-2">
                    <button
                      className="btn"
                      disabled={action.isPending || !title.trim() || !content.trim()}
                    >
                      Save note
                    </button>
                    <button
                      className="btn-secondary"
                      type="button"
                      onClick={() => {
                        setEditing(false)
                        action.reset()
                      }}
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              ) : (
                <>
                  <h2 className="mb-5 font-display text-2xl">{selected.title}</h2>
                  <Markdown>{selected.content}</Markdown>
                </>
              )}
              <div className="mt-8 border-t border-[#E3E0D8] pt-5">
                <label htmlFor="move-page" className="field-label">
                  Notebook section
                </label>
                <select
                  id="move-page"
                  className="field"
                  value={selected.page_id}
                  disabled={action.isPending}
                  onChange={(event) =>
                    action.mutate({
                      path: `/notebook/items/${selected.id}`,
                      method: 'PATCH',
                      body: { page_id: event.target.value },
                    })
                  }
                >
                  {pages.data?.map((page) => (
                    <option key={page.id} value={page.id}>
                      {page.title}
                    </option>
                  ))}
                </select>
              </div>
              {selected.origin && Object.keys(selected.origin).length > 0 && (
                <details className="mt-5">
                  <summary className="cursor-pointer text-xs text-[#7A7870]">
                    Original learning context
                  </summary>
                  <dl className="mt-3 space-y-2 text-xs">
                    {Object.entries(selected.origin)
                      .filter(([key]) =>
                        [
                          'path_title',
                          'node_title',
                          'thread_title',
                          'prompt',
                          'provider',
                          'model',
                          'created_at',
                        ].includes(key),
                      )
                      .map(([key, value]) => (
                        <div key={key}>
                          <dt className="text-[#A8A5A0]">{key.replaceAll('_', ' ')}</dt>
                          <dd className="mt-1 whitespace-pre-wrap">
                            {typeof value === 'object'
                              ? JSON.stringify(value)
                              : String(value || '')}
                          </dd>
                        </div>
                      ))}
                  </dl>
                </details>
              )}
              {!!selected.evidence?.length && (
                <div className="mt-5">
                  <p className="mb-3 text-xs font-medium text-[#7A7870]">Saved sources</p>
                  {selected.evidence.map((evidence, index) => (
                    <div
                      className="mb-3 rounded-lg bg-[#F7F6F2] p-3 text-xs"
                      key={`${evidence.id}:${index}`}
                    >
                      <p className="font-medium">
                        [{index + 1}] {evidence.title}
                      </p>
                      <p className="my-2 text-[#7A7870]">{evidence.excerpt}</p>
                      {evidence.url && (
                        <a
                          className="text-[#4A5FA5]"
                          target="_blank"
                          rel="noreferrer"
                          href={evidence.url}
                        >
                          Open source ↗
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </article>
          )}
        </div>
      )}
      {newNote && journey && (
        <SaveToNotebook
          pathId={journey.id}
          journeyTitle={journey.title}
          payload={{ title: '', content: '' }}
          initialPageId={pageId === 'all' ? undefined : pageId}
          onClose={() => setNewNote(false)}
          onSaved={() => {
            setNewNote(false)
            setNoteSaved(true)
          }}
        />
      )}
      {pageEditor && (
        <Modal
          title={pageEditor === 'new' ? 'New notebook section' : 'Edit notebook section'}
          onClose={() => {
            setPageEditor(null)
            action.reset()
          }}
        >
          <form
            onSubmit={(event) => {
              event.preventDefault()
              action.mutate({
                path: pageEditor === 'new' ? '/notebook/pages' : `/notebook/pages/${pageEditor.id}`,
                method: pageEditor === 'new' ? 'POST' : 'PATCH',
                body: {
                  title: pageTitle.trim(),
                  ...(pageEditor === 'new' ? { path_id: pathId } : {}),
                },
              })
            }}
          >
            <label htmlFor="page-title" className="field-label">
              Section title
            </label>
            <input
              id="page-title"
              disabled={action.isPending}
              maxLength={200}
              className="field"
              required
              value={pageTitle}
              onChange={(event) => setPageTitle(event.target.value)}
            />
            <ErrorNotice error={action.error} />
            {pageEditor !== 'new' && (
              <div className="mt-4 flex gap-2">
                <button
                  type="button"
                  className="btn-secondary"
                  disabled={action.isPending || pageEditor.position === 0}
                  onClick={() =>
                    action.mutate({
                      path: `/notebook/pages/${pageEditor.id}`,
                      method: 'PATCH',
                      body: { position: pageEditor.position - 1 },
                    })
                  }
                >
                  <ArrowUp size={14} /> Move section earlier
                </button>
                <button
                  type="button"
                  className="btn-secondary"
                  disabled={
                    action.isPending || pageEditor.position === (pages.data?.length || 1) - 1
                  }
                  onClick={() =>
                    action.mutate({
                      path: `/notebook/pages/${pageEditor.id}`,
                      method: 'PATCH',
                      body: { position: pageEditor.position + 1 },
                    })
                  }
                >
                  <ArrowDown size={14} /> Move section later
                </button>
              </div>
            )}
            <div className="mt-5 flex justify-between gap-2">
              {pageEditor !== 'new' && (
                <button
                  type="button"
                  className="btn-danger"
                  disabled={action.isPending || pageEditor.items.length > 0}
                  onClick={() =>
                    action.mutate({
                      path: `/notebook/pages/${pageEditor.id}`,
                      method: 'DELETE',
                    })
                  }
                >
                  Delete empty section
                </button>
              )}
              <button className="btn ml-auto" disabled={action.isPending || !pageTitle.trim()}>
                Save section
              </button>
            </div>
            {pageEditor !== 'new' && pageEditor.items.length > 0 && (
              <p className="mt-3 text-xs text-[#7A7870]">
                Move or delete this section’s notes before removing the section.
              </p>
            )}
          </form>
        </Modal>
      )}
    </div>
  )
}
