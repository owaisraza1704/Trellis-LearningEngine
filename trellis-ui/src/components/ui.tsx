import type { ReactNode } from 'react'
import { LoaderCircle, X } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import * as Dialog from '@radix-ui/react-dialog'
import { repairCitationFences, remarkCitations } from '../lib/markdown'

export function ErrorNotice({ error }: { error?: Error | string | null }) {
  if (!error) return null
  return (
    <div
      role="alert"
      className="my-3 rounded-lg border border-[#EDCEC8] bg-[#FFF4F1] p-3 text-sm text-[#913F37]"
    >
      {typeof error === 'string' ? error : error.message}
    </div>
  )
}
export function Loading({ label = 'Loading…' }: { label?: string }) {
  return (
    <div role="status" className="flex items-center gap-2 py-8 text-sm text-[#7A7870]">
      <LoaderCircle size={16} className="animate-spin" />
      {label}
    </div>
  )
}
export function Empty({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed border-[#D4D0C8] p-8 text-center">
      <p className="font-display text-xl text-[#3D3C38]">{title}</p>
      {children && <div className="mt-3 text-sm text-[#7A7870]">{children}</div>}
    </div>
  )
}
export function Modal({
  title,
  children,
  onClose,
}: {
  title: string
  children: ReactNode
  onClose: () => void
}) {
  return (
    <Dialog.Root
      open
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/25 backdrop-blur-sm" />
        <Dialog.Content
          aria-describedby={undefined}
          className="fixed left-1/2 top-1/2 z-50 max-h-[90vh] w-[calc(100%_-_2.5rem)] max-w-xl -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-xl border border-[#E3E0D8] bg-white p-6 shadow-xl"
        >
          <div className="mb-5 flex items-center justify-between gap-3">
            <Dialog.Title className="font-display text-2xl">{title}</Dialog.Title>
            <button className="icon-button" aria-label="Close dialog" onClick={onClose}>
              <X size={18} />
            </button>
          </div>
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
export function Markdown({
  children,
  compact = false,
  citationCount = 0,
  onCitation,
}: {
  children: string
  compact?: boolean
  citationCount?: number
  onCitation?: (number: number) => void
}) {
  return (
    <div
      className={
        compact
          ? 'line-clamp-4 break-words text-xs leading-relaxed [&_p]:mb-1 [&_pre]:whitespace-pre-wrap [&_li]:ml-3 [&_ul]:list-disc [&_ol]:list-decimal'
          : 'prose-trellis markdown'
      }
    >
      <ReactMarkdown
        remarkPlugins={
          onCitation ? [remarkGfm, [remarkCitations, { count: citationCount }]] : [remarkGfm]
        }
        components={{
          a: ({ children, ...props }) =>
            onCitation && props.href?.startsWith('#trellis-citation-') ? (
              <button
                type="button"
                className="text-[#4A5FA5] underline underline-offset-2"
                aria-label={`View cited passage ${props.href.slice(18)}`}
                onClick={() => onCitation(Number(props.href!.slice(18)))}
              >
                {children}
              </button>
            ) : compact ? (
              <span>{children}</span>
            ) : (
              <a {...props} target="_blank" rel="noreferrer">
                {children}
              </a>
            ),
          ...(compact ? { img: () => null, input: () => null } : {}),
        }}
      >
        {repairCitationFences(children)}
      </ReactMarkdown>
    </div>
  )
}
export function Status({ value, label }: { value: string; label?: string }) {
  const green = ['completed', 'ready', 'succeeded', 'open', 'grounded'].includes(value)
  const bad = ['failed', 'error', 'abstained', 'insufficient_evidence'].includes(value)
  return (
    <span
      className={`rounded px-2 py-0.5 text-[11px] whitespace-nowrap ${
        green
          ? 'bg-[#EFF4EE] text-[#5B7A58]'
          : bad
            ? 'bg-[#FFF0EC] text-[#A8554E]'
            : 'bg-[#EEF0F9] text-[#4A5FA5]'
      }`}
    >
      {label || value.replaceAll('_', ' ')}
    </span>
  )
}
