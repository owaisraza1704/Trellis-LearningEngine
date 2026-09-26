import { useState, useEffect } from 'react'
import { Menu, X } from 'lucide-react'
import Benchmarks from '../components/Benchmarks'

interface LandingProps {
  onEnter: () => void
}

// Curriculum graph for the hero visual
function HeroGraph() {
  const nodes = [
    {
      id: 'root',
      x: 200,
      y: 40,
      label: 'Machine Learning',
      size: 14,
      state: 'root',
    },
    {
      id: 'foundations',
      x: 80,
      y: 120,
      label: 'Foundations',
      size: 11,
      state: 'completed',
    },
    {
      id: 'math',
      x: 200,
      y: 120,
      label: 'Mathematics',
      size: 11,
      state: 'completed',
    },
    {
      id: 'supervised',
      x: 320,
      y: 120,
      label: 'Supervised Learning',
      size: 11,
      state: 'active',
    },
    {
      id: 'what-ml',
      x: 30,
      y: 200,
      label: 'What is ML?',
      size: 9,
      state: 'completed',
    },
    {
      id: 'types',
      x: 80,
      y: 210,
      label: 'Types of ML',
      size: 9,
      state: 'completed',
    },
    {
      id: 'paradigms',
      x: 130,
      y: 200,
      label: 'Paradigms',
      size: 9,
      state: 'completed',
    },
    {
      id: 'linalg',
      x: 170,
      y: 210,
      label: 'Linear Algebra',
      size: 9,
      state: 'completed',
    },
    {
      id: 'prob',
      x: 230,
      y: 210,
      label: 'Probability',
      size: 9,
      state: 'completed',
    },
    {
      id: 'linreg',
      x: 275,
      y: 200,
      label: 'Lin. Regression',
      size: 9,
      state: 'current',
    },
    {
      id: 'logreg',
      x: 325,
      y: 210,
      label: 'Log. Regression',
      size: 9,
      state: 'current',
    },
    {
      id: 'trees',
      x: 375,
      y: 200,
      label: 'Decision Trees',
      size: 9,
      state: 'available',
    },
    {
      id: 'eval',
      x: 200,
      y: 290,
      label: 'Model Evaluation',
      size: 10,
      state: 'available',
    },
  ]

  const edges = [
    ['root', 'foundations'],
    ['root', 'math'],
    ['root', 'supervised'],
    ['foundations', 'what-ml'],
    ['foundations', 'types'],
    ['foundations', 'paradigms'],
    ['math', 'linalg'],
    ['math', 'prob'],
    ['supervised', 'linreg'],
    ['supervised', 'logreg'],
    ['supervised', 'trees'],
    ['supervised', 'eval'],
    ['math', 'eval'],
  ]

  const nodeMap = Object.fromEntries(nodes.map((n) => [n.id, n]))

  const stateStyle: Record<
    string,
    {
      fill: string
      stroke: string
      strokeWidth: number
    }
  > = {
    root: { fill: '#2D2C28', stroke: '#2D2C28', strokeWidth: 1.5 },
    completed: { fill: '#5B7A58', stroke: '#5B7A58', strokeWidth: 1 },
    active: { fill: '#4A5FA5', stroke: '#4A5FA5', strokeWidth: 1 },
    current: { fill: '#F7F6F2', stroke: '#4A5FA5', strokeWidth: 1.5 },
    available: { fill: '#F7F6F2', stroke: '#B8B5AD', strokeWidth: 1 },
  }

  return (
    <svg width="420" height="320" viewBox="0 0 420 320" className="w-full h-auto">
      <defs>
        <filter id="glow">
          <feGaussianBlur stdDeviation="2" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>
      </defs>
      {/* Edges */}
      {edges.map(([from, to]) => {
        const a = nodeMap[from]
        const b = nodeMap[to]
        if (!a || !b) return null
        const mx = (a.x + b.x) / 2
        const my = (a.y + b.y) / 2
        const fromDone =
          ['completed', 'root'].includes(a.state) &&
          ['completed', 'active', 'current'].includes(b.state)
        return (
          <path
            key={`${from}-${to}`}
            d={`M${a.x},${a.y} Q${mx},${a.y} ${b.x},${b.y}`}
            fill="none"
            stroke={fromDone ? '#B8C8B6' : '#DDD9D1'}
            strokeWidth={fromDone ? 1.5 : 1}
            strokeDasharray={fromDone ? 'none' : '3,3'}
          />
        )
      })}
      {/* Nodes */}
      {nodes.map((node) => {
        const style = stateStyle[node.state] || stateStyle.available
        const isRoot = node.state === 'root'
        const isCurrent = node.state === 'current'
        return (
          <g key={node.id}>
            {isCurrent && (
              <circle
                cx={node.x}
                cy={node.y}
                r={node.size + 4}
                fill="none"
                stroke="#4A5FA5"
                strokeWidth="1"
                opacity="0.3"
                className="node-pulse"
              />
            )}
            <circle
              cx={node.x}
              cy={node.y}
              r={node.size}
              fill={style.fill}
              stroke={style.stroke}
              strokeWidth={style.strokeWidth}
            />
            {node.state === 'completed' && (
              <text x={node.x} y={node.y + 4} textAnchor="middle" fontSize="9" fill="white">
                ✓
              </text>
            )}
            <text
              x={node.x}
              y={node.y + node.size + 11}
              textAnchor="middle"
              fontSize={isRoot ? '9' : '7.5'}
              fill={isRoot ? '#1A1916' : '#7A7870'}
              fontFamily="Inter, sans-serif"
              fontWeight={isRoot ? '500' : '400'}
            >
              {node.label}
            </text>
          </g>
        )
      })}
    </svg>
  )
}

export default function Landing({ onEnter }: LandingProps) {
  const [visible, setVisible] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const links = [
    { href: '#how-it-works', label: 'How it works' },
    { href: '#features', label: 'Features' },
    { href: '#philosophy', label: 'Philosophy' },
    { href: '#benchmarks', label: 'Benchmarks' },
  ]

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 80)
    return () => clearTimeout(t)
  }, [])

  return (
    <div
      className={`min-h-screen bg-[#F7F6F2] transition-opacity duration-700 ${
        visible ? 'opacity-100' : 'opacity-0'
      }`}
    >
      {/* Nav */}
      <nav
        aria-label="Homepage navigation"
        className="fixed inset-x-0 top-0 z-50 border-b border-[#E3E0D8] bg-[#F7F6F2]/95 backdrop-blur-sm"
      >
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-4 sm:px-8">
          <div className="flex shrink-0 items-center gap-2">
            <TrellisLogo />
            <span className="font-display text-lg font-medium tracking-tight text-[#1A1916]">
              Trellis
            </span>
          </div>
          <div className="hidden items-center gap-6 text-sm text-[#7A7870] lg:flex">
            {links.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="whitespace-nowrap transition-colors hover:text-[#1A1916]"
              >
                {link.label}
              </a>
            ))}
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={onEnter}
              className="hidden whitespace-nowrap px-3 py-1.5 text-sm text-[#7A7870] transition-colors hover:text-[#1A1916] sm:block"
            >
              Open workspace
            </button>
            <button
              onClick={onEnter}
              className="whitespace-nowrap rounded-md bg-[#2D2C28] px-4 py-2 text-sm text-[#F7F6F2] transition-colors hover:bg-[#1A1916]"
            >
              Start learning
            </button>
            <button
              type="button"
              aria-label={menuOpen ? 'Close navigation' : 'Open navigation'}
              aria-expanded={menuOpen}
              aria-controls="homepage-mobile-navigation"
              className="rounded-md p-2 text-[#5A5850] hover:bg-[#EAE8E3] lg:hidden"
              onClick={() => setMenuOpen(!menuOpen)}
            >
              {menuOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </div>
        {menuOpen && (
          <div
            id="homepage-mobile-navigation"
            className="grid gap-1 border-t border-[#E3E0D8] px-6 py-3 lg:hidden"
          >
            {links.map((link) => (
              <a
                key={link.href}
                href={link.href}
                onClick={() => setMenuOpen(false)}
                className="rounded-md px-3 py-2 text-sm text-[#5A5850] hover:bg-[#EAE8E3]"
              >
                {link.label}
              </a>
            ))}
          </div>
        )}
      </nav>

      {/* Hero */}
      <section className="pt-28 pb-16 px-6 sm:px-8 max-w-6xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center min-h-[70vh]">
          <div>
            <div className="inline-flex items-center gap-2 text-xs text-[#5B7A58] bg-[#EFF4EE] border border-[#C5D9C4] px-3 py-1.5 rounded-full mb-8">
              <span className="w-1.5 h-1.5 rounded-full bg-[#5B7A58] inline-block"></span>
              AI-Powered Learning Engine
            </div>
            <h1 className="font-display text-4xl sm:text-5xl lg:text-6xl font-light leading-[1.08] text-[#1A1916] mb-6 tracking-tight">
              Learn as a connected
              <br />
              <em className="italic text-[#5B7A58]">journey,</em> not a<br />
              collection of chats.
            </h1>
            <p className="text-[#5A5850] text-lg leading-relaxed mb-10 max-w-lg">
              Turn a learning goal into a structured curriculum. Explore concepts without losing
              context, learn with evidence, and build a knowledge base that persists.
            </p>
            <div className="flex flex-wrap gap-3">
              <button
                onClick={onEnter}
                className="bg-[#2D2C28] text-[#F7F6F2] px-7 py-3.5 rounded-md text-sm font-medium hover:bg-[#1A1916] transition-colors flex items-center gap-2"
              >
                Start Learning
                <ArrowRight size={14} />
              </button>
              <button
                onClick={onEnter}
                className="border border-[#E3E0D8] text-[#3D3C38] px-7 py-3.5 rounded-md text-sm font-medium hover:border-[#B8B5AD] hover:bg-white transition-all"
              >
                Open workspace
              </button>
            </div>
            <p className="text-xs text-[#A8A5A0] mt-5">
              Start with a goal. Build knowledge that stays connected.
            </p>
          </div>

          {/* Hero visual */}
          <div className="relative">
            <div className="bg-white rounded-xl border border-[#E3E0D8] shadow-sm p-6 relative">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-xs text-[#7A7870] uppercase tracking-widest mb-1">
                    Example Learning Journey
                  </p>
                  <h3 className="font-display text-base font-medium text-[#1A1916]">
                    Machine Learning
                  </h3>
                </div>
                <div className="text-right">
                  <span className="text-sm font-display text-[#5B7D58]">Your pace</span>
                  <p className="text-xs text-[#A8A5A0]">your path</p>
                </div>
              </div>
              <div className="w-full bg-[#EEF0EB] rounded-full h-1 mb-5">
                <div className="bg-[#5B7A58] h-1 rounded-full" style={{ width: '42%' }}></div>
              </div>
              <HeroGraph />
              <div className="mt-4 p-3 bg-[#F0F4EF] rounded-lg border border-[#D4E0D3]">
                <p className="text-xs text-[#5B7A58] font-medium mb-0.5">Currently learning</p>
                <p className="text-sm text-[#2D2C28] font-medium">Logistic Regression</p>
                <p className="text-xs text-[#7A7870]">Supervised Learning · Node 2 of 3</p>
              </div>
            </div>
            {/* Floating evidence card */}
            <div className="absolute -bottom-4 -left-6 bg-white rounded-lg border border-[#E3E0D8] shadow-md p-3 w-48 hidden lg:block">
              <p className="text-xs text-[#7A7870] mb-1">Evidence</p>
              <p className="text-xs font-medium text-[#1A1916]">Sources stay connected</p>
              <p className="text-xs text-[#A8A5A0]">Inspect supporting passages</p>
            </div>
            {/* Floating context card */}
            <div className="absolute -top-4 -right-4 bg-white rounded-lg border border-[#E3E0D8] shadow-md p-3 w-44 hidden lg:block">
              <p className="text-xs text-[#7A7870] mb-1.5">AI Context</p>
              <div className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-[#4A5FA5] inline-block"></span>
                <p className="text-xs text-[#2D2C28]">Logistic Regression</p>
              </div>
              <p className="text-xs text-[#A8A5A0] mt-0.5">Scoped to current node</p>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section
        id="features"
        className="scroll-mt-28 py-20 px-6 sm:px-8 max-w-6xl mx-auto border-t border-[#E3E0D8]"
      >
        <p className="text-xs text-[#7A7870] uppercase tracking-widest mb-10 text-center">
          What makes Trellis different
        </p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-px bg-[#E3E0D8] rounded-xl overflow-hidden">
          {[
            {
              icon: <GraphIcon />,
              title: 'Curriculum as a living graph',
              desc: 'Your learning goal becomes a navigable knowledge structure — not a list of videos or a course sequence. See how concepts connect and choose your path.',
            },
            {
              icon: <ContextIcon />,
              title: 'Scoped, persistent AI context',
              desc: 'The AI assistant knows exactly where you are in your journey. Conversations stay focused on the current node, its prerequisites and your learning state.',
            },
            {
              icon: <ExploreIcon />,
              title: 'Explore without getting lost',
              desc: 'Follow any tangent as an exploratory thread. Your primary learning path stays intact and you can return with a single click.',
            },
          ].map((f, i) => (
            <div key={i} className="bg-[#F7F6F2] p-8">
              <div className="w-9 h-9 rounded-lg bg-[#EEF0EB] border border-[#E3E0D8] flex items-center justify-center mb-5 text-[#5B7A58]">
                {f.icon}
              </div>
              <h3 className="font-display text-lg font-medium text-[#1A1916] mb-2">{f.title}</h3>
              <p className="text-sm text-[#7A7870] leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Philosophy quote */}
      <section id="philosophy" className="scroll-mt-28 py-20 px-6 sm:px-8 bg-[#2D2C28]">
        <div className="max-w-3xl mx-auto text-center">
          <p className="font-display text-2xl lg:text-3xl text-[#F7F6F2] font-light leading-relaxed italic mb-6">
            "Trellis doesn't just answer what you ask.
            <br />
            It remembers where you are, shows how ideas connect,
            <br />
            lets you explore without getting lost."
          </p>
          <p className="text-[#7A7870] text-sm">
            Structured knowledge. Persistent context. Evidence-backed learning.
          </p>
        </div>
      </section>

      {/* How it works */}
      <section
        id="how-it-works"
        aria-labelledby="learning-model-heading"
        className="scroll-mt-28 py-20 px-6 sm:px-8 max-w-6xl mx-auto"
      >
        <h2
          id="learning-model-heading"
          className="text-xs text-[#7A7870] uppercase tracking-widest mb-12 text-center"
        >
          The learning model
        </h2>
        <ol className="grid grid-cols-1 md:grid-cols-5">
          {[
            {
              step: '01',
              label: 'Set a goal',
              desc: 'Describe what you want to learn — a skill, a field, a concept. Any scope.',
            },
            {
              step: '02',
              label: 'Build the curriculum',
              desc: 'Trellis generates a structured graph of interconnected learning nodes.',
            },
            {
              step: '03',
              label: 'Enter any node',
              desc: 'An AI-assisted workspace opens with full context of where you are.',
            },
            {
              step: '04',
              label: 'Explore & evidence',
              desc: 'Ask questions, follow threads, cite sources. Everything is saved.',
            },
            {
              step: '05',
              label: 'Return & continue',
              desc: 'Your state, progress, and notebook persist across every session.',
            },
          ].map((s, i, arr) => (
            <li
              key={s.step}
              className="relative grid min-w-0 grid-cols-[2.5rem_1fr] gap-x-4 pb-8 last:pb-0 md:block md:px-3 md:pb-0 md:text-center"
            >
              {i < arr.length - 1 && (
                <span
                  aria-hidden="true"
                  className="absolute bottom-0 left-5 top-10 w-px bg-[#DDD9D1] md:bottom-auto md:left-1/2 md:top-5 md:h-px md:w-full"
                />
              )}
              <div className="relative z-10 flex md:justify-center">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 border-[#5B7A58] bg-white font-mono text-xs text-[#5B7A58]">
                  {s.step}
                </span>
              </div>
              <div className="min-w-0 pt-1 md:mt-6 md:pt-0">
                <h3 className="font-medium text-sm text-[#1A1916]">{s.label}</h3>
                <p className="text-xs text-[#7A7870] mt-0.5 leading-relaxed">{s.desc}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <Benchmarks />

      {/* CTA */}
      <section className="py-20 px-8 border-t border-[#E3E0D8]">
        <div className="max-w-lg mx-auto text-center">
          <h2 className="font-display text-3xl font-light text-[#1A1916] mb-4">
            Begin your learning journey
          </h2>
          <p className="text-[#7A7870] text-sm mb-8">
            Start with any topic. Trellis will build the structure around it.
          </p>
          <button
            onClick={onEnter}
            className="bg-[#2D2C28] text-[#F7F6F2] px-10 py-4 rounded-md text-sm font-medium hover:bg-[#1A1916] transition-colors inline-flex items-center gap-2"
          >
            Start Learning
            <ArrowRight size={14} />
          </button>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-[#E3E0D8] px-8 py-8">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <TrellisLogo />
            <span className="font-display text-sm font-medium text-[#7A7870]">Trellis</span>
          </div>
          <p className="text-xs text-[#A8A5A0]">
            An AI-Powered Learning Engine. Learn as a connected journey.
          </p>
        </div>
      </footer>
    </div>
  )
}

export function TrellisLogo() {
  return <img src="/icon.svg" width={22} height={22} alt="" />
}

function ArrowRight({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
      <path
        d="M3 8h10M9 4l4 4-4 4"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function GraphIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
      <circle cx="9" cy="3" r="2" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="3" cy="13" r="2" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="15" cy="13" r="2" stroke="currentColor" strokeWidth="1.5" />
      <line
        x1="9"
        y1="5"
        x2="3"
        y2="11"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <line
        x1="9"
        y1="5"
        x2="15"
        y2="11"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  )
}

function ContextIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
      <path d="M9 1a8 8 0 100 16A8 8 0 009 1z" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="9" cy="9" r="3" stroke="currentColor" strokeWidth="1.5" />
      <line x1="9" y1="1" x2="9" y2="6" stroke="currentColor" strokeWidth="1.5" />
      <line x1="9" y1="12" x2="9" y2="17" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  )
}

function ExploreIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
      <circle cx="9" cy="9" r="7.5" stroke="currentColor" strokeWidth="1.5" />
      <path
        d="M12 6l-3 3-1.5 3.5L11 11l3-5z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  )
}
