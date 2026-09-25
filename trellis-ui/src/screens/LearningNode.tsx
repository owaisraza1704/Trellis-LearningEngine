import { useEffect, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  ArrowLeft,
  ArrowRight,
  Bookmark,
  Check,
  ChevronRight,
  CornerUpRight,
  Plus,
  RotateCcw,
  Send,
} from 'lucide-react'
import {
  api,
  date,
  type Evidence,
  type Interaction,
  type Navigate,
  type NodeDetail,
  type NotebookPage,
  type Thread,
  type ThreadDetail,
} from '../lib/api'
import { Empty, ErrorNotice, Loading, Markdown, Modal, Status } from '../components/ui'
import SaveToNotebook from '../components/SaveToNotebook'
import { assessmentText, responseFeedback } from '../lib/response'

export default function LearningNode(props: {
  nodeId?: string
  threadId?: string
  onNavigate: Navigate
}) {
  if (!props.nodeId)
    return (
      <div className="p-8">
        <Empty title="Choose a topic to start learning">
          <button className="btn mt-3" onClick={() => props.onNavigate('graph')}>
            Open your curriculum
          </button>
        </Empty>
      </div>
    )
  return (
    <NodeWorkspace
      key={`${props.nodeId}:${props.threadId || 'primary'}`}
      {...props}
      nodeId={props.nodeId}
    />
  )
}

function NodeWorkspace({
  nodeId,
  threadId,
  onNavigate,
}: {
  nodeId: string
  threadId?: string
  onNavigate: Navigate
}) {
  const client = useQueryClient()
  const [prompt, setPrompt] = useState('')
  const [rightPanel, setRightPanel] = useState('ai')
  const [selected, setSelected] = useState<string | null>(null)
  const readingKey = `trellis:reading:${nodeId}:${threadId || 'primary'}`
  useEffect(() => {
    setSelected(localStorage.getItem(readingKey))
  }, [readingKey])
  useEffect(() => {
    if (selected) localStorage.setItem(readingKey, selected)
  }, [readingKey, selected])
  const [threadTitle, setThreadTitle] = useState('')
  const [creatingThread, setCreatingThread] = useState(false)
  const [savePayload, setSavePayload] = useState<{
    interaction_id?: string
    evidence_id?: string
    title?: string
  } | null>(null)
  const [saved, setSaved] = useState(false)
  const messagesEnd = useRef<HTMLDivElement>(null)
  const node = useQuery({
    queryKey: ['node', nodeId],
    queryFn: () => api<NodeDetail>(`/nodes/${nodeId}`),
  })
  const thread = useQuery({
    queryKey: ['thread', threadId],
    queryFn: () => api<ThreadDetail>(`/threads/${threadId}`),
    enabled: !!threadId,
  })
  const notebook = useQuery({
    queryKey: ['notebook', node.data?.path.id],
    queryFn: () =>
      api<NotebookPage[]>(`/notebook/pages?path_id=${encodeURIComponent(node.data!.path.id)}`),
    enabled: rightPanel === 'notebook' && !!node.data?.path.id,
  })
  const interactions = threadId ? thread.data?.interactions || [] : node.data?.interactions || []
  const active =
    interactions.find((item) => item.id === selected) || interactions[interactions.length - 1]
  const send = useMutation({
    mutationFn: ({
      text,
      action = 'question',
    }: {
      text: string
      action?: string
      fromComposer?: boolean
    }) =>
      api<Interaction>(
        threadId ? `/threads/${threadId}/interactions` : `/nodes/${nodeId}/interactions`,
        'POST',
        { prompt: text, action },
      ),
    onSuccess: (data, variables) => {
      if (variables.fromComposer) {
        setPrompt((current) => (current === variables.text ? '' : current))
      }
      setSelected(data.id)
      client.invalidateQueries({
        queryKey: [threadId ? 'thread' : 'node', threadId || nodeId],
      })
      client.invalidateQueries({ queryKey: ['history'] })
      client.invalidateQueries({ queryKey: ['workspace'] })
    },
  })
  const update = useMutation({
    mutationFn: ({ path, body }: { path: string; body: unknown }) => api(path, 'PATCH', body),
    onSuccess: () => client.invalidateQueries(),
  })
  const createThread = useMutation({
    mutationFn: () =>
      api<Thread>(`/nodes/${nodeId}/threads`, 'POST', {
        title: threadTitle,
        interaction_id: threadId ? undefined : active?.id,
      }),
    onSuccess: (data) => {
      setCreatingThread(false)
      client.invalidateQueries({ queryKey: ['node', nodeId] })
      onNavigate('node', {
        path_id: data.path_id,
        node_id: nodeId,
        thread_id: data.id,
      })
    },
  })
  useEffect(() => {
    messagesEnd.current?.scrollIntoView({
      behavior: 'smooth',
      block: 'nearest',
    })
  }, [interactions.length, send.isPending])
  if (node.isPending || (threadId && thread.isPending))
    return (
      <div className="p-8">
        <Loading />
      </div>
    )
  if (!node.data || (threadId && !thread.data))
    return (
      <div className="p-8">
        <ErrorNotice error={node.error || thread.error} />
      </div>
    )
  const { path, nodes, threads } = node.data
  const current = node.data.node
  const ancestors = []
  let parent = nodes.find((item) => item.id === current.parent_id)
  while (parent) {
    ancestors.unshift(parent)
    parent = nodes.find((item) => item.id === parent!.parent_id)
  }
  const closed = thread.data?.thread.status === 'closed'
  const title = threadId ? thread.data!.thread.title : current.title
  const next = nodes.find(
    (item) => item.id !== nodeId && item.position > current.position && item.status !== 'completed',
  )
  const threadOrigin = { path_id: path.id, node_id: nodeId }
  const abstained = active?.status === 'abstained'
  const warnings = Array.isArray(active?.evaluation?.retrieval_warnings)
    ? active.evaluation.retrieval_warnings.filter(
        (warning): warning is string => typeof warning === 'string',
      )
    : []
  function showEvidence() {
    setRightPanel('evidence')
  }
  return (
    <div className="screen-enter flex min-h-full flex-col xl:h-full xl:flex-row">
      <aside className="w-full flex-shrink-0 border-b border-[#E3E0D8] p-4 xl:w-52 xl:overflow-y-auto xl:border-b-0 xl:border-r">
        <p className="mb-3 text-[10px] uppercase tracking-widest text-[#A8A5A0]">Current path</p>
        <button
          className="mb-2 text-left text-xs text-[#7A7870] hover:text-[#5B7A58]"
          onClick={() => onNavigate('graph', { path_id: path.id })}
        >
          {path.title}
        </button>
        {ancestors.map((item) => (
          <button
            key={item.id}
            className="mb-2 block text-left text-xs text-[#A8A5A0]"
            onClick={() => onNavigate('node', { path_id: path.id, node_id: item.id })}
          >
            › {item.title}
          </button>
        ))}
        <button
          className={`mb-5 block text-left text-sm font-medium ${
            !threadId ? 'text-[#4A5FA5]' : 'text-[#7A7870]'
          }`}
          onClick={() => onNavigate('node', threadOrigin)}
        >
          {current.title}
        </button>
        <div className="mb-5">
          <Status value={current.status} />
        </div>
        <div className="border-t border-[#E3E0D8] pt-4">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-[10px] uppercase tracking-widest text-[#A8A5A0]">
              Exploratory threads
            </p>
            <button
              aria-label="New exploratory thread"
              className="icon-button"
              onClick={() => {
                setThreadTitle('')
                setCreatingThread(true)
              }}
            >
              <Plus size={14} />
            </button>
          </div>
          {threads.length === 0 && (
            <p className="text-xs leading-relaxed text-[#A8A5A0]">
              Explore a related thought while keeping this node focused.
            </p>
          )}
          {threads.map((item) => (
            <button
              key={item.id}
              onClick={() => onNavigate('node', { ...threadOrigin, thread_id: item.id })}
              className={`mb-2 w-full rounded-lg border p-3 text-left ${
                threadId === item.id
                  ? 'border-[#D4DBF0] bg-[#EEF0F9]'
                  : 'border-transparent hover:bg-[#F0EEE9]'
              }`}
            >
              <p className="text-xs font-medium">↗ {item.title}</p>
              <p className="mt-1 text-[10px] text-[#A8A5A0]">{item.status}</p>
            </button>
          ))}
        </div>
      </aside>
      <section className="min-w-0 flex-1 overflow-y-auto px-6 py-6 lg:px-9">
        <div className="mb-5 flex items-center gap-2 text-xs text-[#A8A5A0]">
          <button onClick={() => onNavigate('graph', { path_id: path.id })}>{path.title}</button>
          <ChevronRight size={12} />
          <span className="text-[#7A7870]">
            {threadId ? 'Exploratory thread' : 'Learning node'}
          </span>
        </div>
        <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="font-display text-3xl font-light">{title}</h1>
            <p className="mt-2 text-sm text-[#7A7870]">
              {threadId ? `Exploring from ${current.title}` : current.description}
            </p>
          </div>
          {threadId ? (
            <button
              className="btn-secondary"
              disabled={update.isPending}
              onClick={() =>
                update.mutate({
                  path: `/threads/${threadId}`,
                  body: { status: closed ? 'open' : 'closed' },
                })
              }
            >
              {closed ? 'Reopen thread' : 'Close thread'}
            </button>
          ) : (
            <select
              aria-label="Learning progress"
              className="rounded-lg border border-[#E3E0D8] bg-white p-2 text-xs"
              value={current.status}
              disabled={update.isPending}
              onChange={(event) =>
                update.mutate({
                  path: `/nodes/${nodeId}/progress`,
                  body: { status: event.target.value },
                })
              }
            >
              <option value="not_started">Not started</option>
              <option value="in_progress">In progress</option>
              <option value="completed">Completed</option>
            </select>
          )}
        </div>
        {threadId && (
          <div className="mb-6 rounded-lg border border-[#D4DBF0] bg-[#EEF0F9] p-4">
            <p className="text-sm text-[#4A5FA5]">
              This thread has its own conversation. Your primary node and progress stay intact.
            </p>
            <button
              className="mt-2 inline-flex items-center gap-1 text-xs text-[#4A5FA5]"
              onClick={() => onNavigate('node', threadOrigin)}
            >
              <ArrowLeft size={13} /> Return to Learning Node
            </button>
          </div>
        )}
        <ErrorNotice error={send.error || update.error} />
        {saved && (
          <div
            role="status"
            className="mb-4 flex items-center justify-between rounded-lg bg-[#EFF4EE] p-3 text-sm text-[#5B7A58]"
          >
            <span>Saved to Notebook</span>
            <button onClick={() => onNavigate('notebook')}>Open Notebook →</button>
          </div>
        )}
        {interactions.length === 0 ? (
          <Empty title={threadId ? 'Follow this thought.' : 'Build your understanding.'}>
            <p className="mb-4">
              Ask a question or request an introduction. Answers use the evidence available for this
              journey.
            </p>
            <button
              className="btn"
              disabled={send.isPending || closed}
              onClick={() =>
                send.mutate({
                  text: `Introduce ${title} and explain its main ideas.`,
                  action: 'foundation',
                })
              }
            >
              {send.isPending ? 'Preparing an introduction…' : 'Explain this topic'}
            </button>
          </Empty>
        ) : (
          active && (
            <article>
              <div className="mb-4 flex items-center justify-between gap-2">
                <p className="text-xs text-[#A8A5A0]">
                  {active.action.replaceAll('_', ' ')} · {date(active.created_at)}
                </p>
                <Status value={active.status} label={responseFeedback(active).label} />
              </div>
              <h2 className="mb-5 font-display text-xl">{active.prompt}</h2>
              {abstained ? (
                <div className="rounded-xl border border-[#E6DCC8] bg-[#FBF7ED] p-5">
                  <p className="text-sm leading-relaxed text-[#6F6047]">
                    {responseFeedback(active).message}
                  </p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <button
                      className="btn-secondary"
                      disabled={send.isPending || closed}
                      onClick={() => send.mutate({ text: active.prompt, action: active.action })}
                    >
                      <RotateCcw size={14} /> {send.isPending ? 'Trying again…' : 'Try again'}
                    </button>
                    <button
                      className="btn-secondary"
                      onClick={() => onNavigate('sources', { path_id: path.id })}
                    >
                      Review sources
                    </button>
                  </div>
                </div>
              ) : (
                <Markdown>{active.content}</Markdown>
              )}
              {warnings.length > 0 && (
                <div className="mt-4 rounded-lg border border-[#E6DCC8] bg-[#FBF7ED] p-3 text-xs text-[#6F6047]">
                  <p className="font-medium">Some sources need attention</p>
                  <ul className="mt-2 list-disc space-y-1 pl-4">
                    {warnings.map((warning, index) => (
                      <li key={index}>{assessmentText(warning, active.evidence)}</li>
                    ))}
                  </ul>
                  <button
                    className="mt-2 underline"
                    onClick={() => onNavigate('sources', { path_id: path.id })}
                  >
                    Review source status
                  </button>
                </div>
              )}
              <div className="mt-6 flex flex-wrap gap-2">
                {!abstained && (
                  <button
                    className="btn-secondary"
                    onClick={() => {
                      setSaved(false)
                      setSavePayload({
                        interaction_id: active.id,
                        title: active.prompt,
                      })
                    }}
                  >
                    <Bookmark size={14} /> Save to Notebook
                  </button>
                )}
                <button className="btn-secondary" onClick={showEvidence}>
                  {active.evidence?.length || 0} {abstained ? 'consulted' : 'cited'}{' '}
                  {active.evidence?.length === 1 ? 'passage' : 'passages'}
                </button>
                {!threadId && (
                  <button
                    className="btn-secondary"
                    onClick={() => {
                      setThreadTitle('')
                      setCreatingThread(true)
                    }}
                  >
                    <CornerUpRight size={14} /> Explore Further
                  </button>
                )}
              </div>
              <GroundingAssessment interaction={active} />
            </article>
          )
        )}
        <div className="mt-8 flex flex-wrap gap-2 border-t border-[#E3E0D8] pt-5">
          {[
            {
              action: 'example',
              label: 'Show example',
              text: `Give a practical example of ${title}.`,
            },
            {
              action: 'deeper',
              label: 'Go deeper',
              text: `Explain ${title} in more depth.`,
            },
            {
              action: 'comparison',
              label: 'Compare ideas',
              text: `Compare ${title} with a closely related concept.`,
            },
            {
              action: 'application',
              label: 'Apply it',
              text: `Explain how to apply ${title} in practice.`,
            },
          ].map((item) => (
            <button
              key={item.action}
              className="btn-secondary"
              disabled={send.isPending || closed}
              onClick={() => send.mutate(item)}
            >
              {item.label}
            </button>
          ))}
        </div>
        {!threadId && (
          <div className="mt-8 flex justify-between gap-3 border-t border-[#E3E0D8] pt-5">
            <button
              className="btn-secondary"
              onClick={() => onNavigate('graph', { path_id: path.id })}
            >
              <ArrowLeft size={14} /> Curriculum
            </button>
            {current.status === 'completed' && next ? (
              <button
                className="btn"
                onClick={() => onNavigate('node', { path_id: path.id, node_id: next.id })}
              >
                Next topic <ArrowRight size={14} />
              </button>
            ) : (
              <button
                className="btn"
                disabled={update.isPending || current.status === 'completed'}
                onClick={() =>
                  update.mutate({
                    path: `/nodes/${nodeId}/progress`,
                    body: { status: 'completed' },
                  })
                }
              >
                <Check size={14} /> {current.status === 'completed' ? 'Completed' : 'Mark complete'}
              </button>
            )}
          </div>
        )}
      </section>
      <aside className="flex w-full flex-shrink-0 flex-col border-t border-[#E3E0D8] bg-[#FCFBF8] xl:w-80 xl:border-l xl:border-t-0 2xl:w-96">
        <div className="flex border-b border-[#E3E0D8]">
          {['ai', 'notebook', 'evidence'].map((tab) => (
            <button
              key={tab}
              className={`flex-1 py-4 text-xs capitalize ${
                rightPanel === tab ? 'border-b-2 border-[#5B7A58] text-[#1A1916]' : 'text-[#A8A5A0]'
              }`}
              onClick={() => setRightPanel(tab)}
            >
              {tab === 'ai' ? 'AI' : tab}
            </button>
          ))}
        </div>
        {rightPanel === 'ai' && (
          <div className="flex min-h-[400px] flex-1 flex-col overflow-hidden p-4">
            <div className="mb-4 rounded-lg border border-[#E3E0D8] bg-[#F0EEE9] p-3">
              <p className="text-[10px] uppercase tracking-widest text-[#A8A5A0]">AI Context</p>
              <p className="mt-1 text-xs font-medium text-[#4A5FA5]">{title}</p>
              <p className="mt-1 text-[10px] text-[#7A7870]">
                {threadId ? 'Isolated exploratory thread' : 'Current node and its prerequisites'}
              </p>
            </div>
            <div className="max-h-[50vh] flex-1 space-y-4 overflow-y-auto xl:max-h-none">
              {interactions.map((item) => (
                <div key={item.id}>
                  <button
                    className="ml-auto block max-w-[95%] rounded-xl rounded-br-sm bg-[#2D2C28] px-3 py-2 text-left text-xs text-white"
                    onClick={() => setSelected(item.id)}
                  >
                    {item.prompt}
                  </button>
                  <button
                    aria-label={`Read response to ${item.prompt}`}
                    className={`mt-2 w-full rounded-lg p-2 text-left text-xs leading-relaxed ${
                      active?.id === item.id ? 'bg-[#F0EEE9]' : 'hover:bg-[#F0EEE9]'
                    }`}
                    onClick={() => setSelected(item.id)}
                  >
                    <div className="text-[#5A5850]">
                      <Markdown compact>{responseFeedback(item).message}</Markdown>
                    </div>
                    <span className="mt-2 block text-[10px] text-[#5B7A58]">
                      {item.status === 'abstained' ? 'Answer withheld' : 'Read response'} ·{' '}
                      {item.evidence?.length || 0}{' '}
                      {item.status === 'abstained' ? 'consulted' : 'cited'}{' '}
                      {item.evidence?.length === 1 ? 'passage' : 'passages'}
                    </span>
                  </button>
                </div>
              ))}
              {send.isPending && <Loading label="Reading evidence and composing…" />}
              <div ref={messagesEnd} />
            </div>
            <form
              className="mt-4 border-t border-[#E3E0D8] pt-3"
              onSubmit={(event) => {
                event.preventDefault()
                if (prompt.trim()) send.mutate({ text: prompt, fromComposer: true })
              }}
            >
              <label className="sr-only" htmlFor="node-question">
                Ask about this topic
              </label>
              <textarea
                id="node-question"
                className="field !text-xs"
                rows={3}
                placeholder={closed ? 'Reopen this thread to continue' : 'Ask about this topic…'}
                value={prompt}
                disabled={closed}
                onChange={(event) => setPrompt(event.target.value)}
              />
              <button
                className="btn mt-2 w-full"
                disabled={!prompt.trim() || send.isPending || closed}
              >
                <Send size={13} />
                {send.isPending ? 'Thinking…' : 'Ask Trellis'}
              </button>
            </form>
          </div>
        )}
        {rightPanel === 'evidence' && (
          <div className="flex-1 overflow-y-auto p-4">
            <p className="mb-4 text-xs text-[#7A7870]">
              {abstained
                ? 'Passages consulted for this question. They did not provide enough verified support for an answer.'
                : 'Source passages cited in the selected response.'}
            </p>
            {!active?.evidence?.length && (
              <Empty title={abstained ? 'No usable passages' : 'No cited evidence'}>
                <p>
                  {abstained
                    ? 'Add a relevant source and try the question again.'
                    : 'This response has no supporting source references.'}
                </p>
              </Empty>
            )}
            {active?.evidence?.map((evidence, index) => (
              <EvidenceCard
                key={`${evidence.id}:${index}`}
                evidence={evidence}
                number={index + 1}
                onSave={() => {
                  setSaved(false)
                  setSavePayload({
                    interaction_id: active.id,
                    evidence_id: evidence.id,
                    title: evidence.title,
                  })
                }}
              />
            ))}
          </div>
        )}
        {rightPanel === 'notebook' && (
          <div className="flex-1 overflow-y-auto p-4">
            <button
              className="btn-secondary mb-4 w-full"
              onClick={() => {
                setSaved(false)
                setSavePayload({ title: '' })
              }}
            >
              <Plus size={13} /> Write a note
            </button>
            <ErrorNotice error={notebook.error} />
            {notebook.data?.flatMap((page) =>
              page.items
                .filter((item) => item.node_id === nodeId)
                .map((item) => (
                  <button
                    className="mb-3 block w-full rounded-lg border border-[#E3E0D8] bg-white p-3 text-left"
                    key={item.id}
                    onClick={() => onNavigate('notebook')}
                  >
                    <p className="text-xs font-medium">{item.title}</p>
                    <p className="mt-1 text-[10px] text-[#A8A5A0]">{page.title}</p>
                  </button>
                )),
            )}
            <button className="mt-3 text-xs text-[#5B7A58]" onClick={() => onNavigate('notebook')}>
              Open full notebook →
            </button>
          </div>
        )}
      </aside>
      {creatingThread && (
        <Modal title="Start an exploratory thread" onClose={() => setCreatingThread(false)}>
          <form
            onSubmit={(event) => {
              event.preventDefault()
              createThread.mutate()
            }}
          >
            <p className="mb-4 text-sm text-[#7A7870]">
              {threadId
                ? `A separate conversation starts from the primary topic, ${current.title}.`
                : `A separate conversation starts from this topic${active ? ' and the selected response' : ''}.`}{' '}
              It will not change your primary learning progress.
            </p>
            <label htmlFor="thread-title" className="field-label">
              What would you like to explore?
            </label>
            <input
              id="thread-title"
              maxLength={200}
              className="field"
              required
              value={threadTitle}
              onChange={(event) => setThreadTitle(event.target.value)}
            />
            <ErrorNotice error={createThread.error} />
            <button className="btn mt-5" disabled={createThread.isPending || !threadTitle.trim()}>
              {createThread.isPending ? 'Creating…' : 'Create thread'}
            </button>
          </form>
        </Modal>
      )}
      {savePayload && (
        <SaveToNotebook
          pathId={path.id}
          journeyTitle={path.title}
          payload={{ ...savePayload, node_id: nodeId, thread_id: threadId }}
          scopeLabel={[path.title, current.title, ...(threadId ? [title] : [])].join(' › ')}
          onClose={() => setSavePayload(null)}
          onSaved={() => {
            setSavePayload(null)
            setSaved(true)
          }}
        />
      )}
    </div>
  )
}

function GroundingAssessment({ interaction }: { interaction: Interaction }) {
  const evaluation = interaction.evaluation
  if (!evaluation || Object.keys(evaluation).length === 0) return null
  const explanation =
    evaluation.status === 'evaluation_failed'
      ? ''
      : assessmentText(evaluation.explanation || evaluation.reason, interaction.evidence)
  return (
    <details className="mt-5 border-t border-[#E3E0D8] pt-4">
      <summary className="cursor-pointer text-xs text-[#7A7870]">Grounding assessment</summary>
      <p className="my-3 text-xs text-[#7A7870]">
        {interaction.status === 'abstained'
          ? responseFeedback(interaction).label
          : 'Source checks passed'}
        {evaluation.correction_attempted === true ? ' · A revised draft was also checked.' : ''}
      </p>
      <dl className="grid grid-cols-2 gap-3 text-xs">
        {[
          ['relevance', 'Question relevance'],
          ['completeness', 'Topic coverage'],
          ['consistency', 'Source consistency'],
          ['grounding', 'Support from sources'],
        ].map(([key, label]) => {
          const score = evaluation[key]
          if (typeof score !== 'number' || !Number.isFinite(score)) return null
          return (
            <div key={key}>
              <dt className="text-[#7A7870]">{label}</dt>
              <dd className="mt-1 font-medium text-[#3D3C38]">{Math.round(score * 100)}%</dd>
            </div>
          )
        })}
      </dl>
      {explanation && <p className="mt-3 text-xs leading-relaxed text-[#7A7870]">{explanation}</p>}
      <p className="mt-3 text-[11px] text-[#A8A5A0]">
        Automated checks describe the draft’s support in these passages; they do not guarantee
        factual correctness.
      </p>
    </details>
  )
}

function EvidenceCard({
  evidence,
  number,
  onSave,
}: {
  evidence: Evidence
  number: number
  onSave: () => void
}) {
  return (
    <article className="mb-4 rounded-lg border border-[#E3E0D8] bg-white p-4">
      <p className="text-xs font-medium">
        [{number}] {evidence.title}
      </p>
      <p className="mt-1 text-[10px] text-[#A8A5A0]">
        {evidence.kind}
        {evidence.location ? ` · ${evidence.location}` : ''}
      </p>
      <blockquote className="my-3 whitespace-pre-wrap border-l-2 border-[#C5D9C4] pl-3 text-xs leading-relaxed text-[#7A7870]">
        {evidence.excerpt}
      </blockquote>
      <div className="flex items-center justify-between gap-2">
        {evidence.url && (
          <a
            href={evidence.url}
            target="_blank"
            rel="noreferrer"
            className="text-xs text-[#4A5FA5]"
          >
            Open source ↗
          </a>
        )}
        <button className="text-xs text-[#5B7A58]" onClick={onSave}>
          Save excerpt
        </button>
      </div>
    </article>
  )
}
