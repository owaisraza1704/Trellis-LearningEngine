import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Background, Controls, ReactFlow } from '@xyflow/react'
import dagre from '@dagrejs/dagre'
import { ArrowDown, ArrowUp, ArrowRight, List, Network, Pencil, Plus, Trash2 } from 'lucide-react'
import '@xyflow/react/dist/style.css'
import {
  api,
  date,
  type LearningNode,
  type Navigate,
  type PathDetail,
  type PathSummary,
  type Workspace,
} from '../lib/api'
import { Empty, ErrorNotice, Loading, Modal, Status } from '../components/ui'
import { assessmentText } from '../lib/response'

function NodeEditor({
  node,
  nodes,
  pathId,
  onDone,
}: {
  node?: LearningNode
  nodes: LearningNode[]
  pathId: string
  onDone: () => void
}) {
  const client = useQueryClient()
  const [title, setTitle] = useState(node?.title || '')
  const [description, setDescription] = useState(node?.description || '')
  const [parent, setParent] = useState(node?.parent_id || '')
  const save = useMutation({
    mutationFn: () =>
      api(node ? `/nodes/${node.id}` : `/paths/${pathId}/nodes`, node ? 'PATCH' : 'POST', {
        title,
        description,
        parent_id: parent || null,
      }),
    onSuccess: () => {
      client.invalidateQueries()
      onDone()
    },
  })
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault()
        save.mutate()
      }}
    >
      <label className="field-label" htmlFor="node-title">
        Title
      </label>
      <input
        id="node-title"
        maxLength={200}
        className="field"
        required
        value={title}
        onChange={(event) => setTitle(event.target.value)}
      />
      <label className="field-label" htmlFor="node-description">
        What this topic covers
      </label>
      <textarea
        id="node-description"
        className="field min-h-24"
        value={description}
        onChange={(event) => setDescription(event.target.value)}
      />
      <label className="field-label" htmlFor="node-parent">
        Parent topic
      </label>
      <select
        id="node-parent"
        className="field"
        value={parent}
        onChange={(event) => setParent(event.target.value)}
      >
        <option value="">Top level</option>
        {nodes
          .filter((item) => item.id !== node?.id)
          .map((item) => (
            <option key={item.id} value={item.id}>
              {item.title}
            </option>
          ))}
      </select>
      <ErrorNotice error={save.error} />
      <div className="mt-5 flex justify-end gap-2">
        <button type="button" className="btn-secondary" onClick={onDone}>
          Cancel
        </button>
        <button className="btn" disabled={save.isPending || !title.trim()}>
          {save.isPending ? 'Saving…' : node ? 'Save topic' : 'Add Topic'}
        </button>
      </div>
    </form>
  )
}

export default function CurriculumGraph({
  pathId,
  onNavigate,
}: {
  pathId?: string
  onNavigate: Navigate
}) {
  const client = useQueryClient()
  const [view, setView] = useState<'graph' | 'list'>('graph')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [editor, setEditor] = useState<LearningNode | 'new' | null>(null)
  const [editingPath, setEditingPath] = useState(false)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const paths = useQuery({
    queryKey: ['paths'],
    queryFn: () => api<PathSummary[]>('/paths'),
  })
  const workspace = useQuery({
    queryKey: ['workspace'],
    queryFn: () => api<Workspace>('/workspace'),
  })
  const path = useQuery({
    queryKey: ['path', pathId],
    queryFn: () => api<PathDetail>(`/paths/${pathId}`),
    enabled: !!pathId,
  })
  const mutate = useMutation({
    mutationFn: ({ route, method, body }: { route: string; method: string; body?: unknown }) =>
      api(route, method, body),
    onSuccess: () => {
      client.invalidateQueries()
      setEditingPath(false)
    },
  })
  const nodes = path.data?.nodes || []
  const activeNodeId =
    workspace.data?.location.path_id === pathId ? workspace.data?.location.node_id : null
  const selected =
    nodes.find((node) => node.id === selectedId) ||
    nodes.find((node) => node.id === activeNodeId) ||
    nodes[0]
  const generation = path.data?.generation?.created_at ? path.data.generation : null
  const assessment = generation?.evaluation || {}
  const nodeSources =
    generation?.evidence.filter((source) => selected?.evidence_ids?.includes(source.id)) || []
  const graph = useMemo(() => {
    const layout = new dagre.graphlib.Graph()
      .setGraph({ rankdir: 'TB', nodesep: 40, ranksep: 75 })
      .setDefaultEdgeLabel(() => ({}))
    nodes.forEach((node) => layout.setNode(node.id, { width: 170, height: 70 }))
    nodes.forEach((node) => {
      if (node.parent_id) layout.setEdge(node.parent_id, node.id)
    })
    dagre.layout(layout)
    return {
      nodes: nodes.map((node) => {
        const point = layout.node(node.id)
        return {
          id: node.id,
          position: { x: point.x - 85, y: point.y - 35 },
          data: {
            label: (
              <div className="text-center">
                <p className="text-xs font-medium">{node.title}</p>
                <p className="mt-1 text-[10px] opacity-70">{node.status.replaceAll('_', ' ')}</p>
                {node.id === activeNodeId && (
                  <p className="mt-1 text-[10px] font-medium">Last studied</p>
                )}
              </div>
            ),
          },
          style: {
            width: 170,
            minHeight: 70,
            borderRadius: 12,
            border: `1.5px solid ${
              selected?.id === node.id
                ? '#4A5FA5'
                : node.status === 'completed'
                  ? '#5B7A58'
                  : '#D4D0C8'
            }`,
            background: node.status === 'completed' ? '#5B7A58' : '#FFFFFF',
            color: node.status === 'completed' ? '#FFFFFF' : '#3D3C38',
          },
        }
      }),
      edges: nodes
        .filter((node) => node.parent_id)
        .map((node) => ({
          id: `${node.parent_id}-${node.id}`,
          source: node.parent_id!,
          target: node.id,
          style: { stroke: '#B8C8B6', strokeWidth: 1.5 },
        })),
    }
  }, [nodes, selected?.id, activeNodeId])
  function reorder(index: number, delta: number) {
    const ordered = nodes.map((node) => node.id)
    ;[ordered[index], ordered[index + delta]] = [ordered[index + delta], ordered[index]]
    mutate.mutate({
      route: `/paths/${pathId}/reorder`,
      method: 'POST',
      body: { node_ids: ordered },
    })
  }
  if (!pathId)
    return (
      <div className="max-w-4xl">
        <h1 className="font-display text-3xl mb-6">My Journeys</h1>
        <ErrorNotice error={paths.error} />
        {paths.isPending ? (
          <Loading />
        ) : paths.data?.length ? (
          <div className="grid gap-4">
            {paths.data.map((item) => (
              <button
                key={item.id}
                onClick={() => onNavigate('graph', { path_id: item.id })}
                className="rounded-xl border border-[#E3E0D8] bg-white p-5 text-left"
              >
                <h2 className="font-display text-xl">{item.title}</h2>
                <p className="text-sm text-[#7A7870]">
                  {item.node_count} nodes · {Math.round(item.progress)}% completed
                </p>
              </button>
            ))}
          </div>
        ) : (
          <Empty title="No journeys yet">
            <button className="btn mt-2" onClick={() => onNavigate('create')}>
              Create a journey
            </button>
          </Empty>
        )}
      </div>
    )
  if (path.isPending) return <Loading />
  if (!path.data) return <ErrorNotice error={path.error} />
  return (
    <div className="screen-enter flex min-h-[calc(100vh-4rem)] flex-col">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-2xl">
          <select
            aria-label="Choose journey"
            className="mb-3 bg-transparent text-xs text-[#7A7870] outline-none"
            value={pathId}
            onChange={(event) => {
              setSelectedId(null)
              onNavigate('graph', { path_id: event.target.value })
            }}
          >
            {paths.data?.map((item) => (
              <option key={item.id} value={item.id}>
                {item.title}
              </option>
            ))}
          </select>
          <h1 className="font-display text-3xl font-light">{path.data.title}</h1>
          <p className="mt-2 text-sm text-[#7A7870]">{path.data.description}</p>
          <p className="mt-3 text-xs text-[#5B7A58]">
            {nodes.filter((node) => node.status === 'completed').length} of {nodes.length} nodes
            complete · {Math.round(path.data.progress)}%
          </p>
        </div>
        <div className="flex gap-2">
          <button
            className="btn-secondary"
            onClick={() => {
              setTitle(path.data!.title)
              setDescription(path.data!.description)
              setEditingPath(true)
            }}
          >
            <Pencil size={13} /> Edit journey
          </button>
          <button className="btn" onClick={() => setEditor('new')}>
            <Plus size={14} /> Add Topic
          </button>
        </div>
      </div>
      <details className="mb-5 rounded-xl border border-[#E3E0D8] bg-white px-5 py-4">
        <summary className="cursor-pointer text-sm font-medium text-[#5B7A58]">
          Original curriculum sources and assessment
        </summary>
        {!generation ? (
          <p className="mt-3 text-sm text-[#7A7870]">
            Source assessment not recorded for this journey.
          </p>
        ) : (
          <div className="mt-4 space-y-4">
            <p className="text-xs text-[#7A7870]">
              Recorded when this journey was created. Later edits have not been reassessed.
            </p>
            <p className="text-xs text-[#7A7870]">
              {generation.mode === 'outline' ? 'Imported outline' : 'Generated learning path'}
              {' · '}
              {generation.provider} / {generation.model}
              {' · '}
              {date(generation.created_at)}
            </p>
            {typeof assessment.status === 'string' && <Status value={assessment.status} />}
            {typeof assessment.explanation === 'string' && (
              <p className="text-sm text-[#3D3C38]">
                {assessmentText(assessment.explanation, generation.evidence)}
              </p>
            )}
            <dl className="flex flex-wrap gap-x-6 gap-y-3 text-xs">
              {['relevance', 'completeness', 'consistency', 'grounding'].map((criterion) =>
                typeof assessment[criterion] === 'number' ? (
                  <div key={criterion}>
                    <dt className="capitalize text-[#7A7870]">{criterion}</dt>
                    <dd className="mt-1 font-medium">
                      {Math.round((assessment[criterion] as number) * 100)}%
                    </dd>
                  </div>
                ) : null,
              )}
            </dl>
            <p className="text-xs text-[#7A7870]">
              Automated assessment can make mistakes. Review the retained sources when checking a
              topic.
            </p>
            {generation.evidence.length === 0 ? (
              <p className="text-sm text-[#7A7870]">
                {generation.mode === 'outline'
                  ? 'The supplied outline is the recorded curriculum basis.'
                  : 'No source excerpts were recorded.'}
              </p>
            ) : (
              <div className="max-h-80 space-y-3 overflow-y-auto">
                {generation.evidence.map((source, index) => (
                  <article key={source.id} className="rounded-lg bg-[#F7F6F2] p-4 text-xs">
                    <p className="font-medium">
                      [{index + 1}] {source.title}
                    </p>
                    {source.location && <p className="mt-1 text-[#7A7870]">{source.location}</p>}
                    <blockquote className="my-3 whitespace-pre-wrap border-l-2 border-[#C5D9C4] pl-3 leading-relaxed text-[#7A7870]">
                      {source.excerpt}
                    </blockquote>
                    {source.url && (
                      <a
                        href={source.url}
                        target="_blank"
                        rel="noreferrer"
                        className="break-all text-[#4A5FA5]"
                      >
                        {source.url}
                      </a>
                    )}
                  </article>
                ))}
              </div>
            )}
          </div>
        )}
      </details>
      <div className="mb-4 flex gap-2">
        <button
          className={view === 'graph' ? 'btn' : 'btn-secondary'}
          onClick={() => setView('graph')}
        >
          <Network size={14} /> Graph
        </button>
        <button
          className={view === 'list' ? 'btn' : 'btn-secondary'}
          onClick={() => setView('list')}
        >
          <List size={14} /> Outline
        </button>
      </div>
      <ErrorNotice error={mutate.error || workspace.error} />
      <div className="flex flex-1 flex-col gap-4 xl:flex-row">
        <div className="min-w-0 flex-1 overflow-hidden rounded-xl border border-[#E3E0D8] bg-white">
          {nodes.length === 0 ? (
            <Empty title="Add your first topic" />
          ) : view === 'graph' ? (
            <div className="h-[560px]">
              <ReactFlow
                nodes={graph.nodes}
                edges={graph.edges}
                fitView
                nodesDraggable={false}
                nodesConnectable={false}
                onNodeClick={(_, node) => setSelectedId(node.id)}
                onNodeDoubleClick={(_, node) =>
                  onNavigate('node', { path_id: pathId, node_id: node.id })
                }
              >
                <Background color="#E3E0D8" gap={22} />
                <Controls showInteractive={false} />
              </ReactFlow>
            </div>
          ) : (
            <div className="divide-y divide-[#F0EEE9]">
              {nodes.map((node, index) => (
                <div
                  key={node.id}
                  className={`flex items-center gap-3 p-4 ${
                    selected?.id === node.id ? 'bg-[#F7F8FC]' : ''
                  }`}
                >
                  <button
                    className="min-w-0 flex-1 text-left"
                    aria-current={node.id === activeNodeId ? 'step' : undefined}
                    onClick={() => setSelectedId(node.id)}
                  >
                    <p className="text-sm font-medium">{node.title}</p>
                    {node.id === activeNodeId && (
                      <p className="mt-1 text-xs text-[#4A5FA5]">Last studied</p>
                    )}
                    {node.parent_id && (
                      <p className="mt-1 text-xs text-[#A8A5A0]">
                        Under {nodes.find((parent) => parent.id === node.parent_id)?.title}
                      </p>
                    )}
                  </button>
                  <Status value={node.status} />
                  <button
                    aria-label={`Move ${node.title} up`}
                    className="icon-button"
                    disabled={index === 0 || mutate.isPending}
                    onClick={() => reorder(index, -1)}
                  >
                    <ArrowUp size={14} />
                  </button>
                  <button
                    aria-label={`Move ${node.title} down`}
                    className="icon-button"
                    disabled={index === nodes.length - 1 || mutate.isPending}
                    onClick={() => reorder(index, 1)}
                  >
                    <ArrowDown size={14} />
                  </button>
                  <button
                    aria-label={`Edit ${node.title}`}
                    className="icon-button"
                    onClick={() => setEditor(node)}
                  >
                    <Pencil size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
        {selected && (
          <aside className="w-full self-start rounded-xl border border-[#E3E0D8] bg-white p-5 xl:w-72">
            <p className="mb-3 text-xs uppercase tracking-widest text-[#A8A5A0]">
              Selected learning node
            </p>
            <h2 className="font-display text-xl">{selected.title}</h2>
            <div className="my-3">
              <Status value={selected.status} />
            </div>
            <p className="text-sm text-[#7A7870]">
              {selected.description || 'Add a description to guide this topic.'}
            </p>
            {nodeSources.length > 0 && (
              <div className="mt-4 border-t border-[#E3E0D8] pt-4 text-xs">
                <p className="mb-2 font-medium text-[#7A7870]">Original sources for this topic</p>
                <ul className="space-y-2">
                  {nodeSources.map((source) => (
                    <li key={source.id}>
                      [{generation!.evidence.findIndex((entry) => entry.id === source.id) + 1}]{' '}
                      {source.title}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <button
              className="btn mt-5 w-full"
              onClick={() => onNavigate('node', { path_id: pathId, node_id: selected.id })}
            >
              Open learning node <ArrowRight size={14} />
            </button>
            <div className="mt-3 flex gap-2">
              <button className="btn-secondary flex-1" onClick={() => setEditor(selected)}>
                <Pencil size={13} /> Edit
              </button>
              <button
                className="btn-secondary"
                aria-label="Delete selected topic"
                disabled={mutate.isPending}
                onClick={() => {
                  if (
                    confirm(
                      'Delete this topic? Only empty topics without learning history can be removed.',
                    )
                  )
                    mutate.mutate({
                      route: `/nodes/${selected.id}`,
                      method: 'DELETE',
                    })
                }}
              >
                <Trash2 size={13} />
              </button>
            </div>
          </aside>
        )}
      </div>
      {editor && (
        <Modal
          title={editor === 'new' ? 'Add to Learning Path' : 'Edit learning topic'}
          onClose={() => setEditor(null)}
        >
          <NodeEditor
            pathId={pathId}
            nodes={nodes}
            node={editor === 'new' ? undefined : editor}
            onDone={() => setEditor(null)}
          />
        </Modal>
      )}
      {editingPath && (
        <Modal title="Edit journey" onClose={() => setEditingPath(false)}>
          <form
            onSubmit={(event) => {
              event.preventDefault()
              mutate.mutate({
                route: `/paths/${pathId}`,
                method: 'PATCH',
                body: { title, description },
              })
            }}
          >
            <label className="field-label" htmlFor="path-title">
              Title
            </label>
            <input
              id="path-title"
              maxLength={200}
              className="field"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              required
            />
            <label className="field-label" htmlFor="path-description">
              Description
            </label>
            <textarea
              id="path-description"
              className="field"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
            />
            <ErrorNotice error={mutate.error} />
            <button className="btn mt-5" disabled={mutate.isPending}>
              Save journey
            </button>
          </form>
        </Modal>
      )}
    </div>
  )
}
