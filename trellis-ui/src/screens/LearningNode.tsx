import { useState, useEffect } from 'react'

interface LearningNodeProps {
  onNavigate: (screen: string) => void
}

type RightPanel = 'ai' | 'notebook' | 'evidence'
type NodeStatus = 'in-progress' | 'completed'

const sections = ['Concept', 'How It Works', 'Intuition', 'Example', 'Practical Application']

interface Message {
  role: 'user' | 'ai'
  content: string
  evidenceCount?: number
}

const initialMessages: Message[] = [
  { role: 'user', content: 'Why does sigmoid work here?' },
  {
    role: 'ai',
    content: 'Because logistic regression needs to transform its output into a probability between 0 and 1. The sigmoid σ(z) = 1/(1+e^−z) maps any real value to (0,1), which makes it ideal for representing class probabilities.\n\nFor a linear combination z = wᵀx + b, applying sigmoid gives P(y=1|x) — the probability the input belongs to the positive class.',
    evidenceCount: 3,
  },
]

const evidenceSources = [
  { title: 'Introduction to Statistical Learning', type: 'Book', chapter: 'Chapter 4', relevance: 'High', excerpt: '…logistic regression models the probability of a binary response using the logistic function…' },
  { title: 'Scikit-learn Documentation', type: 'Docs', chapter: null, relevance: 'High', excerpt: '…the default solver for LogisticRegression is lbfgs, which works well for most binary classification tasks…' },
  { title: 'Ng, A. CS229 Lecture Notes', type: 'Academic', chapter: null, relevance: 'Medium', excerpt: '…we choose g to be the logistic function because it is a natural choice for modeling probabilities…' },
]

const notebookEntries = [
  { id: 'n1', title: 'Sigmoid function intuition', source: 'Logistic Regression', time: 'Saved just now' },
  { id: 'n2', title: 'Why linear algebra matters for ML', source: 'Linear Algebra', time: 'Yesterday' },
  { id: 'n3', title: 'CAP Theorem explained', source: 'System Design', time: '2 days ago' },
]

const threads = [
  { id: 't1', title: 'History of Logistic Regression', parent: 'Logistic Regression', time: '11 min ago', status: 'exploring' },
  { id: 't2', title: 'Why sigmoid works', parent: 'Logistic Regression', time: '32 min ago', status: 'saved' },
  { id: 't3', title: 'Neural Networks connection', parent: 'Logistic Regression', time: 'Yesterday', status: 'saved' },
]

function Toast({ message, onClose }: { message: string; onClose: () => void }) {
  useEffect(() => {
    const t = setTimeout(onClose, 3500)
    return () => clearTimeout(t)
  }, [onClose])
  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 bg-[#2D2C28] text-white px-4 py-3 rounded-xl shadow-xl screen-enter text-sm">
      <span className="text-[#5B7A58] text-base">✓</span>
      <div>
        <p className="font-medium">{message}</p>
        <p className="text-xs text-[#9B9890]">Logistic Regression · Current Node</p>
      </div>
      <button
        onClick={() => {}}
        className="ml-3 text-xs text-[#9B9890] border border-[#4A4A46] px-2.5 py-1 rounded hover:border-[#7A7870] hover:text-white transition-all"
      >
        Open Notebook
      </button>
    </div>
  )
}

function ContextPopover({ onClose }: { onClose: () => void }) {
  return (
    <div className="absolute top-8 right-0 z-30 w-72 bg-white border border-[#E3E0D8] rounded-xl shadow-lg p-4 screen-enter">
      <div className="flex items-center justify-between mb-4">
        <p className="text-xs font-medium text-[#1A1916] uppercase tracking-widest">Current AI Context</p>
        <button onClick={onClose} className="text-[#A8A5A0] hover:text-[#1A1916] transition-colors text-sm">×</button>
      </div>
      <div className="space-y-3 mb-4">
        {[
          { label: 'Journey', value: 'Machine Learning' },
          { label: 'Parent', value: 'Supervised Learning' },
          { label: 'Current Node', value: 'Logistic Regression' },
        ].map((row, i) => (
          <div key={i} className="flex justify-between text-sm">
            <span className="text-[#7A7870]">{row.label}</span>
            <span className="text-[#1A1916] font-medium">{row.value}</span>
          </div>
        ))}
      </div>
      <div className="border-t border-[#F0EEE9] pt-3 mb-3">
        <p className="text-xs text-[#7A7870] mb-2">Prerequisites included</p>
        <div className="space-y-1">
          {['Linear Algebra', 'Probability', 'Linear Regression'].map((p, i) => (
            <div key={i} className="flex items-center gap-1.5 text-xs text-[#5A5850]">
              <span className="text-[#5B7A58]">✓</span> {p}
            </div>
          ))}
        </div>
      </div>
      <div className="bg-[#F0EEE9] rounded-lg p-3 mb-3">
        <div className="flex items-center gap-1.5 mb-1">
          <span className="w-1.5 h-1.5 rounded-full bg-[#4A5FA5] inline-block"></span>
          <p className="text-xs font-medium text-[#4A5FA5]">AI Scope: Current Node</p>
        </div>
        <p className="text-xs text-[#7A7870] leading-relaxed">
          The assistant uses this node and prerequisite context. Exploratory threads are kept isolated from the primary path.
        </p>
      </div>
      <div className="flex gap-2">
        <button className="flex-1 text-xs border border-[#E3E0D8] text-[#3D3C38] py-2 rounded-md hover:bg-[#F0EEE9] transition-all">
          Manage Scope
        </button>
        <button className="flex-1 text-xs bg-[#2D2C28] text-white py-2 rounded-md hover:bg-[#1A1916] transition-colors">
          View Context
        </button>
      </div>
    </div>
  )
}

function AiPanel({ onSaveToNotebook }: { onSaveToNotebook: () => void }) {
  const [messages, setMessages] = useState<Message[]>(initialMessages)
  const [input, setInput] = useState('')
  const [showEvidence, setShowEvidence] = useState(false)
  const [showContext, setShowContext] = useState(false)

  function send() {
    if (!input.trim()) return
    setMessages(m => [...m, { role: 'user', content: input }])
    setInput('')
    setTimeout(() => {
      setMessages(m => [...m, {
        role: 'ai',
        content: 'The decision boundary is where P(y=1|x) = 0.5, which means z = 0. The model learns weight vector w that places this boundary to best separate the two classes in feature space.',
        evidenceCount: 2,
      }])
    }, 800)
  }

  return (
    <div className="flex flex-col h-full">
      {/* Context indicator */}
      <div className="relative mb-3">
        <div className="p-3 bg-[#F0EEE9] rounded-lg border border-[#E3E0D8]">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-[#A8A5A0] uppercase tracking-widest mb-1">AI Context</p>
              <div className="flex items-center gap-1.5 text-xs font-medium text-[#1A1916]">
                <span className="w-1.5 h-1.5 rounded-full bg-[#4A5FA5] inline-block"></span>
                Logistic Regression
              </div>
            </div>
            <button
              onClick={() => setShowContext(!showContext)}
              className="text-xs text-[#7A7870] hover:text-[#1A1916] transition-colors flex items-center gap-1"
            >
              Context <span className="text-[#C0BDB5]">{showContext ? '▴' : '▾'}</span>
            </button>
          </div>
        </div>
        {showContext && <ContextPopover onClose={() => setShowContext(false)} />}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto space-y-3 pr-0.5 mb-3">
        {messages.map((msg, i) => (
          <div key={i} className={msg.role === 'user' ? 'flex justify-end' : ''}>
            {msg.role === 'user' ? (
              <div className="bg-[#2D2C28] text-white text-xs px-3 py-2 rounded-xl rounded-br-sm max-w-[90%] leading-relaxed">
                {msg.content}
              </div>
            ) : (
              <div>
                <p className="text-xs text-[#3D3C38] leading-relaxed mb-2 whitespace-pre-line">{msg.content}</p>
                {msg.evidenceCount && (
                  <>
                    <button
                      onClick={() => setShowEvidence(!showEvidence)}
                      className="flex items-center gap-1.5 text-xs text-[#7A7870] hover:text-[#1A1916] transition-colors mb-2"
                    >
                      <span className="text-[#A8A5A0]">⬡</span>
                      Evidence · {msg.evidenceCount} sources
                      <span className="text-[#C0BDB5]">{showEvidence ? '▴' : '▾'}</span>
                    </button>
                    {showEvidence && (
                      <div className="space-y-1.5 mb-2">
                        {evidenceSources.slice(0, msg.evidenceCount).map((src, si) => (
                          <div key={si} className="bg-[#F7F6F2] border border-[#E3E0D8] rounded-lg p-2.5">
                            <p className="text-xs font-medium text-[#1A1916]">{src.title}</p>
                            <p className="text-xs text-[#A8A5A0] mt-0.5">{src.type}{src.chapter ? ` · ${src.chapter}` : ''}</p>
                          </div>
                        ))}
                      </div>
                    )}
                    <div className="flex flex-wrap gap-1.5">
                      <button
                        onClick={onSaveToNotebook}
                        className="text-xs text-[#5B7A58] border border-[#C5D9C4] bg-[#EFF4EE] px-2 py-1 rounded hover:bg-[#E3EEE2] transition-colors"
                      >
                        Save to Notebook
                      </button>
                      <button className="text-xs text-[#7A7870] border border-[#E3E0D8] px-2 py-1 rounded hover:bg-[#F0EEE9] transition-all">
                        Explore Further
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Input */}
      <div className="border-t border-[#E3E0D8] pt-3">
        <div className="flex gap-2">
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && send()}
            placeholder="Ask about this topic…"
            className="flex-1 text-xs bg-[#F7F6F2] border border-[#E3E0D8] rounded-lg px-3 py-2 outline-none focus:border-[#9B9890] focus:bg-white transition-all placeholder:text-[#C0BDB5]"
          />
          <button onClick={send} className="bg-[#2D2C28] text-white text-xs px-3 py-2 rounded-lg hover:bg-[#1A1916] transition-colors">
            →
          </button>
        </div>
      </div>
    </div>
  )
}

function NotebookPanel({ onSaved }: { onSaved: () => void }) {
  const [search, setSearch] = useState('')
  const [noteText, setNoteText] = useState('')
  const filtered = notebookEntries.filter(e => !search || e.title.toLowerCase().includes(search.toLowerCase()))

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-medium text-[#1A1916] uppercase tracking-widest">Notebook</p>
        <button className="text-xs text-[#5B7A58] hover:text-[#3D6039] transition-colors">+ New note</button>
      </div>
      <p className="text-xs text-[#A8A5A0] mb-2">Machine Learning</p>
      <input
        value={search}
        onChange={e => setSearch(e.target.value)}
        placeholder="Search notes…"
        className="w-full text-xs bg-[#F0EEE9] border border-[#E3E0D8] rounded-lg px-3 py-1.5 outline-none focus:bg-white focus:border-[#9B9890] transition-all placeholder:text-[#C0BDB5] mb-3"
      />
      <div className="space-y-1.5 mb-4 flex-1 overflow-y-auto">
        <p className="text-xs text-[#A8A5A0] uppercase tracking-widest mb-1">Recent</p>
        {filtered.map(entry => (
          <div key={entry.id} className="p-2.5 rounded-lg border border-[#F0EEE9] hover:border-[#E3E0D8] hover:bg-white cursor-pointer transition-all">
            <p className="text-xs font-medium text-[#1A1916] leading-snug">{entry.title}</p>
            <div className="flex justify-between mt-0.5">
              <p className="text-xs text-[#A8A5A0]">{entry.source}</p>
              <p className="text-xs text-[#C0BDB5]">{entry.time}</p>
            </div>
          </div>
        ))}
      </div>
      {/* Save current content */}
      <div className="border-t border-[#E3E0D8] pt-3">
        <p className="text-xs font-medium text-[#7A7870] mb-2">Save to Notebook</p>
        <div className="bg-[#F7F6F2] border border-[#E3E0D8] rounded-lg p-2.5 mb-2">
          <p className="text-xs text-[#3D3C38] italic leading-relaxed">
            "Logistic regression predicts the probability of a class using the sigmoid function."
          </p>
        </div>
        <textarea
          value={noteText}
          onChange={e => setNoteText(e.target.value)}
          placeholder="Why this matters to me…"
          rows={2}
          className="w-full text-xs bg-white border border-[#E3E0D8] rounded-lg px-3 py-2 outline-none focus:border-[#9B9890] transition-all placeholder:text-[#C0BDB5] resize-none mb-2"
        />
        <div className="flex items-center gap-1.5 text-xs text-[#A8A5A0] mb-2">
          <span>Saved from:</span>
          <span className="text-[#5A5850] font-medium">Logistic Regression</span>
          <span>·</span>
          <span>Learning Node</span>
        </div>
        <button
          onClick={() => { onSaved(); setNoteText('') }}
          className="w-full bg-[#5B7A58] text-white text-xs py-2 rounded-md hover:bg-[#4A6948] transition-colors"
        >
          Save
        </button>
      </div>
    </div>
  )
}

function EvidencePanel() {
  const [expanded, setExpanded] = useState<string | null>(null)
  return (
    <div className="flex flex-col h-full overflow-y-auto">
      <div className="mb-4">
        <p className="text-xs font-medium text-[#1A1916] uppercase tracking-widest mb-1">Evidence</p>
        <p className="text-xs text-[#7A7870]">For: Logistic Regression</p>
      </div>
      {/* Grounding summary */}
      <div className="bg-[#EFF4EE] border border-[#C5D9C4] rounded-lg p-3 mb-4">
        <div className="flex justify-between text-xs mb-1">
          <span className="text-[#7A7870]">Grounding</span>
          <span className="text-[#5B7A58] font-medium">Strong</span>
        </div>
        <div className="flex justify-between text-xs">
          <span className="text-[#7A7870]">Sources</span>
          <span className="text-[#1A1916] font-mono">3</span>
        </div>
      </div>

      <div className="space-y-2 mb-5">
        {evidenceSources.map((src, i) => (
          <div key={i} className="bg-white border border-[#E3E0D8] rounded-lg overflow-hidden">
            <button
              onClick={() => setExpanded(expanded === String(i) ? null : String(i))}
              className="w-full p-3 text-left hover:bg-[#F7F6F2] transition-colors"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1">
                  <p className="text-xs font-medium text-[#1A1916] leading-snug">{src.title}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs text-[#A8A5A0]">{src.type}</span>
                    {src.chapter && <span className="text-xs text-[#A8A5A0]">· {src.chapter}</span>}
                    <span className={`text-xs px-1.5 py-0.5 rounded ${
                      src.relevance === 'High' ? 'bg-[#EFF4EE] text-[#5B7A58]' : 'bg-[#F0EEE9] text-[#7A7870]'
                    }`}>{src.relevance}</span>
                  </div>
                </div>
                <span className="text-[#C0BDB5] text-xs flex-shrink-0">{expanded === String(i) ? '▴' : '▾'}</span>
              </div>
            </button>
            {expanded === String(i) && (
              <div className="px-3 pb-3 border-t border-[#F0EEE9]">
                <p className="text-xs text-[#5A5850] italic leading-relaxed mt-2 mb-2">{src.excerpt}</p>
                <div className="flex gap-1.5">
                  <button className="text-xs text-[#7A7870] border border-[#E3E0D8] px-2 py-1 rounded hover:bg-[#F0EEE9] transition-all">Open source</button>
                  <button className="text-xs text-[#7A7870] border border-[#E3E0D8] px-2 py-1 rounded hover:bg-[#F0EEE9] transition-all">View context</button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Content evaluation */}
      <div className="border-t border-[#E3E0D8] pt-4">
        <p className="text-xs font-medium text-[#7A7870] uppercase tracking-widest mb-3">Content Check</p>
        <div className="space-y-2 mb-3">
          {[
            { label: 'Relevance', value: 'High', color: 'text-[#5B7A58]' },
            { label: 'Completeness', value: 'High', color: 'text-[#5B7A58]' },
            { label: 'Evidence', value: 'Strong', color: 'text-[#5B7A58]' },
            { label: 'Grounding', value: '92%', color: 'text-[#1A1916]' },
          ].map((item, i) => (
            <div key={i} className="flex justify-between text-xs">
              <span className="text-[#7A7870]">{item.label}</span>
              <span className={`font-medium ${item.color}`}>{item.value}</span>
            </div>
          ))}
        </div>
        <p className="text-xs text-[#A8A5A0] leading-relaxed">
          Evaluation reflects alignment with retrieved evidence and predefined quality criteria. It does not guarantee factual correctness.
        </p>
      </div>
    </div>
  )
}

function ThreadsPanel({ onOpenThread }: { onOpenThread: () => void }) {
  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between mb-4">
        <p className="text-xs font-medium text-[#1A1916] uppercase tracking-widest">Threads</p>
        <span className="text-xs text-[#A8A5A0]">5 explored</span>
      </div>
      <button className="w-full text-left text-xs border border-dashed border-[#C0BDB5] rounded-lg px-3 py-2 text-[#7A7870] hover:border-[#9B9890] hover:text-[#1A1916] hover:bg-white transition-all mb-3">
        + New Thread
      </button>
      <div className="space-y-1.5 flex-1 overflow-y-auto">
        <p className="text-xs text-[#A8A5A0] mb-1">Recent</p>
        {threads.map(thread => (
          <button
            key={thread.id}
            onClick={onOpenThread}
            className="w-full text-left p-2.5 rounded-lg border border-[#F0EEE9] hover:border-[#E3E0D8] hover:bg-white cursor-pointer transition-all group"
          >
            <div className="flex items-start gap-2">
              <span className="text-[#4A5FA5] text-xs mt-0.5">↗</span>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-[#1A1916] leading-snug">{thread.title}</p>
                <p className="text-xs text-[#A8A5A0] mt-0.5">{thread.parent}</p>
                <p className="text-xs text-[#C0BDB5]">{thread.time}</p>
              </div>
              <span className={`text-xs px-1.5 py-0.5 rounded flex-shrink-0 ${
                thread.status === 'exploring'
                  ? 'bg-[#EEF0F9] text-[#4A5FA5]'
                  : 'bg-[#F0EEE9] text-[#A8A5A0]'
              }`}>{thread.status}</span>
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}

export default function LearningNode({ onNavigate }: LearningNodeProps) {
  const [activeSection, setActiveSection] = useState('Concept')
  const [rightPanel, setRightPanel] = useState<RightPanel>('ai')
  const [nodeStatus, setNodeStatus] = useState<NodeStatus>('in-progress')
  const [showThread, setShowThread] = useState(false)
  const [showCompletionMsg, setShowCompletionMsg] = useState(false)
  const [expandedCallout, setExpandedCallout] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const [showGoDeeper, setShowGoDeeper] = useState(false)
  const [deeperContent, setDeeperContent] = useState<string | null>(null)

  function saveToNotebook() {
    setToast('Saved to Notebook')
    setRightPanel('notebook')
  }

  function handleComplete() {
    setNodeStatus('completed')
    setShowCompletionMsg(true)
  }

  function handleDeeperAction(action: string) {
    if (action === 'Show example') {
      setDeeperContent('example')
    } else if (action === 'Explain differently') {
      setDeeperContent('differently')
    } else {
      setDeeperContent('related')
    }
  }

  const panelTabs: { id: RightPanel; label: string }[] = [
    { id: 'ai', label: 'AI' },
    { id: 'notebook', label: 'Notebook' },
    { id: 'evidence', label: 'Evidence' },
  ]

  return (
    <div className="screen-enter flex h-[calc(100vh-4rem)] gap-0">
      {/* Toast */}
      {toast && <Toast message={toast} onClose={() => setToast(null)} />}

      {/* Left: Curriculum context */}
      <div className="w-52 flex-shrink-0 border-r border-[#E3E0D8] px-4 pt-4 overflow-y-auto">
        <div className="mb-5">
          <p className="text-xs text-[#A8A5A0] uppercase tracking-widest mb-3">Current Path</p>
          {[
            { label: 'Machine Learning', active: false },
            { label: 'Supervised Learning', active: false },
            { label: 'Logistic Regression', active: true },
          ].map((p, i, arr) => (
            <div key={i} className="flex items-start gap-2 mb-1">
              <div className="flex flex-col items-center mt-1.5 flex-shrink-0">
                <div className={`w-1.5 h-1.5 rounded-full ${p.active ? 'bg-[#4A5FA5]' : 'bg-[#C0BDB5]'}`}></div>
                {i < arr.length - 1 && <div className="w-px h-4 bg-[#E3E0D8] my-0.5"></div>}
              </div>
              <button
                onClick={() => !p.active && onNavigate('graph')}
                className={`text-xs leading-relaxed text-left transition-colors ${
                  p.active ? 'text-[#1A1916] font-medium' : 'text-[#7A7870] hover:text-[#1A1916]'
                }`}
              >
                {p.label}
              </button>
            </div>
          ))}
        </div>

        <div className="border-t border-[#E3E0D8] pt-4 mb-4">
          <p className="text-xs text-[#A8A5A0] uppercase tracking-widest mb-3">This Module</p>
          <div className="space-y-0.5">
            {[
              { label: 'Linear Regression', state: 'completed' },
              { label: 'Logistic Regression', state: nodeStatus === 'completed' ? 'completed' : 'current' },
              { label: 'Decision Trees', state: 'locked' },
            ].map((n, i) => (
              <div key={i} className={`flex items-center gap-2 px-2 py-1.5 rounded text-xs transition-all ${
                n.state === 'current' ? 'bg-[#EEF0F9] text-[#4A5FA5]' :
                n.state === 'completed' ? 'text-[#5B7A58]' :
                'text-[#A8A5A0]'
              }`}>
                <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                  n.state === 'completed' ? 'bg-[#5B7A58]' :
                  n.state === 'current' ? 'bg-[#4A5FA5]' : 'bg-[#D4D0C8]'
                }`}></div>
                {n.label}
                {n.state === 'completed' && <span className="ml-auto text-[#5B7A58] text-[9px]">✓</span>}
              </div>
            ))}
          </div>
        </div>

        {/* Session button */}
        <button
          onClick={() => onNavigate('session')}
          className="w-full text-xs border border-[#E3E0D8] text-[#7A7870] px-3 py-2 rounded-lg hover:bg-white hover:border-[#B8B5AD] transition-all flex items-center gap-2"
        >
          <span className="w-1.5 h-1.5 rounded-full bg-[#5B7A58] animate-pulse inline-block"></span>
          View session
        </button>
      </div>

      {/* Center: Learning content */}
      <div className="flex-1 overflow-y-auto px-7 pt-4 pb-8">
        {showThread ? (
          <ExploratoryThread onClose={() => setShowThread(false)} onSave={saveToNotebook} />
        ) : (
          <>
            {/* Node header */}
            <div className="mb-5">
              <div className="flex items-center gap-2 text-xs text-[#A8A5A0] mb-2">
                <span>Supervised Learning</span>
                <span>·</span>
                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border ${
                  nodeStatus === 'completed'
                    ? 'text-[#5B7A58] bg-[#EFF4EE] border-[#C5D9C4]'
                    : 'text-[#4A5FA5] bg-[#EEF0F9] border-[#C5CEED]'
                }`}>
                  <span className={`w-1.5 h-1.5 rounded-full inline-block ${nodeStatus === 'completed' ? 'bg-[#5B7A58]' : 'bg-[#4A5FA5]'}`}></span>
                  {nodeStatus === 'completed' ? 'Completed' : 'In progress'}
                </span>
              </div>
              <h1 className="font-display text-4xl font-light text-[#1A1916] mb-1">Logistic Regression</h1>
              <p className="text-sm text-[#7A7870]">Learning Node · Supervised Learning</p>
            </div>

            {/* Section tabs */}
            <div className="flex gap-0 mb-6 border-b border-[#E3E0D8]">
              {sections.map(s => (
                <button
                  key={s}
                  onClick={() => setActiveSection(s)}
                  className={`text-xs px-3 py-2 -mb-px border-b-2 transition-all ${
                    activeSection === s
                      ? 'border-[#4A5FA5] text-[#4A5FA5] font-medium'
                      : 'border-transparent text-[#7A7870] hover:text-[#1A1916]'
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>

            {/* Main content */}
            <div className="prose-trellis max-w-none">
              {activeSection === 'Concept' && (
                <>
                  <h2>What is Logistic Regression?</h2>
                  <p>
                    Logistic Regression is a <span className="bg-[#EFF4EE] text-[#3D6039] px-1 rounded">classification algorithm</span> used
                    to estimate the probability that an input belongs to a particular class. Despite its name, it is a
                    classification method — not a regression method in the predictive sense.
                  </p>
                  <p>
                    Given input features <code>x</code>, logistic regression predicts P(y=1|x) — the probability the
                    output belongs to the positive class — by passing a linear combination through the sigmoid function.
                  </p>
                  <div
                    className="math-block cursor-pointer hover:bg-[#E8E6E0] transition-colors"
                    onClick={() => setExpandedCallout(expandedCallout === 'sigmoid' ? null : 'sigmoid')}
                  >
                    <span className="text-[#A8A5A0] text-xs block mb-1">Decision function</span>
                    P(y=1|x) = σ(wᵀx + b) = 1 / (1 + e<sup>−(wᵀx+b)</sup>)
                  </div>
                  {expandedCallout === 'sigmoid' && (
                    <div className="callout text-sm">
                      <strong className="text-[#3D6039]">Why σ?</strong> The sigmoid maps any real number to (0,1), making it ideal for
                      probability outputs. As z → ∞, σ(z) → 1; as z → −∞, σ(z) → 0.
                    </div>
                  )}
                  <h2>When to use it</h2>
                  <ul className="list-none space-y-1.5 mb-4">
                    {[
                      'The output is binary (spam/not spam, fraud/not fraud)',
                      'You need interpretable feature weights',
                      'The relationship between features and log-odds is approximately linear',
                      'You want probabilistic predictions, not just class labels',
                    ].map((item, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-[#3D3C38]">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#5B7A58] mt-1.5 flex-shrink-0"></span>
                        {item}
                      </li>
                    ))}
                  </ul>
                  <div className="callout">
                    <span className="text-xs font-medium text-[#5B7A58] block mb-1">Connection to Linear Regression</span>
                    <p className="text-sm text-[#3D3C38] mb-0">
                      Logistic regression is essentially linear regression wrapped in a sigmoid. Where linear regression
                      predicts a continuous value, logistic regression predicts a probability.
                    </p>
                  </div>
                </>
              )}

              {activeSection === 'How It Works' && (
                <>
                  <h2>Training Process</h2>
                  <p>
                    Logistic regression is trained using <span className="bg-[#EFF4EE] text-[#3D6039] px-1 rounded">maximum likelihood estimation</span>.
                    We find weights w that maximize the probability of observing the training labels.
                  </p>
                  <div className="math-block">
                    Loss(w) = −Σ [yᵢ log(σ(wᵀxᵢ)) + (1−yᵢ) log(1−σ(wᵀxᵢ))]
                    <span className="text-[#A8A5A0] text-xs block mt-1">Binary Cross-Entropy Loss</span>
                  </div>
                  <p>
                    This loss function is convex, meaning gradient descent reliably finds the global minimum.
                  </p>
                </>
              )}

              {activeSection === 'Example' && (
                <>
                  <h2>Spam Classification</h2>
                  <p>Predicting whether an email is spam using logistic regression:</p>
                  <div className="bg-[#F0EEE9] rounded-lg border border-[#E3E0D8] p-4 font-mono text-xs mb-4">
                    <p className="text-[#A8A5A0] mb-2">Features:</p>
                    <p className="text-[#3D3C38]">x₁ = keyword frequency = 0.87</p>
                    <p className="text-[#3D3C38]">x₂ = sender reputation = 0.12</p>
                    <p className="text-[#3D3C38]">x₃ = message length = 0.45</p>
                    <p className="text-[#A8A5A0] mt-2 mb-1">Prediction:</p>
                    <p className="text-[#5B7A58] font-medium">P(spam) = σ(2.1·0.87 − 1.8·0.12 + 0.3·0.45) = 0.87</p>
                  </div>
                  <p>With P(spam) = 0.87, the model classifies this as spam (threshold at 0.5).</p>
                  <button
                    onClick={saveToNotebook}
                    className="text-xs text-[#5B7A58] border border-[#C5D9C4] bg-[#EFF4EE] px-3 py-1.5 rounded hover:bg-[#E3EEE2] transition-colors"
                  >
                    Save example
                  </button>
                </>
              )}

              {activeSection !== 'Concept' && activeSection !== 'How It Works' && activeSection !== 'Example' && (
                <p className="text-[#A8A5A0] italic">Click a section tab above to explore that content.</p>
              )}

              {/* Go Deeper */}
              <div className="border-t border-[#E3E0D8] mt-8 pt-6">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-sm font-medium text-[#7A7870]">Go deeper</p>
                  <button
                    onClick={() => { setShowGoDeeper(!showGoDeeper); setDeeperContent(null) }}
                    className="text-xs text-[#A8A5A0] hover:text-[#7A7870]"
                  >{showGoDeeper ? '▴ Less' : '▾ Expand'}</button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {['Explain differently', 'Show example', 'Show practical application', 'Compare concepts', 'Explore related concept'].map((action) => (
                    <button
                      key={action}
                      onClick={() => { setShowGoDeeper(true); handleDeeperAction(action) }}
                      className="text-xs border border-[#E3E0D8] text-[#3D3C38] px-3 py-2 rounded-md hover:border-[#B8B5AD] hover:bg-white transition-all"
                    >
                      {action}
                    </button>
                  ))}
                </div>

                {showGoDeeper && deeperContent === 'example' && (
                  <div className="mt-4 screen-enter">
                    <h2 className="font-display text-lg font-medium text-[#1A1916] mb-3">Worked Example — Spam Classification</h2>
                    <div className="bg-[#F0EEE9] rounded-lg border border-[#E3E0D8] p-4 font-mono text-xs mb-3">
                      <p className="text-[#A8A5A0] mb-2">Features</p>
                      <p>x₁ = keyword frequency = 0.87</p>
                      <p>x₂ = sender reputation = 0.12</p>
                      <p className="text-[#5B7A58] mt-2">P(spam) = 0.87</p>
                    </div>
                    <button onClick={saveToNotebook} className="text-xs text-[#5B7A58] border border-[#C5D9C4] bg-[#EFF4EE] px-3 py-1.5 rounded hover:bg-[#E3EEE2] transition-colors">
                      Save example
                    </button>
                  </div>
                )}
              </div>

              {/* Exploratory thread prompt */}
              <div className="mt-5 p-4 border border-[#E3E0D8] rounded-lg bg-[#F9F8F5] flex items-center justify-between">
                <div>
                  <p className="text-xs text-[#A8A5A0] mb-0.5">Tangential exploration</p>
                  <p className="text-sm text-[#1A1916] font-medium">What is the history of logistic regression?</p>
                </div>
                <button
                  onClick={() => setShowThread(true)}
                  className="text-xs text-[#4A5FA5] border border-[#C5CEED] bg-[#EEF0F9] px-3 py-1.5 rounded-md hover:bg-[#E4E8F5] transition-colors flex items-center gap-1.5 flex-shrink-0 ml-3"
                >
                  <span>↗</span> Explore Thread
                </button>
              </div>

              {/* Node completion */}
              <div className="mt-6 bg-white border border-[#E3E0D8] rounded-xl p-5">
                <p className="text-xs text-[#A8A5A0] uppercase tracking-widest mb-3">Learning Progress</p>
                {showCompletionMsg ? (
                  <div className="screen-enter">
                    <div className="flex items-center gap-2 mb-4">
                      <span className="w-6 h-6 rounded-full bg-[#5B7A58] flex items-center justify-center text-white text-xs flex-shrink-0">✓</span>
                      <p className="font-medium text-[#5B7A58]">Logistic Regression completed</p>
                    </div>
                    <p className="text-xs text-[#7A7870] mb-3">Next recommended node:</p>
                    <div className="bg-[#F7F6F2] border border-[#E3E0D8] rounded-lg p-3 mb-3">
                      <p className="text-sm font-medium text-[#1A1916]">Decision Trees</p>
                      <p className="text-xs text-[#A8A5A0]">Supervised Learning · Available</p>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => onNavigate('graph')} className="flex-1 text-xs bg-[#2D2C28] text-white py-2.5 rounded-md hover:bg-[#1A1916] transition-colors">
                        Continue →
                      </button>
                      <button className="text-xs border border-[#E3E0D8] text-[#7A7870] px-4 py-2.5 rounded-md hover:bg-[#F0EEE9] transition-all">
                        Stay here
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center gap-3 mb-4">
                      {[
                        { label: 'Not started', state: 'inactive' },
                        { label: 'In progress', state: 'active' },
                        { label: 'Completed', state: 'inactive' },
                      ].map((s, i) => (
                        <div key={i} className={`flex items-center gap-1.5 text-xs ${s.state === 'active' ? 'text-[#4A5FA5]' : 'text-[#A8A5A0]'}`}>
                          <div className={`w-3 h-3 rounded-full border flex items-center justify-center ${
                            i === 0 ? 'border-[#D4D0C8]' :
                            i === 1 ? 'border-[#4A5FA5]' : 'border-[#D4D0C8]'
                          }`}>
                            {i === 1 && <div className="w-1.5 h-1.5 rounded-full bg-[#4A5FA5]"></div>}
                          </div>
                          {s.label}
                        </div>
                      ))}
                    </div>
                    <button
                      onClick={handleComplete}
                      className="w-full bg-[#5B7A58] text-white text-sm py-2.5 rounded-lg hover:bg-[#4A6948] transition-colors"
                    >
                      Mark Node Complete
                    </button>
                  </>
                )}
              </div>
            </div>
          </>
        )}
      </div>

      {/* Right: Contextual workspace */}
      <div className="w-72 flex-shrink-0 border-l border-[#E3E0D8] flex flex-col">
        {/* Panel tabs */}
        <div className="flex border-b border-[#E3E0D8] flex-shrink-0">
          {panelTabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setRightPanel(tab.id)}
              className={`flex-1 text-xs py-3 font-medium transition-all border-b-2 ${
                rightPanel === tab.id
                  ? 'border-[#4A5FA5] text-[#4A5FA5] bg-white'
                  : 'border-transparent text-[#7A7870] hover:text-[#1A1916] bg-[#F7F6F2]'
              }`}
            >
              {tab.label}
            </button>
          ))}
          <button
            onClick={() => setRightPanel(rightPanel)}
            className="px-3 text-[#A8A5A0] hover:text-[#7A7870] transition-colors border-b-2 border-transparent bg-[#F7F6F2]"
            title="Threads"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M2 3h10M5 7h7M5 11h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        {/* Panel content */}
        <div className="flex-1 overflow-hidden p-4">
          {rightPanel === 'ai' && <AiPanel onSaveToNotebook={saveToNotebook} />}
          {rightPanel === 'notebook' && <NotebookPanel onSaved={() => setToast('Saved to Notebook')} />}
          {rightPanel === 'evidence' && <EvidencePanel />}
        </div>
      </div>
    </div>
  )
}

function ExploratoryThread({ onClose, onSave }: { onClose: () => void; onSave: () => void }) {
  return (
    <div className="screen-enter">
      {/* Primary path context */}
      <div className="bg-[#F0EEE9] border border-[#E3E0D8] rounded-lg p-3 mb-5 text-xs">
        <p className="text-[#A8A5A0] uppercase tracking-widest mb-2">Primary Path</p>
        <div className="flex items-center gap-1.5 text-[#7A7870]">
          <span>Machine Learning</span>
          <span className="text-[#C0BDB5]">›</span>
          <span>Supervised Learning</span>
          <span className="text-[#C0BDB5]">›</span>
          <span className="font-medium text-[#1A1916]">Logistic Regression</span>
        </div>
        <div className="mt-2 flex items-center gap-1.5 text-[#4A5FA5]">
          <span>↗</span>
          <span className="font-medium">Exploratory Thread: History of Logistic Regression</span>
        </div>
      </div>

      <div className="mb-6">
        <p className="text-xs text-[#A8A5A0] mb-1 uppercase tracking-widest">Exploratory Thread</p>
        <h2 className="font-display text-3xl font-light text-[#1A1916] mb-1">History of Logistic Regression</h2>
        <p className="text-sm text-[#7A7870]">Parent: Logistic Regression · Status: Exploring</p>
      </div>

      <div className="callout mb-5">
        <p className="text-xs font-medium text-[#7A7870] mb-1">Context preserved</p>
        <p className="text-sm text-[#3D3C38]">
          This thread is isolated from your primary learning path. Your progress on Logistic Regression is unaffected. Return when you're ready.
        </p>
      </div>

      <div className="prose-trellis">
        <h2>Origins in the 19th century</h2>
        <p>
          The logistic function was introduced by Belgian mathematician <span className="bg-[#EFF4EE] text-[#3D6039] px-1 rounded">Pierre François Verhulst</span> in 1838
          to describe population growth. The term "logistic" comes from the Greek logos (ratio), describing the S-shaped curve now central to the algorithm.
        </p>
        <p>
          Joseph Berkson coined the term <code>logit</code> in 1944, establishing the theoretical foundation for the
          log-odds transformation that logistic regression optimizes.
        </p>
        <h2>Adoption in machine learning</h2>
        <p>
          By the 1980s, logistic regression was established in biostatistics and epidemiology. Its adoption in machine
          learning was partly driven by its simplicity, interpretability, and its function as a single-layer neural network
          with a sigmoid activation.
        </p>
      </div>

      <div className="flex gap-3 mt-8 border-t border-[#E3E0D8] pt-5">
        <button onClick={onClose} className="text-sm border border-[#E3E0D8] text-[#3D3C38] px-4 py-2 rounded-md hover:bg-white transition-all flex items-center gap-1.5">
          ← Return to Learning Node
        </button>
        <button onClick={onSave} className="text-sm border border-[#C5D9C4] text-[#5B7A58] bg-[#EFF4EE] px-4 py-2 rounded-md hover:bg-[#E3EEE2] transition-colors">
          Save Insight to Notebook
        </button>
      </div>
    </div>
  )
}
