import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { RefreshCw } from 'lucide-react'
import { api, type Source } from '../lib/api'
import { sourceOriginLabel } from '../lib/source'
import { ErrorNotice, Loading, Modal, Status } from './ui'

export function SourcePreview({ sourceId, onClose }: { sourceId: string; onClose: () => void }) {
  const client = useQueryClient()
  const detail = useQuery({
    queryKey: ['source', sourceId],
    queryFn: () => api<Source>(`/sources/${sourceId}`),
    refetchInterval: (query) =>
      ['pending', 'processing', 'queued'].includes(query.state.data?.status || '') ? 2000 : false,
  })
  const reindex = useMutation({
    mutationFn: () => api(`/sources/${sourceId}/retry`, 'POST'),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: ['sources'] })
      client.invalidateQueries({ queryKey: ['source', sourceId] })
    },
  })
  const source = detail.data
  return (
    <Modal title={source?.title || 'Source preview'} onClose={onClose}>
      {detail.isPending ? (
        <Loading />
      ) : (
        <>
          <ErrorNotice error={detail.error || source?.error || reindex.error} />
          {source && (
            <>
              <p className="mb-2 text-sm text-[#7A7870]">
                {sourceOriginLabel(source.kind)} · {source.chunk_count}{' '}
                {source.chunk_count === 1 ? 'passage' : 'passages'}
              </p>
              {source.url && (
                <a
                  href={source.url}
                  target="_blank"
                  rel="noreferrer"
                  className="mb-4 block break-all text-sm text-[#4A5FA5]"
                >
                  {source.url} ↗
                </a>
              )}
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <Status value={source.status} />
                {['ready', 'failed'].includes(source.status) && (
                  <button
                    type="button"
                    className="btn-secondary"
                    disabled={reindex.isPending}
                    onClick={() => reindex.mutate()}
                  >
                    <RefreshCw size={14} />{' '}
                    {source.status === 'failed' ? 'Retry source' : 'Reindex source'}
                  </button>
                )}
              </div>
              {source.needs_reindex && (
                <p className="mb-4 text-sm text-[#946B32]">
                  Reindex this source before using it with the current embedding settings.
                </p>
              )}
              {source.excerpts?.map((excerpt, index) => (
                <div key={index} className="mb-4 border-b border-[#E3E0D8] pb-4">
                  <p className="mb-1 text-xs text-[#A8A5A0]">
                    {excerpt.location || `Passage ${index + 1}`}
                  </p>
                  <p className="whitespace-pre-wrap text-sm">
                    {excerpt.content || excerpt.text || excerpt.excerpt}
                  </p>
                </div>
              ))}
              {!source.excerpts?.length && (
                <p className="text-sm text-[#7A7870]">
                  {['pending', 'processing', 'queued'].includes(source.status)
                    ? 'Passages will appear here after processing.'
                    : 'No indexed passages are available.'}
                </p>
              )}
            </>
          )}
        </>
      )}
    </Modal>
  )
}
