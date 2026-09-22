interface DashboardProps {
  onNavigate: (screen: string) => void
}

const journeys = [
  {
    id: 'ml',
    title: 'Machine Learning',
    progress: 42,
    completedNodes: 18,
    totalNodes: 43,
    lastTopic: 'Logistic Regression',
    lastStudied: '2 hours ago',
    color: '#5B7A58',
  },
  {
    id: 'sysdesign',
    title: 'System Design',
    progress: 28,
    completedNodes: 11,
    totalNodes: 39,
    lastTopic: 'Load Balancing',
    lastStudied: 'Yesterday',
    color: '#4A5FA5',
  },
  {
    id: 'django',
    title: 'Django',
    progress: 61,
    completedNodes: 22,
    totalNodes: 36,
    lastTopic: 'ORM Relationships',
    lastStudied: '3 days ago',
    color: '#7A5B38',
  },
  {
    id: 'networks',
    title: 'Computer Networks',
    progress: 15,
    completedNodes: 6,
    totalNodes: 40,
    lastTopic: 'TCP/IP Model',
    lastStudied: '1 week ago',
    color: '#5B6A7A',
  },
]

const recentNodes = [
  { title: 'Logistic Regression', journey: 'Machine Learning', time: '2 hours ago', status: 'current' },
  { title: 'Linear Regression', journey: 'Machine Learning', time: '4 hours ago', status: 'completed' },
  { title: 'Load Balancing', journey: 'System Design', time: 'Yesterday', status: 'completed' },
  { title: 'ORM Relationships', journey: 'Django', time: '3 days ago', status: 'completed' },
]

const savedNotes = [
  { title: 'Sigmoid function intuition', source: 'Logistic Regression', date: 'Today' },
  { title: 'Why linear algebra matters for ML', source: 'Linear Algebra', date: 'Yesterday' },
  { title: 'CAP Theorem explained', source: 'System Design', date: '2 days ago' },
]

export default function Dashboard({ onNavigate }: DashboardProps) {
  return (
    <div className="screen-enter">
      {/* Greeting */}
      <div className="mb-8">
        <p className="text-xs text-[#A8A5A0] uppercase tracking-widest mb-1">Sunday, September 20</p>
        <h1 className="font-display text-3xl font-light text-[#1A1916]">Continue learning</h1>
      </div>

      {/* Active journey hero card */}
      <div
        className="bg-white border border-[#E3E0D8] rounded-xl p-6 mb-8 cursor-pointer hover:border-[#B8B5AD] hover:shadow-sm transition-all group"
        onClick={() => onNavigate('graph')}
      >
        <div className="flex items-start justify-between mb-5">
          <div>
            <p className="text-xs text-[#7A7870] uppercase tracking-widest mb-1">Active Journey</p>
            <h2 className="font-display text-2xl font-medium text-[#1A1916]">Machine Learning</h2>
            <p className="text-sm text-[#7A7870] mt-0.5">Foundations → Mathematics → Supervised Learning</p>
          </div>
          <div className="text-right">
            <span className="font-display text-3xl font-light text-[#5B7A58]">42%</span>
            <p className="text-xs text-[#A8A5A0]">18 of 43 nodes</p>
          </div>
        </div>

        {/* Progress bar */}
        <div className="w-full bg-[#EEF0EB] rounded-full h-1.5 mb-5">
          <div className="bg-[#5B7A58] h-1.5 rounded-full transition-all" style={{ width: '42%' }}></div>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm">
            <span className="w-2 h-2 rounded-full bg-[#4A5FA5] inline-block"></span>
            <span className="text-[#1A1916] font-medium">Continue with Logistic Regression</span>
            <span className="text-[#A8A5A0]">· last studied 2 hours ago</span>
          </div>
          <button
            onClick={(e) => { e.stopPropagation(); onNavigate('node') }}
            className="text-xs bg-[#2D2C28] text-white px-4 py-2 rounded-md opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1.5"
          >
            Continue <span>→</span>
          </button>
        </div>
      </div>

      {/* Two-column below */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Learning journeys */}
        <div className="lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-medium text-[#1A1916]">Your Learning Journeys</h3>
            <button
              onClick={() => onNavigate('create')}
              className="text-xs text-[#5B7A58] hover:text-[#3D6039] transition-colors flex items-center gap-1"
            >
              + New journey
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {journeys.map((j) => (
              <div
                key={j.id}
                onClick={() => onNavigate('graph')}
                className="bg-white border border-[#E3E0D8] rounded-lg p-4 cursor-pointer hover:border-[#B8B5AD] hover:shadow-sm transition-all"
              >
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <div className="w-2 h-2 rounded-full mb-2" style={{ backgroundColor: j.color }}></div>
                    <p className="font-medium text-sm text-[#1A1916]">{j.title}</p>
                  </div>
                  <span className="text-xs font-mono text-[#7A7870]">{j.progress}%</span>
                </div>
                <div className="w-full bg-[#EEF0EB] rounded-full h-1 mb-3">
                  <div className="h-1 rounded-full transition-all" style={{ width: `${j.progress}%`, backgroundColor: j.color }}></div>
                </div>
                <div className="flex items-center justify-between text-xs text-[#A8A5A0]">
                  <span>{j.completedNodes}/{j.totalNodes} nodes</span>
                  <span>{j.lastStudied}</span>
                </div>
                <p className="text-xs text-[#7A7870] mt-1.5 truncate">Last: {j.lastTopic}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Right panel */}
        <div className="space-y-5">
          {/* Recent learning */}
          <div>
            <h3 className="text-sm font-medium text-[#1A1916] mb-3">Recent Learning</h3>
            <div className="space-y-1.5">
              {recentNodes.map((n, i) => (
                <div
                  key={i}
                  onClick={() => onNavigate('node')}
                  className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-white hover:border hover:border-[#E3E0D8] cursor-pointer transition-all group"
                >
                  <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                    n.status === 'current' ? 'bg-[#4A5FA5]' : 'bg-[#5B7A58]'
                  }`}></div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-[#1A1916] truncate">{n.title}</p>
                    <p className="text-xs text-[#A8A5A0]">{n.journey}</p>
                  </div>
                  <span className="text-xs text-[#C0BDB5] group-hover:text-[#7A7870] transition-colors flex-shrink-0">{n.time}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Saved knowledge */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-medium text-[#1A1916]">Saved Knowledge</h3>
              <button onClick={() => onNavigate('notebook')} className="text-xs text-[#A8A5A0] hover:text-[#5B7A58] transition-colors">
                View all
              </button>
            </div>
            <div className="space-y-2">
              {savedNotes.map((n, i) => (
                <div key={i} className="p-3 bg-white border border-[#E3E0D8] rounded-lg hover:border-[#B8B5AD] cursor-pointer transition-all">
                  <p className="text-sm text-[#1A1916] font-medium mb-0.5">{n.title}</p>
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-[#A8A5A0]">{n.source}</p>
                    <p className="text-xs text-[#C0BDB5]">{n.date}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Quick stats */}
          <div className="bg-[#F0EEE9] border border-[#E3E0D8] rounded-lg p-4">
            <p className="text-xs text-[#A8A5A0] uppercase tracking-widest mb-3">This week</p>
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: 'Nodes studied', value: '12' },
                { label: 'Threads explored', value: '5' },
                { label: 'Notes saved', value: '18' },
                { label: 'Sources cited', value: '34' },
              ].map((s, i) => (
                <div key={i}>
                  <p className="font-display text-xl font-light text-[#1A1916]">{s.value}</p>
                  <p className="text-xs text-[#7A7870]">{s.label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
