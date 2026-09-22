import { useState, useRef } from 'react'

interface CurriculumGraphProps {
  onNavigate: (screen: string) => void
}

type NodeState = 'completed' | 'current' | 'available' | 'locked'

interface GraphNode {
  id: string
  label: string
  x: number
  y: number
  state: NodeState
  parent?: string
  group: string
}

const nodes: GraphNode[] = [
  // Root
  { id: 'root', label: 'Machine Learning', x: 400, y: 50, state: 'completed', group: 'root' },
  // Foundations
  { id: 'foundations', label: 'Foundations', x: 140, y: 150, state: 'completed', parent: 'root', group: 'foundations' },
  { id: 'what-ml', label: 'What is ML?', x: 60, y: 260, state: 'completed', parent: 'foundations', group: 'foundations' },
  { id: 'types-ml', label: 'Types of ML', x: 140, y: 280, state: 'completed', parent: 'foundations', group: 'foundations' },
  { id: 'paradigms', label: 'Learning Paradigms', x: 220, y: 260, state: 'completed', parent: 'foundations', group: 'foundations' },
  // Mathematics
  { id: 'mathematics', label: 'Mathematics', x: 340, y: 150, state: 'completed', parent: 'root', group: 'math' },
  { id: 'linalg', label: 'Linear Algebra', x: 280, y: 270, state: 'completed', parent: 'mathematics', group: 'math' },
  { id: 'probability', label: 'Probability', x: 370, y: 280, state: 'completed', parent: 'mathematics', group: 'math' },
  { id: 'statistics', label: 'Statistics', x: 450, y: 270, state: 'available', parent: 'mathematics', group: 'math' },
  // Supervised Learning
  { id: 'supervised', label: 'Supervised Learning', x: 540, y: 150, state: 'current', parent: 'root', group: 'supervised' },
  { id: 'linreg', label: 'Linear Regression', x: 480, y: 275, state: 'completed', parent: 'supervised', group: 'supervised' },
  { id: 'logreg', label: 'Logistic Regression', x: 560, y: 295, state: 'current', parent: 'supervised', group: 'supervised' },
  { id: 'trees', label: 'Decision Trees', x: 640, y: 275, state: 'locked', parent: 'supervised', group: 'supervised' },
  // Evaluation
  { id: 'evaluation', label: 'Model Evaluation', x: 680, y: 150, state: 'locked', parent: 'root', group: 'evaluation' },
  { id: 'train-test', label: 'Train/Test Split', x: 640, y: 370, state: 'locked', parent: 'evaluation', group: 'evaluation' },
  { id: 'crossval', label: 'Cross Validation', x: 720, y: 380, state: 'locked', parent: 'evaluation', group: 'evaluation' },
  { id: 'metrics', label: 'Evaluation Metrics', x: 680, y: 395, state: 'locked', parent: 'evaluation', group: 'evaluation' },
]

const edges = nodes
  .filter(n => n.parent)
  .map(n => ({ from: n.parent!, to: n.id }))

function getNodeStyle(state: NodeState) {
  switch (state) {
    case 'completed': return { fill: '#5B7A58', stroke: '#5B7A58', textFill: '#FFFFFF', r: 18 }
    case 'current': return { fill: '#FFFFFF', stroke: '#4A5FA5', textFill: '#4A5FA5', r: 20 }
    case 'available': return { fill: '#FFFFFF', stroke: '#9B9890', textFill: '#5A5850', r: 16 }
    case 'locked': return { fill: '#F0EEE9', stroke: '#D4D0C8', textFill: '#A8A5A0', r: 14 }
  }
}

function getEdgeStyle(fromState: NodeState, toState: NodeState) {
  const active = fromState === 'completed' && (toState === 'completed' || toState === 'current')
  return {
    stroke: active ? '#B8C8B6' : '#DDD9D1',
    strokeWidth: active ? 2 : 1,
    strokeDasharray: active ? 'none' : '4 3',
  }
}

interface SelectedNodeInfo {
  id: string
  label: string
  state: NodeState
}

function AddTopicModal({ onClose, onAdd }: { onClose: () => void; onAdd: (name: string) => void }) {
  const [topicName, setTopicName] = useState('')
  const [withSuggestions, setWithSuggestions] = useState(false)
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm">
      <div className="bg-white border border-[#E3E0D8] rounded-xl shadow-2xl w-[420px] p-6 screen-enter">
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-display text-xl font-medium text-[#1A1916]">Add to Learning Path</h2>
          <button onClick={onClose} className="text-[#A8A5A0] hover:text-[#1A1916] text-xl transition-colors">×</button>
        </div>
        <div className="mb-4">
          <label className="text-xs font-medium text-[#7A7870] uppercase tracking-wide block mb-1.5">Topic name</label>
          <input
            value={topicName}
            onChange={e => setTopicName(e.target.value)}
            autoFocus
            placeholder="e.g. Support Vector Machines"
            className="w-full border border-[#E3E0D8] rounded-lg px-4 py-3 text-sm text-[#1A1916] placeholder:text-[#C0BDB5] outline-none focus:border-[#9B9890] transition-all"
          />
        </div>
        <div className="bg-[#F7F6F2] border border-[#E3E0D8] rounded-lg p-3 mb-4">
          <p className="text-xs text-[#A8A5A0] mb-1">Where</p>
          <div className="flex items-center gap-1.5 text-xs text-[#5A5850]">
            <span>Machine Learning</span>
            <span className="text-[#C0BDB5]">›</span>
            <span className="font-medium text-[#1A1916]">Supervised Learning</span>
          </div>
        </div>
        <label className="flex items-center gap-2.5 cursor-pointer mb-5">
          <div
            onClick={() => setWithSuggestions(!withSuggestions)}
            className={`w-4 h-4 rounded border flex items-center justify-center transition-all ${withSuggestions ? 'bg-[#5B7A58] border-[#5B7A58]' : 'border-[#C0BDB5]'}`}
          >
            {withSuggestions && <span className="text-white text-[9px]">✓</span>}
          </div>
          <span className="text-sm text-[#3D3C38]">Ask Trellis to suggest prerequisites</span>
        </label>
        <div className="flex gap-2">
          <button onClick={onClose} className="flex-1 border border-[#E3E0D8] text-[#3D3C38] text-sm py-2.5 rounded-lg hover:bg-[#F0EEE9] transition-all">
            Cancel
          </button>
          <button
            disabled={!topicName.trim()}
            onClick={() => { onAdd(topicName); onClose() }}
            className="flex-1 bg-[#2D2C28] text-white text-sm py-2.5 rounded-lg hover:bg-[#1A1916] transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          >
            Add Topic
          </button>
        </div>
      </div>
    </div>
  )
}

export default function CurriculumGraph({ onNavigate }: CurriculumGraphProps) {
  const [view, setView] = useState<'graph' | 'list'>('graph')
  const [selectedNode, setSelectedNode] = useState<SelectedNodeInfo | null>({
    id: 'logreg',
    label: 'Logistic Regression',
    state: 'current',
  })
  const [scale, setScale] = useState(1)
  const [editMode, setEditMode] = useState(false)
  const [showAddTopic, setShowAddTopic] = useState(false)
  const [unsavedChanges, setUnsavedChanges] = useState(false)
  const [localNodes, setLocalNodes] = useState(nodes)
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const _ref = useRef(null)

  const nodeMap = Object.fromEntries(localNodes.map(n => [n.id, n]))

  const prerequisites: Record<string, string[]> = {
    logreg: ['Linear Algebra', 'Probability', 'Linear Regression'],
    trees: ['Linear Algebra', 'Probability'],
    crossval: ['Decision Trees', 'Logistic Regression'],
  }

  return (
    <div className="screen-enter flex flex-col h-full min-h-[calc(100vh-4rem)]">
      {/* Header */}
      <div className="flex items-start justify-between mb-5">
        <div>
          <div className="flex items-center gap-2 text-xs text-[#A8A5A0] mb-2">
            <button className="hover:text-[#1A1916] transition-colors">My Journeys</button>
            <span>/</span>
            <span className="text-[#1A1916] font-medium">Machine Learning</span>
          </div>
          <div className="flex items-center gap-5">
            <h1 className="font-display text-2xl font-medium text-[#1A1916]">Machine Learning</h1>
            <div className="flex items-center gap-2">
              <div className="w-24 bg-[#EEF0EB] rounded-full h-1.5">
                <div className="bg-[#5B7A58] h-1.5 rounded-full" style={{ width: '42%' }}></div>
              </div>
              <span className="text-sm text-[#7A7870]">42%</span>
            </div>
          </div>
          <p className="text-sm text-[#7A7870] mt-1">18 completed · 3 in progress · 5 threads explored</p>
        </div>
        <div className="flex items-center gap-2">
          {editMode ? (
            <>
              {unsavedChanges && (
                <span className="text-xs text-[#A8954E] bg-[#FAF5EA] border border-[#E8D9AA] px-2.5 py-1 rounded-md">
                  Unsaved changes
                </span>
              )}
              <button
                onClick={() => { setEditMode(false); setUnsavedChanges(false); setLocalNodes(nodes) }}
                className="text-xs text-[#7A7870] border border-[#E3E0D8] px-3 py-1.5 rounded-md hover:bg-white transition-all"
              >
                Cancel
              </button>
              <button
                onClick={() => { setEditMode(false); setUnsavedChanges(false) }}
                className="text-xs bg-[#2D2C28] text-white px-3 py-1.5 rounded-md hover:bg-[#1A1916] transition-colors"
              >
                Save Changes
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => setEditMode(true)}
                className="text-xs text-[#7A7870] border border-[#E3E0D8] px-3 py-1.5 rounded-md hover:bg-white transition-all"
              >
                Edit Path
              </button>
              <button
                onClick={() => setShowAddTopic(true)}
                className="text-xs text-[#7A7870] border border-[#E3E0D8] px-3 py-1.5 rounded-md hover:bg-white transition-all"
              >
                + Add Topic
              </button>
            </>
          )}
        </div>
      </div>

      {/* View tabs */}
      <div className="flex items-center gap-1 mb-4">
        {(['graph', 'list'] as const).map(v => (
          <button
            key={v}
            onClick={() => setView(v)}
            className={`text-xs px-3 py-1.5 rounded-md capitalize transition-all ${
              view === v
                ? 'bg-[#2D2C28] text-white'
                : 'text-[#7A7870] hover:bg-[#F0EEE9]'
            }`}
          >
            {v}
          </button>
        ))}
      </div>

      <div className="flex gap-5 flex-1">
        {/* Graph canvas */}
        <div className="flex-1 bg-white border border-[#E3E0D8] rounded-xl overflow-hidden relative">
          {view === 'graph' ? (
            <>
              {/* Zoom controls */}
              <div className="absolute top-4 right-4 flex flex-col gap-1 z-10">
                <button
                  onClick={() => setScale(s => Math.min(s + 0.15, 1.8))}
                  className="w-7 h-7 bg-white border border-[#E3E0D8] rounded text-[#7A7870] hover:bg-[#F0EEE9] text-sm flex items-center justify-center"
                >+</button>
                <button
                  onClick={() => setScale(s => Math.max(s - 0.15, 0.5))}
                  className="w-7 h-7 bg-white border border-[#E3E0D8] rounded text-[#7A7870] hover:bg-[#F0EEE9] text-sm flex items-center justify-center"
                >−</button>
              </div>
              {/* Node state legend */}
              <div className="absolute bottom-4 left-4 flex items-center gap-4 z-10">
                {[
                  { label: 'Completed', color: '#5B7A58', fill: true },
                  { label: 'Current', color: '#4A5FA5', fill: false },
                  { label: 'Available', color: '#9B9890', fill: false },
                  { label: 'Locked', color: '#D4D0C8', fill: true, light: true },
                ].map((s, i) => (
                  <div key={i} className="flex items-center gap-1.5">
                    <div
                      className="w-3 h-3 rounded-full border flex-shrink-0"
                      style={{
                        backgroundColor: s.fill ? (s.light ? '#F0EEE9' : s.color) : 'white',
                        borderColor: s.color,
                        borderWidth: s.fill ? (s.light ? '1px' : '0') : '1.5px',
                      }}
                    ></div>
                    <span className="text-xs text-[#A8A5A0]">{s.label}</span>
                  </div>
                ))}
              </div>
              <svg
                width="100%"
                height="480"
                viewBox="0 0 800 460"
                className="cursor-grab"
                style={{ transform: `scale(${scale})`, transformOrigin: 'center top', transition: 'transform 0.2s' }}
              >
                {/* Group background highlights */}
                <rect x="30" y="120" width="220" height="190" rx="8" fill="#F0F4EF" opacity="0.5" />
                <rect x="255" y="120" width="220" height="195" rx="8" fill="#F0EFEC" opacity="0.4" />
                <rect x="460" y="120" width="210" height="200" rx="8" fill="#F0F0F5" opacity="0.5" />
                <text x="45" y="138" fontSize="9" fill="#7A7870" fontFamily="Inter" fontWeight="500">FOUNDATIONS</text>
                <text x="268" y="138" fontSize="9" fill="#7A7870" fontFamily="Inter" fontWeight="500">MATHEMATICS</text>
                <text x="474" y="138" fontSize="9" fill="#7A7870" fontFamily="Inter" fontWeight="500">SUPERVISED LEARNING</text>

                {/* Edges */}
                {edges.map(({ from, to }) => {
                  const a = nodeMap[from]
                  const b = nodeMap[to]
                  if (!a || !b) return null
                  const style = getEdgeStyle(a.state, b.state)
                  const mx = (a.x + b.x) / 2
                  return (
                    <path
                      key={`${from}-${to}`}
                      d={`M${a.x},${a.y} C${a.x},${(a.y + b.y) / 2} ${mx},${b.y} ${b.x},${b.y}`}
                      fill="none"
                      stroke={style.stroke}
                      strokeWidth={style.strokeWidth}
                      strokeDasharray={style.strokeDasharray}
                    />
                  )
                })}

                {/* Nodes */}
                {localNodes.map(node => {
                  const style = getNodeStyle(node.state)
                  const isRoot = node.id === 'root'
                  const isSelected = selectedNode?.id === node.id
                  return (
                    <g
                      key={node.id}
                      className="cursor-pointer"
                      onClick={() => setSelectedNode({ id: node.id, label: node.label, state: node.state })}
                    >
                      {isSelected && (
                        <circle cx={node.x} cy={node.y} r={style.r + 6} fill="none" stroke="#4A5FA5" strokeWidth="1.5" opacity="0.3" />
                      )}
                      {node.state === 'current' && (
                        <circle cx={node.x} cy={node.y} r={style.r + 5} fill="none" stroke="#4A5FA5" strokeWidth="1" className="node-pulse" />
                      )}
                      <circle
                        cx={node.x}
                        cy={node.y}
                        r={isRoot ? 24 : style.r}
                        fill={style.fill}
                        stroke={style.stroke}
                        strokeWidth={isRoot ? 2 : 1.5}
                      />
                      {node.state === 'completed' && (
                        <text x={node.x} y={node.y + 4.5} textAnchor="middle" fontSize="12" fill="white">✓</text>
                      )}
                      {node.state === 'locked' && (
                        <text x={node.x} y={node.y + 4} textAnchor="middle" fontSize="9" fill={style.textFill}>⊘</text>
                      )}
                      {node.state === 'current' && (
                        <circle cx={node.x} cy={node.y} r={4} fill="#4A5FA5" />
                      )}
                      <text
                        x={node.x}
                        y={node.y + (isRoot ? 24 : style.r) + 14}
                        textAnchor="middle"
                        fontSize={isRoot ? '11' : '9'}
                        fontWeight={isRoot || node.id === 'logreg' ? '500' : '400'}
                        fill={isRoot ? '#1A1916' : '#5A5850'}
                        fontFamily="Inter, sans-serif"
                      >
                        {node.label}
                      </text>
                    </g>
                  )
                })}
              </svg>
            </>
          ) : (
            <div className="p-6 space-y-4 overflow-auto h-full">
              {['Foundations', 'Mathematics', 'Supervised Learning', 'Model Evaluation'].map((group, gi) => (
                <div key={gi}>
                  <p className="text-xs font-medium text-[#7A7870] uppercase tracking-wide mb-2">{group}</p>
                  <div className="space-y-1.5">
                    {nodes.filter(n => n.group !== 'root' && (
                      (group === 'Foundations' && n.group === 'foundations') ||
                      (group === 'Mathematics' && n.group === 'math') ||
                      (group === 'Supervised Learning' && n.group === 'supervised') ||
                      (group === 'Model Evaluation' && n.group === 'evaluation')
                    )).map(n => (
                      <div
                        key={n.id}
                        onClick={() => setSelectedNode({ id: n.id, label: n.label, state: n.state })}
                        className={`flex items-center gap-3 p-2.5 rounded-lg cursor-pointer transition-all ${
                          selectedNode?.id === n.id ? 'bg-[#EEF2FF] border border-[#C5CEED]' : 'hover:bg-[#F7F6F2]'
                        }`}
                      >
                        <div className={`w-4 h-4 rounded-full border flex items-center justify-center flex-shrink-0 ${
                          n.state === 'completed' ? 'bg-[#5B7A58] border-[#5B7A58]' :
                          n.state === 'current' ? 'bg-white border-[#4A5FA5]' :
                          n.state === 'available' ? 'bg-white border-[#9B9890]' :
                          'bg-[#F0EEE9] border-[#D4D0C8]'
                        }`}>
                          {n.state === 'completed' && <span className="text-white text-[8px]">✓</span>}
                          {n.state === 'current' && <span className="w-1.5 h-1.5 rounded-full bg-[#4A5FA5] block"></span>}
                        </div>
                        <span className={`text-sm ${n.state === 'locked' ? 'text-[#A8A5A0]' : 'text-[#1A1916]'}`}>{n.label}</span>
                        <span className={`ml-auto text-xs capitalize ${
                          n.state === 'completed' ? 'text-[#5B7A58]' :
                          n.state === 'current' ? 'text-[#4A5FA5]' :
                          'text-[#A8A5A0]'
                        }`}>{n.state}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Context panel */}
        {selectedNode && (
          <div className="w-64 bg-white border border-[#E3E0D8] rounded-xl p-5 flex-shrink-0">
            <div className="mb-5">
              <div className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full mb-3 ${
                selectedNode.state === 'current'
                  ? 'bg-[#EEF0F9] text-[#4A5FA5] border border-[#C5CEED]'
                  : selectedNode.state === 'completed'
                  ? 'bg-[#EFF4EE] text-[#5B7A58] border border-[#C5D9C4]'
                  : 'bg-[#F0EEE9] text-[#7A7870] border border-[#E3E0D8]'
              }`}>
                <span className={`w-1.5 h-1.5 rounded-full inline-block ${
                  selectedNode.state === 'current' ? 'bg-[#4A5FA5]' :
                  selectedNode.state === 'completed' ? 'bg-[#5B7A58]' : 'bg-[#9B9890]'
                }`}></span>
                <span className="capitalize">{selectedNode.state}</span>
              </div>
              <h3 className="font-display text-lg font-medium text-[#1A1916] leading-tight">{selectedNode.label}</h3>
              <p className="text-xs text-[#7A7870] mt-1">Supervised Learning · Foundation to Applied</p>
            </div>

            {prerequisites[selectedNode.id] && (
              <div className="mb-4">
                <p className="text-xs font-medium text-[#7A7870] uppercase tracking-wide mb-2">Prerequisites</p>
                <div className="space-y-1">
                  {prerequisites[selectedNode.id].map((p, i) => (
                    <div key={i} className="flex items-center gap-2 text-xs text-[#5A5850]">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#5B7A58] flex-shrink-0"></span>
                      {p}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="mb-5">
              <p className="text-xs font-medium text-[#7A7870] uppercase tracking-wide mb-2">Estimated Depth</p>
              <div className="flex gap-1">
                {['Foundation', 'Applied', 'Advanced'].map((d, i) => (
                  <span
                    key={i}
                    className={`text-xs px-2 py-0.5 rounded ${
                      i <= 1 ? 'bg-[#5B7A58] text-white' : 'bg-[#F0EEE9] text-[#A8A5A0]'
                    }`}
                  >
                    {d}
                  </span>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <button
                onClick={() => onNavigate('node')}
                className="w-full bg-[#2D2C28] text-white text-sm py-2.5 rounded-md hover:bg-[#1A1916] transition-colors"
              >
                Enter Learning Node
              </button>
              <button className="w-full border border-[#E3E0D8] text-[#3D3C38] text-sm py-2.5 rounded-md hover:bg-[#F7F6F2] transition-colors">
                Explore Related Concept
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Edit mode panel */}
      {editMode && (
        <div className="mt-4 bg-white border border-[#E3E0D8] rounded-xl p-5 screen-enter">
          <p className="text-xs font-medium text-[#7A7870] uppercase tracking-widest mb-3">Edit Curriculum</p>
          <div className="grid grid-cols-2 gap-3">
            {['foundations','math','supervised','evaluation'].map((grpId, gi) => {
              const grpName = ['Foundations', 'Mathematics', 'Supervised Learning', 'Model Evaluation'][gi]
              const grpNodes = localNodes.filter(n => n.group === grpId)
              return (
                <div key={grpId} className="border border-[#F0EEE9] rounded-lg p-3">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm font-medium text-[#1A1916]">{grpName}</p>
                    <button className="text-xs text-[#A8A5A0] hover:text-[#7A7870]">Rename</button>
                  </div>
                  <div className="space-y-1">
                    {grpNodes.map(n => (
                      <div key={n.id} className="flex items-center gap-2 group/node">
                        <span className="text-[#C0BDB5] cursor-grab text-xs">⋮⋮</span>
                        <span className="text-xs text-[#5A5850] flex-1">{n.label}</span>
                        <button
                          onClick={() => { setLocalNodes(prev => prev.filter(x => x.id !== n.id)); setUnsavedChanges(true) }}
                          className="text-xs text-[#C0BDB5] hover:text-[#A8554E] opacity-0 group-hover/node:opacity-100 transition-opacity"
                        >×</button>
                      </div>
                    ))}
                    <button
                      onClick={() => setShowAddTopic(true)}
                      className="flex items-center gap-1 text-xs text-[#5B7A58] hover:text-[#3D6039] mt-1 transition-colors"
                    >
                      + Add Topic
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {showAddTopic && (
        <AddTopicModal
          onClose={() => setShowAddTopic(false)}
          onAdd={(name) => {
            setLocalNodes(prev => [...prev, {
              id: `custom-${Date.now()}`,
              label: name,
              x: 560,
              y: 370,
              state: 'available' as NodeState,
              parent: 'supervised',
              group: 'supervised',
            }])
            setUnsavedChanges(true)
          }}
        />
      )}
    </div>
  )
}
