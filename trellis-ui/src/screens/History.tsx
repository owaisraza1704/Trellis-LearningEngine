interface HistoryProps {
  onNavigate: (screen: string) => void
}

const historyItems = [
  {
    date: 'Today',
    entries: [
      { title: 'Logistic Regression', type: 'Learning Node', journey: 'Machine Learning', duration: '42 min', time: '10:32 AM', status: 'in-progress' },
      { title: 'History of Logistic Regression', type: 'Exploratory Thread', journey: 'Machine Learning', duration: '18 min', time: '09:14 AM', status: 'completed' },
    ],
  },
  {
    date: 'Yesterday',
    entries: [
      { title: 'Linear Regression', type: 'Learning Node', journey: 'Machine Learning', duration: '31 min', time: '03:20 PM', status: 'completed' },
      { title: 'Probability', type: 'Learning Node', journey: 'Machine Learning', duration: '22 min', time: '02:40 PM', status: 'completed' },
    ],
  },
  {
    date: 'September 18',
    entries: [
      { title: 'Load Balancing', type: 'Learning Node', journey: 'System Design', duration: '25 min', time: '11:05 AM', status: 'completed' },
      { title: 'CAP Theorem', type: 'Learning Node', journey: 'System Design', duration: '19 min', time: '10:30 AM', status: 'completed' },
    ],
  },
  {
    date: 'September 16',
    entries: [
      { title: 'ORM Relationships', type: 'Learning Node', journey: 'Django', duration: '35 min', time: '04:00 PM', status: 'completed' },
    ],
  },
]

const typeIcon: Record<string, string> = {
  'Learning Node': '◈',
  'Exploratory Thread': '↗',
}

export default function History({ onNavigate }: HistoryProps) {
  return (
    <div className="screen-enter max-w-2xl">
      <div className="mb-7">
        <h1 className="font-display text-3xl font-light text-[#1A1916] mb-1">Learning History</h1>
        <p className="text-sm text-[#7A7870]">Everything you've studied, in order.</p>
      </div>

      {/* Resume banner */}
      <div className="bg-white border border-[#E3E0D8] rounded-xl p-4 mb-7 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="w-2 h-2 rounded-full bg-[#4A5FA5] inline-block flex-shrink-0"></span>
          <div>
            <p className="text-sm font-medium text-[#1A1916]">Continue where you left off</p>
            <p className="text-xs text-[#7A7870]">Logistic Regression · 42 min in · 2 hours ago</p>
          </div>
        </div>
        <button
          onClick={() => onNavigate('node')}
          className="text-xs bg-[#2D2C28] text-white px-4 py-2 rounded-md hover:bg-[#1A1916] transition-colors"
        >
          Resume →
        </button>
      </div>

      {/* Timeline */}
      <div className="space-y-7">
        {historyItems.map((group) => (
          <div key={group.date}>
            <p className="text-xs font-medium text-[#A8A5A0] uppercase tracking-widest mb-3">{group.date}</p>
            <div className="space-y-2">
              {group.entries.map((entry, i) => (
                <div
                  key={i}
                  className="bg-white border border-[#E3E0D8] rounded-lg p-4 flex items-center gap-4 hover:border-[#B8B5AD] transition-all group"
                >
                  <div className="w-8 h-8 rounded-lg bg-[#F0EEE9] flex items-center justify-center text-sm text-[#7A7870] flex-shrink-0">
                    {typeIcon[entry.type] || '◈'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <p className="text-sm font-medium text-[#1A1916] truncate">{entry.title}</p>
                      {entry.status === 'in-progress' && (
                        <span className="text-xs text-[#4A5FA5] bg-[#EEF0F9] border border-[#C5CEED] px-1.5 py-0.5 rounded-full flex-shrink-0">in progress</span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-xs text-[#A8A5A0]">
                      <span>{entry.type}</span>
                      <span>·</span>
                      <span>{entry.journey}</span>
                      <span>·</span>
                      <span>{entry.time}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <span className="text-xs text-[#A8A5A0] font-mono">{entry.duration}</span>
                    <div className="flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => onNavigate('node')}
                        className="text-xs text-[#5B7A58] border border-[#C5D9C4] bg-[#EFF4EE] px-2.5 py-1 rounded hover:bg-[#E3EEE2] transition-colors"
                      >
                        Resume
                      </button>
                      <button className="text-xs text-[#7A7870] border border-[#E3E0D8] px-2.5 py-1 rounded hover:bg-[#F0EEE9] transition-colors">
                        View
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
