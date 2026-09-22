'use client'

import { useEffect, useState, type ReactNode } from 'react'
import Landing from './screens/Landing'
import Dashboard from './screens/Dashboard'
import CurriculumGraph from './screens/CurriculumGraph'
import LearningNode from './screens/LearningNode'
import CreateJourney from './screens/CreateJourney'
import Notebook from './screens/Notebook'
import History from './screens/History'
import Settings from './screens/Settings'
import StudySession from './screens/StudySession'

type Screen = 'landing' | 'dashboard' | 'graph' | 'node' | 'create' | 'notebook' | 'history' | 'settings' | 'session'

function SidebarTooltip({ label, show, children }: { label: string; show: boolean; children: ReactNode }) {
  const [hovered, setHovered] = useState(false)
  if (!show) return <>{children}</>
  return (
    <div className="relative" onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}>
      {children}
      {hovered && (
        <div className="absolute left-full ml-2.5 top-1/2 -translate-y-1/2 z-50 bg-[#2D2C28] text-white text-xs px-2.5 py-1.5 rounded-md whitespace-nowrap shadow-lg pointer-events-none">
          {label}
          <div className="absolute right-full top-1/2 -translate-y-1/2 border-4 border-transparent border-r-[#2D2C28]"></div>
        </div>
      )}
    </div>
  )
}

export default function App() {
  const [screen, setScreen] = useState<Screen>('landing')
  const [collapsed, setCollapsed] = useState(() => {
    try { return localStorage.getItem('sidebar-collapsed') === 'true' } catch { return false }
  })

  useEffect(() => {
    try { localStorage.setItem('sidebar-collapsed', String(collapsed)) } catch {}
  }, [collapsed])

  const navigate = (s: string) => setScreen(s as Screen)

  if (screen === 'landing') {
    return <Landing onEnter={() => setScreen('dashboard')} />
  }

  const navItems = [
    { id: 'dashboard' as Screen, label: 'Home', icon: <HomeIcon /> },
    { id: 'graph' as Screen, label: 'My Journeys', icon: <JourneysIcon /> },
    { id: 'notebook' as Screen, label: 'Notebook', icon: <NotebookIcon /> },
    { id: 'create' as Screen, label: 'New Journey', icon: <PlusIcon /> },
  ]

  const sidebarW = collapsed ? 'w-[68px]' : 'w-56'

  return (
    <div className="flex h-screen bg-[#F7F6F2] overflow-hidden">
      {/* Sidebar */}
      <aside className={`${sidebarW} flex-shrink-0 flex flex-col border-r border-[#E3E0D8] bg-[#F2F0EC] py-5 transition-all duration-200 relative`}>
        {/* Collapse toggle */}
        <button
          onClick={() => setCollapsed(c => !c)}
          className="absolute -right-3 top-6 z-20 w-6 h-6 rounded-full bg-white border border-[#E3E0D8] shadow-sm flex items-center justify-center text-[#7A7870] hover:text-[#1A1916] hover:border-[#B8B5AD] transition-all"
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
            <path
              d={collapsed ? 'M3 2l4 3-4 3' : 'M7 2L3 5l4 3'}
              stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
            />
          </svg>
        </button>

        <div className={`${collapsed ? 'px-3' : 'px-4'} flex flex-col flex-1 overflow-hidden`}>
          {/* Logo */}
          <button
            onClick={() => setScreen('landing')}
            className={`flex items-center gap-2.5 mb-7 group ${collapsed ? 'justify-center' : ''}`}
          >
            <TrellisLogo />
            {!collapsed && (
              <span className="font-display text-base font-medium text-[#1A1916] group-hover:text-[#5B7A58] transition-colors">Trellis</span>
            )}
          </button>

          {/* Main nav */}
          <nav className="flex-1 space-y-0.5">
            {navItems.map(item => (
              <SidebarTooltip key={item.id} label={item.label} show={collapsed}>
                <button
                  onClick={() => setScreen(item.id)}
                  className={`w-full flex items-center gap-2.5 rounded-lg text-sm transition-all ${
                    collapsed ? 'justify-center px-0 py-2.5' : 'px-3 py-2.5'
                  } ${
                    screen === item.id
                      ? 'bg-white text-[#1A1916] shadow-sm border border-[#E3E0D8]'
                      : 'text-[#7A7870] hover:bg-[#EAE8E3] hover:text-[#1A1916]'
                  }`}
                >
                  <span className={screen === item.id ? 'text-[#5B7A58]' : 'text-[#A8A5A0]'}>{item.icon}</span>
                  {!collapsed && item.label}
                </button>
              </SidebarTooltip>
            ))}

            {/* Active journey section */}
            {!collapsed && (
              <div className="pt-4 mt-2 border-t border-[#E3E0D8]">
                <p className="text-xs text-[#A8A5A0] px-3 mb-2 uppercase tracking-widest">Active Journey</p>
                <button
                  onClick={() => setScreen('graph')}
                  className={`w-full flex items-start gap-2.5 px-3 py-2.5 rounded-lg text-sm transition-all ${
                    screen === 'graph' ? 'bg-white text-[#1A1916] shadow-sm border border-[#E3E0D8]' : 'text-[#7A7870] hover:bg-[#EAE8E3] hover:text-[#1A1916]'
                  }`}
                >
                  <span className="w-3 h-3 rounded-full bg-[#5B7A58] mt-0.5 flex-shrink-0"></span>
                  <div className="text-left">
                    <p className="font-medium text-xs text-[#1A1916]">Machine Learning</p>
                    <p className="text-xs text-[#A8A5A0] mt-0.5">42% · Logistic Regression</p>
                  </div>
                </button>
                <button
                  onClick={() => setScreen('node')}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs transition-all mt-0.5 ${
                    screen === 'node' ? 'bg-[#EEF0F9] text-[#4A5FA5]' : 'text-[#A8A5A0] hover:bg-[#EAE8E3] hover:text-[#7A7870]'
                  }`}
                >
                  <span className="w-2 h-2 rounded-full bg-[#4A5FA5] flex-shrink-0"></span>
                  Logistic Regression
                </button>
              </div>
            )}

            {collapsed && (
              <div className="mt-3 pt-3 border-t border-[#E3E0D8]">
                <SidebarTooltip label="Machine Learning — 42%" show>
                  <button
                    onClick={() => setScreen('graph')}
                    className="w-full flex justify-center py-2.5 rounded-lg hover:bg-[#EAE8E3] transition-all"
                  >
                    <span className="w-3 h-3 rounded-full bg-[#5B7A58]"></span>
                  </button>
                </SidebarTooltip>
              </div>
            )}
          </nav>

          {/* Bottom nav */}
          <div className="space-y-0.5 border-t border-[#E3E0D8] pt-3">
            <SidebarTooltip label="History" show={collapsed}>
              <button
                onClick={() => setScreen('history')}
                className={`w-full flex items-center gap-2.5 rounded-lg text-sm transition-all ${
                  collapsed ? 'justify-center px-0 py-2' : 'px-3 py-2'
                } ${
                  screen === 'history'
                    ? 'bg-white text-[#1A1916] border border-[#E3E0D8]'
                    : 'text-[#7A7870] hover:bg-[#EAE8E3] hover:text-[#1A1916]'
                }`}
              >
                <HistoryIcon />
                {!collapsed && 'History'}
              </button>
            </SidebarTooltip>
            <SidebarTooltip label="Settings" show={collapsed}>
              <button
                onClick={() => setScreen('settings')}
                className={`w-full flex items-center gap-2.5 rounded-lg text-sm transition-all ${
                  collapsed ? 'justify-center px-0 py-2' : 'px-3 py-2'
                } ${
                  screen === 'settings'
                    ? 'bg-white text-[#1A1916] border border-[#E3E0D8]'
                    : 'text-[#7A7870] hover:bg-[#EAE8E3] hover:text-[#1A1916]'
                }`}
              >
                <SettingsIcon />
                {!collapsed && 'Settings'}
              </button>
            </SidebarTooltip>

            {/* Profile */}
            <SidebarTooltip label="Alex Chen" show={collapsed}>
              <div className={`flex items-center gap-2.5 rounded-lg py-2.5 mt-1 ${collapsed ? 'justify-center' : 'px-3'}`}>
                <div className="w-6 h-6 rounded-full bg-[#2D2C28] flex items-center justify-center text-white text-xs font-medium flex-shrink-0">
                  A
                </div>
                {!collapsed && (
                  <div className="text-left flex-1 min-w-0">
                    <p className="text-xs font-medium text-[#1A1916] truncate">Alex Chen</p>
                    <p className="text-xs text-[#A8A5A0]">4 journeys</p>
                  </div>
                )}
              </div>
            </SidebarTooltip>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main className={`flex-1 overflow-hidden ${screen === 'node' ? '' : 'overflow-y-auto p-8'}`}>
        {screen === 'dashboard' && <Dashboard onNavigate={navigate} />}
        {screen === 'graph' && <CurriculumGraph onNavigate={navigate} />}
        {screen === 'node' && <LearningNode onNavigate={navigate} />}
        {screen === 'create' && <CreateJourney onNavigate={navigate} />}
        {screen === 'notebook' && <Notebook />}
        {screen === 'history' && <History onNavigate={navigate} />}
        {screen === 'settings' && <Settings />}
        {screen === 'session' && <StudySession onNavigate={navigate} />}
      </main>
    </div>
  )
}

function TrellisLogo() {
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
      <circle cx="11" cy="4" r="2.5" fill="#5B7A58" />
      <circle cx="4" cy="14" r="2" fill="#5B7A58" opacity="0.7" />
      <circle cx="18" cy="14" r="2" fill="#5B7A58" opacity="0.7" />
      <circle cx="11" cy="19" r="1.5" fill="#5B7A58" opacity="0.5" />
      <line x1="11" y1="6.5" x2="4" y2="12" stroke="#5B7A58" strokeWidth="1.2" />
      <line x1="11" y1="6.5" x2="18" y2="12" stroke="#5B7A58" strokeWidth="1.2" />
      <line x1="4" y1="16" x2="11" y2="17.5" stroke="#5B7A58" strokeWidth="1" opacity="0.6" />
      <line x1="18" y1="16" x2="11" y2="17.5" stroke="#5B7A58" strokeWidth="1" opacity="0.6" />
    </svg>
  )
}

function HomeIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
      <path d="M2 7l6-5 6 5v7a1 1 0 01-1 1H3a1 1 0 01-1-1V7z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M6 14V9h4v5" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  )
}

function JourneysIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
      <circle cx="8" cy="3" r="2" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="3" cy="12" r="1.5" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="13" cy="12" r="1.5" stroke="currentColor" strokeWidth="1.5" />
      <line x1="8" y1="5" x2="3" y2="10.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="8" y1="5" x2="13" y2="10.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}

function NotebookIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
      <rect x="3" y="2" width="10" height="12" rx="1" stroke="currentColor" strokeWidth="1.5" />
      <line x1="6" y1="2" x2="6" y2="14" stroke="currentColor" strokeWidth="1.5" />
      <line x1="8.5" y1="6" x2="11" y2="6" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
      <line x1="8.5" y1="9" x2="11" y2="9" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  )
}

function PlusIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
      <line x1="8" y1="3" x2="8" y2="13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="3" y1="8" x2="13" y2="8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}

function HistoryIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
      <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.5" />
      <path d="M8 5v3l2 1.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function SettingsIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
      <circle cx="8" cy="8" r="2" stroke="currentColor" strokeWidth="1.5" />
      <path d="M8 1.5v1.7M8 12.8v1.7M1.5 8h1.7M12.8 8h1.7M3.4 3.4l1.2 1.2M11.4 11.4l1.2 1.2M12.6 3.4l-1.2 1.2M4.6 11.4l-1.2 1.2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}
