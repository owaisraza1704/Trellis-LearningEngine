import { useState } from 'react'

interface CreateJourneyProps {
  onNavigate: (screen: string) => void
}

type BuildState = 'idle' | 'processing' | 'done'

const processingSteps = [
  { label: 'Understanding goal', done: true },
  { label: 'Structuring concepts', done: true },
  { label: 'Identifying prerequisites', done: true },
  { label: 'Building curriculum', done: false },
]

const suggestedTopics = [
  'Learn Machine Learning from fundamentals to practical applications',
  'Understand system design for large-scale distributed systems',
  'Master React and modern frontend development',
  'Build a foundation in probability and statistics',
]

export default function CreateJourney({ onNavigate }: CreateJourneyProps) {
  const [goal, setGoal] = useState('')
  const [buildState, setBuildState] = useState<BuildState>('idle')
  const [stepsDone, setStepsDone] = useState(0)

  function handleBuild() {
    if (!goal.trim()) return
    setBuildState('processing')
    setStepsDone(0)
    // Simulate progressive steps
    let step = 0
    const iv = setInterval(() => {
      step++
      setStepsDone(step)
      if (step >= processingSteps.length) {
        clearInterval(iv)
        setTimeout(() => {
          setBuildState('done')
        }, 600)
      }
    }, 700)
  }

  if (buildState === 'done') {
    return (
      <div className="screen-enter max-w-2xl mx-auto py-12">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-[#EFF4EE] border border-[#C5D9C4] mb-4">
            <span className="text-[#5B7A58] text-lg">✓</span>
          </div>
          <h2 className="font-display text-2xl font-light text-[#1A1916] mb-1">Curriculum built</h2>
          <p className="text-sm text-[#7A7870]">{goal}</p>
        </div>
        <div className="bg-white border border-[#E3E0D8] rounded-xl p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-display text-lg font-medium text-[#1A1916]">Machine Learning</h3>
            <span className="text-xs text-[#7A7870]">43 nodes · 4 modules</span>
          </div>
          <div className="space-y-3">
            {['Foundations', 'Mathematics', 'Supervised Learning', 'Model Evaluation'].map((m, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="w-6 h-6 rounded bg-[#F0EEE9] flex items-center justify-center text-xs text-[#7A7870] font-mono flex-shrink-0">
                  {String(i + 1).padStart(2, '0')}
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-[#1A1916]">{m}</p>
                  <p className="text-xs text-[#A8A5A0]">{[3, 3, 3, 3][i]} nodes</p>
                </div>
                <div className="w-16 bg-[#EEF0EB] rounded-full h-1">
                  <div className="bg-[#5B7A58] h-1 rounded-full" style={{ width: '0%' }}></div>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="flex gap-3 justify-center">
          <button
            onClick={() => onNavigate('graph')}
            className="bg-[#2D2C28] text-white text-sm px-6 py-3 rounded-md hover:bg-[#1A1916] transition-colors"
          >
            View Curriculum Graph
          </button>
          <button
            onClick={() => onNavigate('node')}
            className="border border-[#E3E0D8] text-[#3D3C38] text-sm px-6 py-3 rounded-md hover:bg-white transition-all"
          >
            Start First Node
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="screen-enter max-w-2xl mx-auto py-12">
      {buildState === 'idle' ? (
        <>
          <div className="text-center mb-10">
            <h1 className="font-display text-4xl font-light text-[#1A1916] mb-3">What do you want to learn?</h1>
            <p className="text-[#7A7870] text-sm">Describe a topic, a goal, or a question. Trellis will build the structure.</p>
          </div>

          <div className="relative mb-4">
            <textarea
              value={goal}
              onChange={e => setGoal(e.target.value)}
              placeholder="e.g. Learn Machine Learning from fundamentals to practical applications"
              rows={4}
              className="w-full bg-white border border-[#E3E0D8] rounded-xl px-5 py-4 text-sm text-[#1A1916] placeholder:text-[#C0BDB5] outline-none focus:border-[#9B9890] focus:shadow-sm transition-all resize-none leading-relaxed"
            />
            <span className="absolute bottom-3 right-3 text-xs text-[#C0BDB5]">{goal.length}</span>
          </div>

          <button
            onClick={handleBuild}
            disabled={!goal.trim()}
            className="w-full bg-[#2D2C28] text-white py-3.5 rounded-xl text-sm font-medium hover:bg-[#1A1916] disabled:opacity-30 disabled:cursor-not-allowed transition-all mb-8"
          >
            Build My Learning Path
          </button>

          <div className="border-t border-[#E3E0D8] pt-7">
            <p className="text-xs text-[#A8A5A0] mb-3 text-center">Or start from a suggestion</p>
            <div className="space-y-2">
              {suggestedTopics.map((t, i) => (
                <button
                  key={i}
                  onClick={() => setGoal(t)}
                  className="w-full text-left text-sm text-[#3D3C38] border border-[#E3E0D8] rounded-lg px-4 py-3 hover:border-[#B8B5AD] hover:bg-white transition-all"
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-7 text-center border-t border-[#E3E0D8] pt-5">
            <p className="text-xs text-[#A8A5A0] mb-2">Or import an existing curriculum</p>
            <button className="text-xs text-[#7A7870] border border-dashed border-[#C0BDB5] px-5 py-2.5 rounded-lg hover:border-[#9B9890] hover:text-[#1A1916] transition-all">
              Upload / Import
            </button>
          </div>
        </>
      ) : (
        <div className="text-center">
          <div className="mb-8">
            <p className="text-xs text-[#A8A5A0] uppercase tracking-widest mb-3">Building your curriculum</p>
            <h2 className="font-display text-2xl font-light text-[#1A1916] mb-2">{goal}</h2>
          </div>
          <div className="max-w-sm mx-auto space-y-3">
            {processingSteps.map((step, i) => (
              <div key={i} className={`flex items-center gap-3 p-3 rounded-lg transition-all ${
                i < stepsDone ? 'bg-[#EFF4EE] border border-[#C5D9C4]' :
                i === stepsDone ? 'bg-white border border-[#E3E0D8]' :
                'opacity-30'
              }`}>
                <div className={`w-5 h-5 rounded-full border flex items-center justify-center flex-shrink-0 ${
                  i < stepsDone ? 'bg-[#5B7A58] border-[#5B7A58]' :
                  i === stepsDone ? 'border-[#4A5FA5] bg-white' :
                  'border-[#D4D0C8]'
                }`}>
                  {i < stepsDone ? (
                    <span className="text-white text-[10px]">✓</span>
                  ) : i === stepsDone ? (
                    <span className="w-2 h-2 rounded-full bg-[#4A5FA5] block animate-pulse"></span>
                  ) : null}
                </div>
                <span className={`text-sm ${
                  i < stepsDone ? 'text-[#5B7A58]' :
                  i === stepsDone ? 'text-[#1A1916] font-medium' :
                  'text-[#A8A5A0]'
                }`}>
                  {step.label}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
