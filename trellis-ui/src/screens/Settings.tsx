import { useState } from 'react'

const sections = ['Appearance', 'Learning', 'Notebook', 'Account']

export default function Settings() {
  const [activeSection, setActiveSection] = useState('Appearance')
  const [theme, setTheme] = useState('light')
  const [density, setDensity] = useState('comfortable')
  const [aiScope, setAiScope] = useState('current-node')
  const [defaultNotebook, setDefaultNotebook] = useState('journey')
  const [exportFormat, setExportFormat] = useState('pdf')

  return (
    <div className="screen-enter max-w-2xl">
      <div className="mb-7">
        <h1 className="font-display text-3xl font-light text-[#1A1916] mb-1">Settings</h1>
        <p className="text-sm text-[#7A7870]">Preferences for your learning workspace.</p>
      </div>

      <div className="flex gap-8">
        {/* Section nav */}
        <div className="w-40 flex-shrink-0">
          <nav className="space-y-0.5">
            {sections.map(s => (
              <button
                key={s}
                onClick={() => setActiveSection(s)}
                className={`w-full text-left text-sm px-3 py-2 rounded-md transition-all ${
                  activeSection === s
                    ? 'bg-[#2D2C28] text-white'
                    : 'text-[#7A7870] hover:bg-[#F0EEE9] hover:text-[#1A1916]'
                }`}
              >
                {s}
              </button>
            ))}
          </nav>
        </div>

        {/* Settings content */}
        <div className="flex-1 space-y-6">
          {activeSection === 'Appearance' && (
            <>
              <SettingGroup title="Theme">
                <RadioGroup
                  value={theme}
                  onChange={setTheme}
                  options={[
                    { value: 'light', label: 'Light', desc: 'Warm ivory workspace' },
                    { value: 'dark', label: 'Dark', desc: 'Deep charcoal workspace' },
                    { value: 'system', label: 'System', desc: 'Match OS preference' },
                  ]}
                />
              </SettingGroup>
              <SettingGroup title="Density">
                <RadioGroup
                  value={density}
                  onChange={setDensity}
                  options={[
                    { value: 'comfortable', label: 'Comfortable', desc: 'More whitespace, larger tap targets' },
                    { value: 'compact', label: 'Compact', desc: 'Tighter layout, more content visible' },
                  ]}
                />
              </SettingGroup>
            </>
          )}

          {activeSection === 'Learning' && (
            <>
              <SettingGroup title="Default AI Scope" description="Controls how much context the assistant uses by default.">
                <RadioGroup
                  value={aiScope}
                  onChange={setAiScope}
                  options={[
                    { value: 'current-node', label: 'Current Node', desc: 'Scoped to the active learning node only' },
                    { value: 'current-module', label: 'Current Module', desc: 'Includes parent topic and siblings' },
                    { value: 'full-journey', label: 'Full Journey', desc: 'Entire curriculum context (slower responses)' },
                  ]}
                />
              </SettingGroup>
              <SettingGroup title="Progress Preferences">
                <ToggleRow label="Show node completion prompt" defaultChecked />
                <ToggleRow label="Auto-advance on completion" defaultChecked={false} />
                <ToggleRow label="Show prerequisite warnings" defaultChecked />
              </SettingGroup>
            </>
          )}

          {activeSection === 'Notebook' && (
            <>
              <SettingGroup title="Default Notebook" description="Where saved items are filed by default.">
                <RadioGroup
                  value={defaultNotebook}
                  onChange={setDefaultNotebook}
                  options={[
                    { value: 'journey', label: 'Current Journey', desc: 'Saved items go to the active journey notebook' },
                    { value: 'all', label: 'All Notes', desc: 'All saved items go to the root notebook' },
                  ]}
                />
              </SettingGroup>
              <SettingGroup title="Export Preferences">
                <RadioGroup
                  value={exportFormat}
                  onChange={setExportFormat}
                  options={[
                    { value: 'pdf', label: 'PDF', desc: 'Formatted document with sources' },
                    { value: 'markdown', label: 'Markdown', desc: 'Plain text format for external editors' },
                  ]}
                />
              </SettingGroup>
            </>
          )}

          {activeSection === 'Account' && (
            <>
              <SettingGroup title="Profile">
                <div className="flex items-center gap-4 p-4 bg-white border border-[#E3E0D8] rounded-lg">
                  <div className="w-10 h-10 rounded-full bg-[#2D2C28] flex items-center justify-center text-white font-medium">
                    A
                  </div>
                  <div>
                    <p className="text-sm font-medium text-[#1A1916]">Alex Chen</p>
                    <p className="text-xs text-[#7A7870]">alex@example.com</p>
                  </div>
                  <button className="ml-auto text-xs text-[#7A7870] border border-[#E3E0D8] px-3 py-1.5 rounded hover:bg-[#F0EEE9] transition-all">
                    Edit
                  </button>
                </div>
              </SettingGroup>
              <SettingGroup title="Data">
                <div className="space-y-2 text-sm text-[#7A7870]">
                  <button className="w-full text-left p-3 border border-[#E3E0D8] rounded-lg hover:border-[#B8B5AD] hover:text-[#1A1916] transition-all">
                    Export all data
                  </button>
                  <button className="w-full text-left p-3 border border-[#EDCEC8] rounded-lg text-[#A8554E] hover:border-[#D4837A] transition-all">
                    Delete account
                  </button>
                </div>
              </SettingGroup>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

function SettingGroup({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-3">
        <p className="text-sm font-medium text-[#1A1916]">{title}</p>
        {description && <p className="text-xs text-[#A8A5A0] mt-0.5">{description}</p>}
      </div>
      {children}
    </div>
  )
}

function RadioGroup({ value, onChange, options }: {
  value: string
  onChange: (v: string) => void
  options: { value: string; label: string; desc: string }[]
}) {
  return (
    <div className="space-y-2">
      {options.map(opt => (
        <label
          key={opt.value}
          className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-all ${
            value === opt.value
              ? 'border-[#5B7A58] bg-[#EFF4EE]'
              : 'border-[#E3E0D8] bg-white hover:border-[#B8B5AD]'
          }`}
        >
          <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center mt-0.5 flex-shrink-0 ${
            value === opt.value ? 'border-[#5B7A58]' : 'border-[#C0BDB5]'
          }`}>
            {value === opt.value && <div className="w-1.5 h-1.5 rounded-full bg-[#5B7A58]"></div>}
          </div>
          <div onClick={() => onChange(opt.value)} className="flex-1">
            <p className="text-sm font-medium text-[#1A1916]">{opt.label}</p>
            <p className="text-xs text-[#7A7870]">{opt.desc}</p>
          </div>
        </label>
      ))}
    </div>
  )
}

function ToggleRow({ label, defaultChecked }: { label: string; defaultChecked: boolean }) {
  const [checked, setChecked] = useState(defaultChecked)
  return (
    <div className="flex items-center justify-between py-2.5 border-b border-[#F0EEE9] last:border-0">
      <span className="text-sm text-[#3D3C38]">{label}</span>
      <button
        onClick={() => setChecked(!checked)}
        className={`w-9 h-5 rounded-full transition-colors relative flex-shrink-0 ${checked ? 'bg-[#5B7A58]' : 'bg-[#D4D0C8]'}`}
      >
        <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-transform ${checked ? 'translate-x-4' : 'translate-x-0.5'}`}></span>
      </button>
    </div>
  )
}
