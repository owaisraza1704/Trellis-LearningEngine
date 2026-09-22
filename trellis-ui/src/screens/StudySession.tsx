interface StudySessionProps {
  onNavigate: (screen: string) => void
}

const timeline = [
  { time: '10:32', event: 'Started Logistic Regression', type: 'start' },
  { time: '10:47', event: 'Asked about sigmoid function', type: 'question' },
  { time: '10:52', event: 'Saved explanation to Notebook', type: 'save' },
  { time: '11:03', event: 'Opened evidence panel', type: 'evidence' },
  { time: '11:16', event: 'Created exploratory thread', type: 'thread' },
  { time: '11:28', event: 'Returned to primary node', type: 'return' },
  { time: '11:32', event: 'Currently studying', type: 'active' },
]

const typeColor: Record<string, string> = {
  start: '#5B7A58',
  question: '#4A5FA5',
  save: '#5B7A58',
  evidence: '#7A7060',
  thread: '#4A5FA5',
  return: '#7A7870',
  active: '#4A5FA5',
}

export default function StudySession({ onNavigate }: StudySessionProps) {
  return (
    <div className="screen-enter max-w-2xl">
      <div className="mb-7">
        <div className="flex items-center gap-2 text-xs text-[#A8A5A0] mb-2">
          <button onClick={() => onNavigate('dashboard')} className="hover:text-[#1A1916] transition-colors">Dashboard</button>
          <span>/</span>
          <span>Study Session</span>
        </div>
        <h1 className="font-display text-3xl font-light text-[#1A1916] mb-1">Study Session</h1>
        <p className="text-sm text-[#7A7870]">Machine Learning · Logistic Regression</p>
      </div>

      {/* Session header card */}
      <div className="bg-white border border-[#E3E0D8] rounded-xl p-5 mb-7 flex items-center justify-between">
        <div className="space-y-2">
          <div>
            <p className="text-xs text-[#A8A5A0] uppercase tracking-widest mb-0.5">Current Session</p>
            <p className="font-display text-lg font-medium text-[#1A1916]">Machine Learning</p>
            <p className="text-sm text-[#7A7870]">Logistic Regression</p>
          </div>
          <div className="flex items-center gap-4 text-sm">
            <div>
              <p className="text-xs text-[#A8A5A0]">Started</p>
              <p className="font-mono text-[#1A1916] text-sm">10:32 AM</p>
            </div>
            <div className="w-px h-8 bg-[#E3E0D8]"></div>
            <div>
              <p className="text-xs text-[#A8A5A0]">Duration</p>
              <p className="font-mono text-[#1A1916] text-sm">1h 02m</p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 self-start">
          <span className="w-2 h-2 rounded-full bg-[#5B7A58] animate-pulse"></span>
          <span className="text-xs text-[#5B7A58] font-medium">Active</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 mb-7">
        {/* Timeline */}
        <div className="lg:col-span-2">
          <p className="text-xs text-[#A8A5A0] uppercase tracking-widest mb-4">Session Timeline</p>
          <div className="relative">
            <div className="absolute left-[19px] top-0 bottom-0 w-px bg-[#E3E0D8]"></div>
            <div className="space-y-4">
              {timeline.map((item, i) => (
                <div key={i} className="flex items-start gap-4 relative">
                  <div
                    className="w-10 h-10 rounded-full border-2 flex items-center justify-center flex-shrink-0 bg-white z-10"
                    style={{ borderColor: typeColor[item.type] || '#C0BDB5' }}
                  >
                    <span className="font-mono text-[9px] text-[#7A7870]">{item.time}</span>
                  </div>
                  <div className={`flex-1 pt-2 ${item.type === 'active' ? 'opacity-70' : ''}`}>
                    <p className={`text-sm ${item.type === 'active' ? 'text-[#4A5FA5] font-medium flex items-center gap-1.5' : 'text-[#1A1916]'}`}>
                      {item.type === 'active' && <span className="w-1.5 h-1.5 rounded-full bg-[#4A5FA5] animate-pulse inline-block"></span>}
                      {item.event}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Summary panel */}
        <div>
          <p className="text-xs text-[#A8A5A0] uppercase tracking-widest mb-4">Session Summary</p>
          <div className="bg-white border border-[#E3E0D8] rounded-xl p-4 space-y-3">
            {[
              { label: 'Nodes studied', value: '3' },
              { label: 'Questions explored', value: '12' },
              { label: 'Threads created', value: '2' },
              { label: 'Sources consulted', value: '4' },
              { label: 'Notes saved', value: '2' },
            ].map((s, i) => (
              <div key={i} className="flex items-center justify-between">
                <span className="text-sm text-[#7A7870]">{s.label}</span>
                <span className="font-display text-lg font-light text-[#1A1916]">{s.value}</span>
              </div>
            ))}
          </div>

          <div className="mt-4 space-y-2">
            <button className="w-full text-sm bg-[#EFF4EE] border border-[#C5D9C4] text-[#5B7A58] py-2.5 rounded-lg hover:bg-[#E3EEE2] transition-colors">
              Add to Notebook
            </button>
            <button className="w-full text-sm border border-[#E3E0D8] text-[#3D3C38] py-2.5 rounded-lg hover:bg-white transition-all">
              Export Session
            </button>
            <button
              onClick={() => onNavigate('node')}
              className="w-full text-sm bg-[#2D2C28] text-white py-2.5 rounded-lg hover:bg-[#1A1916] transition-colors"
            >
              Continue Learning →
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
