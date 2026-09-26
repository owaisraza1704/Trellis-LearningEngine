import { useEffect, useState, type ReactNode } from 'react'
import { Group, Panel, Separator, useDefaultLayout } from 'react-resizable-panels'

export default function StudyPanels({ lesson, tools }: { lesson: ReactNode; tools: ReactNode }) {
  const [wideScreen, setWideScreen] = useState(false)
  const { defaultLayout, onLayoutChanged } = useDefaultLayout({
    id: 'trellis-study-layout',
    panelIds: ['lesson', 'study-tools'],
    onlySaveAfterUserInteractions: true,
  })

  useEffect(() => {
    const query = window.matchMedia('(min-width: 1280px)')
    const update = () => setWideScreen(query.matches)
    update()
    query.addEventListener('change', update)
    return () => query.removeEventListener('change', update)
  }, [])

  if (!wideScreen) {
    return (
      <div className="min-w-0 flex-1">
        {lesson}
        {tools}
      </div>
    )
  }

  return (
    <Group
      aria-label="Study workspace"
      className="min-h-0 min-w-0 flex-1"
      defaultLayout={defaultLayout}
      onLayoutChanged={onLayoutChanged}
      resizeTargetMinimumSize={{ fine: 12, coarse: 24 }}
    >
      <Panel id="lesson" minSize="55%">
        {lesson}
      </Panel>
      <Separator
        aria-label="Resize study panel"
        title="Drag or use arrow keys to resize"
        className="study-panel-divider flex w-2 items-center justify-center bg-[#F0EEE9]"
      >
        <span className="h-8 w-0.5 rounded-full bg-[#C6C2B9]" />
      </Separator>
      <Panel
        id="study-tools"
        defaultSize={360}
        minSize={280}
        maxSize={520}
        groupResizeBehavior="preserve-pixel-size"
      >
        {tools}
      </Panel>
    </Group>
  )
}
