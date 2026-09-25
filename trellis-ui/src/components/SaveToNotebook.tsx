import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api, type NotebookPage } from '../lib/api'
import { Plus } from 'lucide-react'
import { ErrorNotice, Loading, Modal } from './ui'

export default function SaveToNotebook({
  payload,
  pathId,
  journeyTitle,
  initialPageId,
  scopeLabel,
  onClose,
  onSaved,
}: {
  payload: {
    interaction_id?: string
    evidence_id?: string
    node_id?: string
    thread_id?: string
    title?: string
    content?: string
  }
  pathId: string
  journeyTitle: string
  initialPageId?: string
  scopeLabel?: string
  onClose: () => void
  onSaved: () => void
}) {
  const client = useQueryClient()
  const pages = useQuery({
    queryKey: ['notebook', pathId],
    queryFn: () => api<NotebookPage[]>(`/notebook/pages?path_id=${encodeURIComponent(pathId)}`),
  })
  const [pageId, setPageId] = useState(initialPageId || '')
  const [newPage, setNewPage] = useState('')
  const [title, setTitle] = useState(payload.title?.slice(0, 200) || '')
  const [content, setContent] = useState(payload.content || '')
  const [createPage, setCreatePage] = useState(false)
  const creatingPage = createPage || pages.data?.length === 0
  const save = useMutation({
    mutationFn: async () => {
      let target = pageId
      if (creatingPage) {
        const page = await api<NotebookPage>('/notebook/pages', 'POST', {
          path_id: pathId,
          title: newPage.trim(),
        })
        target = page.id
        // Keep the newly created destination if saving the item needs another attempt.
        client.setQueryData<NotebookPage[]>(['notebook', pathId], (existing) => [
          ...(existing || []),
          page,
        ])
        setPageId(page.id)
        setCreatePage(false)
      }
      return api('/notebook/items', 'POST', {
        ...payload,
        page_id: target,
        title: title.trim(),
        ...(!payload.interaction_id ? { content: content.trim() } : {}),
      })
    },
    onSuccess: () => {
      client.invalidateQueries({ queryKey: ['notebook'] })
      client.invalidateQueries({ queryKey: ['workspace'] })
      client.invalidateQueries({ queryKey: ['learning-sessions'] })
      client.invalidateQueries({ queryKey: ['history'] })
      onSaved()
    },
  })
  const canSave =
    !save.isPending &&
    !pages.isPending &&
    !pages.error &&
    !!title.trim() &&
    (!!payload.interaction_id || !!content.trim()) &&
    (creatingPage ? !!newPage.trim() : !!pages.data?.some((page) => page.id === pageId))
  return (
    <Modal title={payload.interaction_id ? 'Save to Notebook' : 'Write a note'} onClose={onClose}>
      <form
        onSubmit={(event) => {
          event.preventDefault()
          if (canSave) save.mutate()
        }}
      >
        <div className="mb-4 rounded-lg bg-[#F5F4EF] px-3 py-2 text-xs text-[#7A7870]">
          <p className="font-medium text-[#3D3C38]">{journeyTitle} notebook</p>
          <p className="mt-1">
            {scopeLabel
              ? `Learning context: ${scopeLabel}`
              : 'Personal note · choose a section in this journey.'}
          </p>
        </div>
        <fieldset disabled={save.isPending}>
          <label className="field-label" htmlFor="save-title">
            Note title
          </label>
          <input
            id="save-title"
            maxLength={200}
            className="field"
            required
            value={title}
            onChange={(event) => setTitle(event.target.value)}
          />
          {!payload.interaction_id && (
            <>
              <label htmlFor="save-content" className="field-label">
                Your note
              </label>
              <textarea
                id="save-content"
                className="field min-h-36"
                required
                value={content}
                onChange={(event) => setContent(event.target.value)}
              />
            </>
          )}
          {pages.isPending && <Loading label="Loading notebook sections…" />}
          {!!pages.data?.length && (
            <>
              <label htmlFor="save-page" className="field-label">
                Notebook section
              </label>
              <div className="flex flex-wrap gap-2">
                <select
                  id="save-page"
                  className="field min-w-0 flex-1 basis-52"
                  value={creatingPage ? '' : pageId}
                  onChange={(event) => {
                    setCreatePage(false)
                    setPageId(event.target.value)
                    save.reset()
                  }}
                >
                  <option value="" disabled>
                    Choose a notebook section
                  </option>
                  {pages.data.map((page) => (
                    <option key={page.id} value={page.id}>
                      {page.title}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  className="btn-secondary"
                  aria-pressed={creatingPage}
                  onClick={() => {
                    setCreatePage(true)
                    save.reset()
                  }}
                >
                  <Plus size={14} /> Create section
                </button>
              </div>
            </>
          )}
          {creatingPage && (
            <>
              <label htmlFor="new-save-page" className="field-label">
                New section title
              </label>
              <input
                id="new-save-page"
                maxLength={200}
                className="field"
                required
                value={newPage}
                onChange={(event) => setNewPage(event.target.value)}
                placeholder="e.g. Key ideas"
              />
            </>
          )}
        </fieldset>
        <p className="mt-3 text-xs text-[#7A7870]">
          Sections group related notes and can keep growing. PDF pages are created automatically
          when you export.
        </p>
        <ErrorNotice error={pages.error || save.error} />
        {payload.interaction_id && (
          <p className="mt-4 text-xs text-[#7A7870]">
            The response and its source references are saved with their original context.
          </p>
        )}
        <button className="btn mt-5" disabled={!canSave}>
          {save.isPending ? 'Saving…' : 'Save to Notebook'}
        </button>
      </form>
    </Modal>
  )
}
