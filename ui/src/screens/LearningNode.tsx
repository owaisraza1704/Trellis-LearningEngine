import { useState } from 'react'

interface LearningNodeProps {
  onNavigate: (screen: string) => void
}

const curriculumPath = [
  { id: 'root', label: 'Machine Learning', active: false },
  { id: 'supervised', label: 'Supervised Learning', active: false },
  { id: 'logreg', label: 'Logistic Regression', active: true },
]

const sections = ['Concept', 'How It Works', 'Intuition', 'Example', 'Practical Application']

interface Message {
  role: 'user' | 'ai'
  content: string
  evidenceCount?: number
}

const initialMessages: Message[] = [
  {
    role: 'user',
    content: 'Why does sigmoid work here?',
  },
  {
    role: 'ai',
    content: 'Because logistic regression needs to transform its output into a probability between 0 and 1. The sigmoid function σ(z) = 1/(1+e^−z) maps any real value to (0,1), which makes it ideal for representing class probabilities.\n\nFor a linear combination z = wᵀx + b, applying sigmoid gives you P(y=1|x) — the probability that an input belongs to the positive class.',
    evidenceCount: 3,
  },
]

const evidenceSources = [
  { title: 'Introduction to Statistical Learning', type: 'Book', chapter: 'Chapter 4', relevance: 'High' },
  { title: 'Scikit-learn Documentation', type: 'Docs', url: 'sklearn.org', relevance: 'High' },
  { title: 'Ng, A. (2000). CS229 Lecture Notes', type: 'Academic', relevance: 'Medium' },
]

export default function LearningNode({ onNavigate }: LearningNodeProps) {
  const [activeSection, setActiveSection] = useState('Concept')
  const [messages, setMessages] = useState<Message[]>(initialMessages)
  const [input, setInput] = useState('')
  const [showEvidence, setShowEvidence] = useState(false)
  const [showThread, setShowThread] = useState(false)
  const [expandedCallout, setExpandedCallout] = useState<string | null>(null)

  function sendMessage() {
    if (!input.trim()) return
    const userMsg: Message = { role: 'user', content: input }
    setMessages(m => [...m, userMsg])
    setInput('')
    // Simulate AI response
    setTimeout(() => {
      setMessages(m => [...m, {
        role: 'ai',
        content: 'Great question. In the context of logistic regression, the decision boundary is where P(y=1|x) = 0.5, which corresponds to z = 0. The model learns the optimal weight vector w that places this boundary to best separate the two classes.',
        evidenceCount: 2,
      }])
    }, 800)
  }

  return (
    <div className="screen-enter flex h-[calc(100vh-4rem)] gap-0">
      {/* Left: Curriculum context */}
      <div className="w-56 flex-shrink-0 border-r border-[#E3E0D8] pr-5 overflow-y-auto">
        <div className="mb-5">
          <p className="text-xs text-[#A8A5A0] uppercase tracking-widest mb-3">Current Path</p>
          {curriculumPath.map((p, i) => (
            <div key={p.id} className="flex items-start gap-2 mb-1">
              <div className="flex flex-col items-center mt-1.5 flex-shrink-0">
                <div className={`w-1.5 h-1.5 rounded-full ${p.active ? 'bg-[#4A5FA5]' : 'bg-[#C0BDB5]'}`}></div>
                {i < curriculumPath.length - 1 && <div className="w-px h-4 bg-[#E3E0D8] my-0.5"></div>}
              </div>
              <button
                onClick={() => i < curriculumPath.length - 1 && onNavigate('graph')}
                className={`text-xs leading-relaxed text-left ${
                  p.active ? 'text-[#1A1916] font-medium' : 'text-[#7A7870] hover:text-[#1A1916]'
                } transition-colors`}
              >
                {p.label}
              </button>
            </div>
          ))}
        </div>

        <div className="border-t border-[#E3E0D8] pt-4">
          <p className="text-xs text-[#A8A5A0] uppercase tracking-widest mb-3">This Section</p>
          <div className="space-y-0.5">
            {[
              { label: 'Linear Regression', state: 'completed' },
              { label: 'Logistic Regression', state: 'current' },
              { label: 'Decision Trees', state: 'locked' },
            ].map((n, i) => (
              <div key={i} className={`flex items-center gap-2 px-2 py-1.5 rounded text-xs cursor-pointer transition-all ${
                n.state === 'current' ? 'bg-[#EEF0F9] text-[#4A5FA5]' : 'text-[#7A7870] hover:bg-[#F0EEE9]'
              }`}>
                <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                  n.state === 'completed' ? 'bg-[#5B7A58]' :
                  n.state === 'current' ? 'bg-[#4A5FA5]' : 'bg-[#D4D0C8]'
                }`}></div>
                {n.label}
              </div>
            ))}
          </div>
        </div>

        <div className="border-t border-[#E3E0D8] pt-4 mt-4">
          <p className="text-xs text-[#A8A5A0] uppercase tracking-widest mb-3">Progress</p>
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs">
              <span className="text-[#7A7870]">Section</span>
              <span className="text-[#1A1916] font-mono">2/3</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-[#7A7870]">Journey</span>
              <span className="text-[#1A1916] font-mono">42%</span>
            </div>
          </div>
        </div>
      </div>

      {/* Center: Learning content */}
      <div className="flex-1 overflow-y-auto px-8">
        {showThread ? (
          <ExploratoryThread onClose={() => setShowThread(false)} />
        ) : (
          <>
            {/* Node header */}
            <div className="mb-6 pt-1">
              <div className="flex items-center gap-2 text-xs text-[#A8A5A0] mb-3">
                <span>Supervised Learning</span>
                <span>·</span>
                <span className="inline-flex items-center gap-1 text-[#4A5FA5] bg-[#EEF0F9] px-2 py-0.5 rounded-full border border-[#C5CEED]">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#4A5FA5] inline-block"></span>
                  In progress
                </span>
              </div>
              <h1 className="font-display text-4xl font-light text-[#1A1916] mb-1">Logistic Regression</h1>
              <p className="text-sm text-[#7A7870]">Learning Node · Supervised Learning</p>
            </div>

            {/* Section tabs */}
            <div className="flex gap-1 mb-7 border-b border-[#E3E0D8] pb-0">
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

            {/* Content */}
            <div className="prose-trellis max-w-none">
              {activeSection === 'Concept' && (
                <>
                  <h2>What is Logistic Regression?</h2>
                  <p>
                    Logistic Regression is a <span className="bg-[#EFF4EE] text-[#3D6039] px-1 rounded">classification algorithm</span> used
                    to estimate the probability that an input belongs to a particular class. Despite its name, it is a classification
                    method — not a regression method in the predictive sense.
                  </p>
                  <p>
                    Given input features <code>x</code>, logistic regression predicts P(y=1|x) — the probability the
                    output is the positive class. It does this by passing a linear combination of inputs through the
                    sigmoid function.
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
                      <strong className="text-[#3D6039]">Why σ?</strong> The sigmoid function maps any real number
                      to (0, 1), making it ideal for probability outputs. As z → ∞, σ(z) → 1; as z → −∞, σ(z) → 0.
                    </div>
                  )}

                  <h2>When to use it</h2>
                  <p>
                    Logistic regression is most appropriate when:
                  </p>
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
                      Logistic regression is essentially linear regression wrapped in a sigmoid.
                      Where linear regression predicts a continuous value, logistic regression
                      predicts a probability by squashing the linear output.
                    </p>
                  </div>
                </>
              )}

              {activeSection === 'How It Works' && (
                <>
                  <h2>Training Process</h2>
                  <p>
                    Logistic regression is trained using <span className="bg-[#EFF4EE] text-[#3D6039] px-1 rounded">maximum likelihood estimation</span>.
                    We want to find weights w that maximize the probability of observing the training labels given the inputs.
                  </p>
                  <div className="math-block">
                    Loss(w) = −Σ [yᵢ log(σ(wᵀxᵢ)) + (1−yᵢ) log(1−σ(wᵀxᵢ))]
                    <span className="text-[#A8A5A0] text-xs block mt-1">Binary Cross-Entropy Loss</span>
                  </div>
                  <p>
                    This loss function is convex, which means gradient descent reliably finds the global minimum. The gradient
                    update rule simplifies elegantly due to the properties of the sigmoid function.
                  </p>
                </>
              )}

              {activeSection !== 'Concept' && activeSection !== 'How It Works' && (
                <p className="text-[#A8A5A0] italic">Content for {activeSection} — click another section to explore.</p>
              )}

              {/* Deepen section */}
              <div className="border-t border-[#E3E0D8] mt-8 pt-6">
                <p className="text-sm font-medium text-[#7A7870] mb-3">Want to go deeper?</p>
                <div className="flex flex-wrap gap-2">
                  {[
                    'Explain differently',
                    'Show an example',
                    'Compare with Linear Regression',
                    'Show practical application',
                  ].map((action, i) => (
                    <button
                      key={i}
                      className="text-xs border border-[#E3E0D8] text-[#3D3C38] px-3 py-2 rounded-md hover:border-[#B8B5AD] hover:bg-white transition-all"
                    >
                      {action}
                    </button>
                  ))}
                </div>
              </div>

              {/* Exploratory thread CTA */}
              <div className="mt-6 p-4 border border-[#E3E0D8] rounded-lg bg-[#F9F8F5] flex items-center justify-between">
                <div>
                  <p className="text-xs text-[#A8A5A0] mb-0.5">Tangential exploration</p>
                  <p className="text-sm text-[#1A1916] font-medium">What is the history of logistic regression?</p>
                </div>
                <button
                  onClick={() => setShowThread(true)}
                  className="text-xs text-[#4A5FA5] border border-[#C5CEED] bg-[#EEF0F9] px-3 py-1.5 rounded-md hover:bg-[#E4E8F5] transition-colors flex items-center gap-1.5"
                >
                  <span>↗</span> Explore Thread
                </button>
              </div>
            </div>

            <div className="h-10"></div>
          </>
        )}
      </div>

      {/* Right: AI assistant */}
      <div className="w-72 flex-shrink-0 border-l border-[#E3E0D8] pl-5 flex flex-col">
        {/* Context indicator */}
        <div className="mb-4 p-3 bg-[#F0EEE9] rounded-lg border border-[#E3E0D8]">
          <p className="text-xs text-[#A8A5A0] uppercase tracking-widest mb-2">Current Context</p>
          <div className="space-y-1">
            <div className="flex items-center gap-1.5 text-xs text-[#5A5850]">
              <span className="text-[#C0BDB5]">↳</span> Machine Learning
            </div>
            <div className="flex items-center gap-1.5 text-xs text-[#5A5850]">
              <span className="text-[#C0BDB5]">↳</span> Supervised Learning
            </div>
            <div className="flex items-center gap-1.5 text-xs font-medium text-[#1A1916]">
              <span className="w-1.5 h-1.5 rounded-full bg-[#4A5FA5] inline-block"></span>
              Logistic Regression
            </div>
          </div>
          <div className="mt-2 pt-2 border-t border-[#E3E0D8] flex items-center justify-between">
            <span className="text-xs text-[#7A7870]">AI Scope</span>
            <span className="text-xs text-[#4A5FA5] font-medium flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-[#4A5FA5] inline-block"></span>
              Current Node
            </span>
          </div>
        </div>

        <div className="flex items-center justify-between mb-3">
          <p className="text-xs font-medium text-[#1A1916]">Learning Assistant</p>
          <button className="text-xs text-[#A8A5A0] hover:text-[#7A7870]">Context ▾</button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto space-y-3 pr-1 mb-3">
          {messages.map((msg, i) => (
            <div key={i} className={`${msg.role === 'user' ? 'flex justify-end' : ''}`}>
              {msg.role === 'user' ? (
                <div className="bg-[#2D2C28] text-white text-xs px-3 py-2 rounded-xl rounded-br-sm max-w-[85%] leading-relaxed">
                  {msg.content}
                </div>
              ) : (
                <div>
                  <div className="text-xs text-[#3D3C38] leading-relaxed mb-2 whitespace-pre-line">
                    {msg.content}
                  </div>
                  {msg.evidenceCount && (
                    <div>
                      <button
                        onClick={() => setShowEvidence(!showEvidence)}
                        className="flex items-center gap-1.5 text-xs text-[#7A7870] hover:text-[#1A1916] transition-colors mb-2"
                      >
                        <span className="text-[#A8A5A0]">⬡</span>
                        Evidence · {msg.evidenceCount} sources
                        <span className="text-[#C0BDB5]">{showEvidence ? '▴' : '▾'}</span>
                      </button>
                      {showEvidence && (
                        <div className="space-y-2 mb-2">
                          {evidenceSources.slice(0, msg.evidenceCount).map((src, si) => (
                            <div key={si} className="bg-[#F7F6F2] border border-[#E3E0D8] rounded-lg p-2.5">
                              <p className="text-xs font-medium text-[#1A1916]">{src.title}</p>
                              <div className="flex items-center justify-between mt-1">
                                <span className="text-xs text-[#A8A5A0]">{src.type}{src.chapter ? ` · ${src.chapter}` : ''}</span>
                                <span className={`text-xs px-1.5 py-0.5 rounded ${
                                  src.relevance === 'High' ? 'bg-[#EFF4EE] text-[#5B7A58]' : 'bg-[#F0EEE9] text-[#7A7870]'
                                }`}>{src.relevance}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                      <div className="flex flex-wrap gap-1.5">
                        {['Save to Notebook', 'Explore Further', 'Ask Follow-up'].map((action, ai) => (
                          <button
                            key={ai}
                            className="text-xs text-[#7A7870] border border-[#E3E0D8] px-2 py-1 rounded hover:bg-[#F0EEE9] transition-all"
                          >
                            {action}
                          </button>
                        ))}
                      </div>
                    </div>
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
              onKeyDown={e => e.key === 'Enter' && sendMessage()}
              placeholder="Ask about this topic…"
              className="flex-1 text-xs bg-[#F7F6F2] border border-[#E3E0D8] rounded-lg px-3 py-2 outline-none focus:border-[#9B9890] focus:bg-white transition-all placeholder:text-[#C0BDB5]"
            />
            <button
              onClick={sendMessage}
              className="bg-[#2D2C28] text-white text-xs px-3 py-2 rounded-lg hover:bg-[#1A1916] transition-colors"
            >
              →
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function ExploratoryThread({ onClose }: { onClose: () => void }) {
  return (
    <div className="screen-enter">
      <div className="flex items-center gap-2 text-xs text-[#7A7870] mb-5">
        <button onClick={onClose} className="hover:text-[#1A1916] transition-colors">Logistic Regression</button>
        <span className="text-[#C0BDB5]">›</span>
        <span className="inline-flex items-center gap-1.5 text-[#4A5FA5] bg-[#EEF0F9] px-2 py-0.5 rounded-full border border-[#C5CEED]">
          <span>↗</span> Exploratory Thread
        </span>
      </div>

      <div className="mb-6">
        <p className="text-xs text-[#A8A5A0] mb-1 uppercase tracking-widest">Exploratory Thread</p>
        <h2 className="font-display text-3xl font-light text-[#1A1916] mb-1">History of Logistic Regression</h2>
        <p className="text-sm text-[#7A7870]">Exploring · Parent: Logistic Regression</p>
      </div>

      <div className="callout mb-6">
        <p className="text-xs font-medium text-[#7A7870] mb-1">Context preserved</p>
        <p className="text-sm text-[#3D3C38]">
          This thread explores a tangential topic. Your primary learning path — Logistic Regression — remains intact.
          Return when you're ready to continue.
        </p>
      </div>

      <div className="prose-trellis">
        <h2>Origins in the 19th century</h2>
        <p>
          The logistic function itself was introduced by Belgian mathematician <span className="bg-[#EFF4EE] text-[#3D6039] px-1 rounded">Pierre François Verhulst</span> in 1838
          to describe population growth. The term "logistic" comes from the Greek logos (ratio) and describes the
          S-shaped curve now central to the algorithm.
        </p>
        <p>
          It wasn't until the 1940s–50s that statisticians began applying it to binary outcome modeling.
          Joseph Berkson coined the term <code>logit</code> in 1944, establishing the theoretical foundation
          for the log-odds transformation that logistic regression optimizes.
        </p>
        <h2>Adoption in machine learning</h2>
        <p>
          By the 1980s, logistic regression was well-established in biostatistics and epidemiology. Its adoption
          in machine learning was partly driven by its simplicity, its probabilistic interpretation, and the fact
          that it functions as a single-layer neural network with a sigmoid activation — bridging statistical
          modeling and early neural network theory.
        </p>
      </div>

      <div className="flex gap-3 mt-8 border-t border-[#E3E0D8] pt-5">
        <button
          onClick={onClose}
          className="text-sm border border-[#E3E0D8] text-[#3D3C38] px-4 py-2 rounded-md hover:bg-white transition-all flex items-center gap-1.5"
        >
          ← Return to Learning Node
        </button>
        <button className="text-sm border border-[#C5D9C4] text-[#5B7A58] bg-[#EFF4EE] px-4 py-2 rounded-md hover:bg-[#E3EEE2] transition-colors">
          Save Insight to Notebook
        </button>
      </div>
    </div>
  )
}
