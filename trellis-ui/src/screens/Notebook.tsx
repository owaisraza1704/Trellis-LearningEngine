import { useState } from 'react'

function ExportModal({ onClose }: { onClose: () => void }) {
  const [exported, setExported] = useState(false)
  const [options, setOptions] = useState({
    selectedNotes: true,
    sources: true,
    sessionSummary: true,
    threads: true,
    fullNode: false,
  })

  const toggleOption = (key: keyof typeof options) => setOptions(o => ({ ...o, [key]: !o[key] }))

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm">
      <div className="bg-white border border-[#E3E0D8] rounded-xl shadow-2xl w-[440px] p-6 screen-enter">
        {exported ? (
          <div className="text-center py-4">
            <div className="w-10 h-10 rounded-full bg-[#EFF4EE] border border-[#C5D9C4] flex items-center justify-center mx-auto mb-3">
              <span className="text-[#5B7A58]">✓</span>
            </div>
            <h2 className="font-display text-xl font-medium text-[#1A1916] mb-1">PDF prepared</h2>
            <p className="text-sm text-[#7A7870] mb-5">Machine Learning Notes · 12 pages</p>
            <button onClick={onClose} className="bg-[#2D2C28] text-white text-sm px-6 py-2.5 rounded-lg hover:bg-[#1A1916] transition-colors">
              Done
            </button>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-display text-xl font-medium text-[#1A1916]">Export Study Material</h2>
              <button onClick={onClose} className="text-[#A8A5A0] hover:text-[#1A1916] text-xl transition-colors">×</button>
            </div>
            <p className="text-xs font-medium text-[#7A7870] uppercase tracking-wide mb-3">Include</p>
            <div className="space-y-2 mb-5">
              {(Object.entries({
                selectedNotes: 'Selected notes',
                sources: 'Sources',
                sessionSummary: 'Study session summary',
                threads: 'Exploratory threads',
                fullNode: 'Full learning node',
              }) as [keyof typeof options, string][]).map(([key, label]) => (
                <label key={key} className="flex items-center gap-2.5 cursor-pointer">
                  <div
                    onClick={() => toggleOption(key)}
                    className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 transition-all ${options[key] ? 'bg-[#5B7A58] border-[#5B7A58]' : 'border-[#C0BDB5]'}`}
                  >
                    {options[key] && <span className="text-white text-[9px]">✓</span>}
                  </div>
                  <span className="text-sm text-[#3D3C38]">{label}</span>
                </label>
              ))}
            </div>
            <div className="bg-[#F7F6F2] border border-[#E3E0D8] rounded-lg p-3 mb-5">
              <p className="text-xs text-[#A8A5A0] mb-2">Preview</p>
              <p className="text-sm font-medium text-[#1A1916]">Machine Learning</p>
              <p className="text-xs text-[#7A7870]">Logistic Regression · est. 12 pages</p>
            </div>
            <div className="flex gap-2">
              <button onClick={onClose} className="flex-1 border border-[#E3E0D8] text-[#3D3C38] text-sm py-2.5 rounded-lg hover:bg-[#F0EEE9] transition-all">
                Cancel
              </button>
              <button onClick={() => setExported(true)} className="flex-1 bg-[#2D2C28] text-white text-sm py-2.5 rounded-lg hover:bg-[#1A1916] transition-colors">
                Export PDF
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

const categories = ['All Notes', 'Machine Learning', 'Saved Explanations', 'Examples', 'Study Sessions']

interface NotebookEntry {
  id: string
  title: string
  source: string
  category: string
  date: string
  tags: string[]
  content: string
  type: 'explanation' | 'note' | 'example' | 'session'
}

const entries: NotebookEntry[] = [
  {
    id: '1',
    title: 'Sigmoid function intuition',
    source: 'Logistic Regression',
    category: 'Machine Learning',
    date: 'Today, 11:32',
    tags: ['sigmoid', 'probability', 'classification'],
    type: 'explanation',
    content: 'The sigmoid maps any real number to (0,1). For logistic regression, this is ideal because we want P(y=1|x) to be a valid probability. As z → ∞, σ(z) → 1; as z → −∞, σ(z) → 0. The function is differentiable everywhere, which makes gradient descent viable.',
  },
  {
    id: '2',
    title: 'Why linear algebra matters for ML',
    source: 'Linear Algebra',
    category: 'Machine Learning',
    date: 'Yesterday, 14:10',
    tags: ['linear algebra', 'vectors', 'matrices'],
    type: 'note',
    content: 'Most machine learning operations are fundamentally linear algebra: dot products measure similarity, matrix multiplication transforms feature spaces, eigenvectors reveal directions of maximum variance (PCA). Understanding the math lets you reason about why algorithms work rather than treating them as black boxes.',
  },
  {
    id: '3',
    title: 'CAP Theorem — saved explanation',
    source: 'System Design',
    category: 'Saved Explanations',
    date: '2 days ago',
    tags: ['cap theorem', 'distributed systems', 'consistency'],
    type: 'explanation',
    content: 'A distributed system can guarantee at most two of: Consistency (all nodes return the same data), Availability (every request gets a response), and Partition tolerance (system operates despite network failures). In practice, networks do fail, so real systems choose CA or CP — you cannot escape the trade-off.',
  },
  {
    id: '4',
    title: 'Study Session — Sept 19',
    source: 'Machine Learning',
    category: 'Study Sessions',
    date: '3 days ago',
    tags: ['session', 'logistic regression', 'sigmoid'],
    type: 'session',
    content: '55 minutes · 3 nodes covered · 12 questions explored · 4 sources cited · 2 notes saved',
  },
]

export default function Notebook() {
  const [activeCategory, setActiveCategory] = useState('All Notes')
  const [selectedEntry, setSelectedEntry] = useState<NotebookEntry>(entries[0])
  const [search, setSearch] = useState('')
  const [showExport, setShowExport] = useState(false)

  const filtered = entries.filter(e => {
    const matchCat = activeCategory === 'All Notes' || e.category === activeCategory || e.type === activeCategory.toLowerCase()
    const matchSearch = !search || e.title.toLowerCase().includes(search.toLowerCase()) || e.content.toLowerCase().includes(search.toLowerCase())
    return matchCat && matchSearch
  })

  const typeIcon: Record<string, string> = {
    explanation: '⬡',
    note: '◈',
    example: '◇',
    session: '◉',
  }

  return (
    <div className="screen-enter flex h-[calc(100vh-4rem)] gap-0">
      {showExport && <ExportModal onClose={() => setShowExport(false)} />}
      {/* Sidebar */}
      <div className="w-52 flex-shrink-0 border-r border-[#E3E0D8] pr-5">
        <div className="mb-5">
          <h2 className="font-display text-xl font-medium text-[#1A1916] mb-4">Notebook</h2>
          <div className="relative">
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search…"
              className="w-full text-xs bg-[#F0EEE9] border border-[#E3E0D8] rounded-lg pl-3 pr-3 py-2 outline-none focus:bg-white focus:border-[#9B9890] transition-all placeholder:text-[#C0BDB5]"
            />
          </div>
        </div>
        <div className="space-y-0.5">
          {categories.map(cat => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`w-full text-left text-xs px-2.5 py-2 rounded-md transition-all ${
                activeCategory === cat
                  ? 'bg-[#2D2C28] text-white'
                  : 'text-[#7A7870] hover:bg-[#F0EEE9] hover:text-[#1A1916]'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
        <div className="mt-6 pt-4 border-t border-[#E3E0D8]">
          <p className="text-xs text-[#A8A5A0] mb-2">Quick stats</p>
          <div className="space-y-1">
            {[
              { label: 'Total notes', value: '27' },
              { label: 'Journeys', value: '4' },
              { label: 'Sessions', value: '12' },
            ].map((s, i) => (
              <div key={i} className="flex justify-between text-xs">
                <span className="text-[#A8A5A0]">{s.label}</span>
                <span className="font-mono text-[#1A1916]">{s.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Entry list */}
      <div className="w-64 flex-shrink-0 border-r border-[#E3E0D8] px-4 overflow-y-auto">
        <div className="flex items-center justify-between py-3 mb-1 sticky top-0 bg-[#F7F6F2]">
          <span className="text-xs text-[#A8A5A0]">{filtered.length} entries</span>
          <button onClick={() => setShowExport(true)} className="text-xs text-[#A8A5A0] hover:text-[#7A7870] transition-colors">Export PDF</button>
        </div>
        <div className="space-y-1.5">
          {filtered.map(entry => (
            <div
              key={entry.id}
              onClick={() => setSelectedEntry(entry)}
              className={`p-3 rounded-lg cursor-pointer transition-all ${
                selectedEntry.id === entry.id
                  ? 'bg-white border border-[#C0BDB5] shadow-sm'
                  : 'hover:bg-white hover:border hover:border-[#E3E0D8]'
              }`}
            >
              <div className="flex items-start gap-2 mb-1.5">
                <span className="text-[#A8A5A0] text-sm mt-0.5 flex-shrink-0">{typeIcon[entry.type]}</span>
                <p className="text-sm font-medium text-[#1A1916] leading-snug">{entry.title}</p>
              </div>
              <p className="text-xs text-[#A8A5A0] ml-5">{entry.source}</p>
              <p className="text-xs text-[#C0BDB5] ml-5 mt-0.5">{entry.date}</p>
              <div className="flex flex-wrap gap-1 mt-2 ml-5">
                {entry.tags.slice(0, 2).map(t => (
                  <span key={t} className="text-xs bg-[#F0EEE9] text-[#7A7870] px-1.5 py-0.5 rounded">#{t}</span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Entry content */}
      <div className="flex-1 pl-8 pt-4 overflow-y-auto">
        <div className="max-w-2xl">
          <div className="flex items-start justify-between mb-5">
            <div>
              <div className="flex items-center gap-2 text-xs text-[#A8A5A0] mb-2">
                <span>{selectedEntry.source}</span>
                <span>·</span>
                <span>{selectedEntry.date}</span>
              </div>
              <h2 className="font-display text-2xl font-light text-[#1A1916]">{selectedEntry.title}</h2>
            </div>
            <div className="flex gap-2 flex-shrink-0 ml-4">
              <button className="text-xs border border-[#E3E0D8] text-[#7A7870] px-3 py-1.5 rounded-md hover:bg-white transition-all">Edit</button>
              <button onClick={() => setShowExport(true)} className="text-xs border border-[#E3E0D8] text-[#7A7870] px-3 py-1.5 rounded-md hover:bg-white transition-all">Export PDF</button>
            </div>
          </div>

          <div className="flex flex-wrap gap-1.5 mb-6">
            {selectedEntry.tags.map(t => (
              <span key={t} className="text-xs bg-[#F0EEE9] text-[#7A7870] border border-[#E3E0D8] px-2 py-0.5 rounded-full">#{t}</span>
            ))}
          </div>

          {selectedEntry.type === 'session' ? (
            <div className="bg-white border border-[#E3E0D8] rounded-xl p-6">
              <p className="text-xs text-[#A8A5A0] uppercase tracking-widest mb-4">Session Summary</p>
              <p className="text-sm text-[#3D3C38] leading-relaxed mb-5">{selectedEntry.content}</p>
              <div className="grid grid-cols-2 gap-4">
                {[
                  { label: 'Duration', value: '55 min' },
                  { label: 'Nodes covered', value: '3' },
                  { label: 'Questions explored', value: '12' },
                  { label: 'Sources cited', value: '4' },
                ].map((s, i) => (
                  <div key={i} className="bg-[#F7F6F2] rounded-lg p-3">
                    <p className="font-display text-xl font-light text-[#1A1916]">{s.value}</p>
                    <p className="text-xs text-[#7A7870]">{s.label}</p>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="prose-trellis">
              <p>{selectedEntry.content}</p>
              <div className="bg-white border border-[#E3E0D8] rounded-lg p-4 mt-6">
                <p className="text-xs text-[#A8A5A0] uppercase tracking-widest mb-3">Source Reference</p>
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded bg-[#EFF4EE] flex items-center justify-center text-[#5B7A58] text-sm">⬡</div>
                  <div>
                    <p className="text-sm font-medium text-[#1A1916]">From: {selectedEntry.source}</p>
                    <p className="text-xs text-[#A8A5A0]">Machine Learning Journey · {selectedEntry.date}</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="mt-8 pt-5 border-t border-[#E3E0D8]">
            <p className="text-xs text-[#A8A5A0] mb-3">Your notes</p>
            <textarea
              placeholder="Add your own reflection…"
              rows={3}
              className="w-full bg-white border border-[#E3E0D8] rounded-lg px-4 py-3 text-sm text-[#1A1916] placeholder:text-[#C0BDB5] outline-none focus:border-[#9B9890] transition-all resize-none leading-relaxed"
            />
          </div>
        </div>
      </div>
    </div>
  )
}
