import { expect, test, type Page } from '@playwright/test'
import type { Interaction, NotebookPage, StudySet } from '../src/lib/api'

const journey = {
  id: 'design-journey',
  title: 'System Design',
  description: 'Design reliable systems.',
  progress: 0,
  node_count: 1,
  completed_count: 0,
  updated_at: '2026-09-25T10:00:00Z',
}
const otherJourney = { ...journey, id: 'python-journey', title: 'Python' }
const node = {
  id: 'cache-node',
  path_id: journey.id,
  parent_id: null,
  title: 'Cache-aside',
  description: 'Read and write flow.',
  position: 0,
  status: 'in_progress',
}
const thread = {
  id: 'cache-thread',
  path_id: journey.id,
  node_id: node.id,
  title: 'Cache consistency',
  status: 'open',
  seed_context: 'Explore stale data.',
  created_at: journey.updated_at,
}
const original: Interaction = {
  id: 'original-response',
  path_id: journey.id,
  node_id: node.id,
  thread_id: thread.id,
  prompt: 'How do cache writes work?',
  content: '**Update the database** before removing the cached value. [1]',
  action: 'question',
  status: 'answered',
  evidence: [
    { id: 'cache-passage', title: 'Cache guide', excerpt: 'Update the data store first.' },
  ],
  evaluation: { status: 'passed', grounding: 1 },
  provider: 'fixture',
  model: 'fixture',
  created_at: journey.updated_at,
}

async function openNotebook(page: Page, title: string) {
  await page
    .locator('.workspace-sidebar')
    .getByRole('button', { name: 'Notebooks', exact: true })
    .click()
  await page.getByLabel('Search notebooks by journey').fill(title)
  await page
    .getByRole('article', { name: title, exact: true })
    .getByRole('button', { name: 'Open notebook', exact: true })
    .click()
}

async function mockNotebook(page: Page, failFirstSave = false) {
  const pages: NotebookPage[] = [
    {
      id: 'working',
      path_id: journey.id,
      title: 'Working notes',
      position: 0,
      items: [
        {
          id: 'cache-note',
          page_id: 'working',
          title: 'Cache writes',
          content: original.content,
          position: 0,
          created_at: journey.updated_at,
          node_id: node.id,
          thread_id: thread.id,
          evidence: original.evidence,
          origin: {
            path_id: journey.id,
            node_id: node.id,
            thread_id: thread.id,
            interaction_id: original.id,
          },
        },
      ],
    },
    {
      id: 'reference',
      path_id: journey.id,
      title: 'Reference notes',
      position: 1,
      items: [
        {
          id: 'routing-note',
          page_id: 'reference',
          title: 'Routing',
          content: 'Use `round robin` to distribute requests.',
          position: 0,
          created_at: journey.updated_at,
        },
      ],
    },
    {
      id: 'python-section',
      path_id: otherJourney.id,
      title: 'Python notes',
      position: 0,
      items: [
        {
          id: 'python-note',
          page_id: 'python-section',
          title: 'Python lists',
          content: 'Lists preserve order.',
          position: 0,
          created_at: journey.updated_at,
        },
      ],
    },
  ]
  const selection: StudySet = {
    id: 'design-study',
    path_id: journey.id,
    title: 'Design revision',
    item_ids: ['routing-note', 'cache-note'],
    created_at: journey.updated_at,
  }
  const writes: Array<{ url: string; body: Record<string, unknown> }> = []
  let saveFailed = false
  await page.route('**/api/**', async (route) => {
    const url = new URL(route.request().url())
    const method = route.request().method()
    const body = route.request().postData() ? route.request().postDataJSON() : undefined
    if (url.pathname === '/api/workspace')
      return route.fulfill({
        json: {
          paths: [journey, otherJourney],
          location: { path_id: journey.id, node_id: node.id, thread_id: null },
          stats: { paths: 2, nodes: 2, completed: 0, notebook_items: 3 },
        },
      })
    if (url.pathname === '/api/location') return route.fulfill({ json: body })
    if (url.pathname === `/api/nodes/${node.id}`)
      return route.fulfill({
        json: { path: journey, node, nodes: [node], interactions: [], threads: [thread] },
      })
    if (url.pathname === `/api/threads/${thread.id}`)
      return route.fulfill({
        json: {
          path: journey,
          node,
          thread,
          interactions: [
            original,
            {
              ...original,
              id: 'later-response',
              prompt: 'What about replication?',
              content: 'A later response.',
            },
          ],
        },
      })
    if (url.pathname === '/api/notebook/pages')
      return route.fulfill({
        json: pages.filter((section) => section.path_id === url.searchParams.get('path_id')),
      })
    if (url.pathname.startsWith('/api/notebook/items/') && method === 'PATCH') {
      writes.push({ url: url.pathname, body })
      if (failFirstSave && !saveFailed && body.content) {
        saveFailed = true
        return route.fulfill({ status: 503, json: { detail: 'Save failed. Please try again.' } })
      }
      const id = url.pathname.split('/').at(-1)
      const source = pages.find((section) => section.items.some((item) => item.id === id))!
      const item = source.items.find((item) => item.id === id)!
      if (body.page_id && source.id !== body.page_id) {
        source.items = source.items.filter((item) => item.id !== id)
        pages.find((section) => section.id === body.page_id)!.items.push(item)
      }
      Object.assign(item, body)
      return route.fulfill({ json: item })
    }
    if (url.pathname === '/api/study-sessions') return route.fulfill({ json: [selection] })
    if (url.pathname === `/api/study-sessions/${selection.id}`) {
      Object.assign(selection, body)
      return route.fulfill({ json: selection })
    }
    if (url.pathname === '/api/exports') return route.fulfill({ json: [] })
    return route.fulfill({ status: 404, json: { detail: `Unexpected ${method} ${url.pathname}` } })
  })
  return { pages, writes, selection }
}

test('notebook drafts survive search, note and journey switches, screen navigation and reload', async ({
  page,
}) => {
  const { pages, writes } = await mockNotebook(page)
  await page.goto(`/?screen=notebook&path=${journey.id}`)
  await page.getByRole('button', { name: 'Edit selected note', exact: true }).click()
  await page.getByLabel('Title', { exact: true }).fill('Cache draft')
  await page.getByLabel('Content · Markdown supported').fill('Unsaved cache explanation.')
  await page.getByRole('button', { name: 'Reference notes', exact: true }).click()
  await page.getByRole('button', { name: 'Edit selected note', exact: true }).click()
  await page.getByLabel('Content · Markdown supported').fill('A separate routing draft.')
  await page.getByRole('button', { name: 'All notes', exact: false }).click()
  await page.getByLabel('Search notebook').fill('cache')
  await expect(page.getByLabel('Title', { exact: true })).toHaveValue('Cache draft')
  await expect(page.getByLabel('Content · Markdown supported')).toHaveValue(
    'Unsaved cache explanation.',
  )
  await openNotebook(page, otherJourney.title)
  await expect(page.getByRole('heading', { name: 'Python lists', exact: true })).toBeVisible()
  await expect(page.getByLabel('Title', { exact: true })).toHaveCount(0)
  await openNotebook(page, journey.title)
  await expect(page.getByLabel('Title', { exact: true })).toHaveValue('Cache draft')
  await page.getByRole('link', { name: 'Study & export', exact: true }).click()
  await page
    .getByRole('navigation', { name: 'Journey sections' })
    .getByRole('button', { name: 'Notebook', exact: true })
    .click()
  await expect(page.getByLabel('Title', { exact: true })).toHaveValue('Cache draft')
  await page.reload()
  await expect(page.getByLabel('Content · Markdown supported')).toHaveValue(
    'Unsaved cache explanation.',
  )
  await page.getByRole('button', { name: 'Reference notes', exact: true }).click()
  await expect(page.getByLabel('Content · Markdown supported')).toHaveValue(
    'A separate routing draft.',
  )
  await page.getByRole('button', { name: 'Save note', exact: true }).click()
  await expect(page.locator('article')).toContainText('A separate routing draft.')
  await page.getByRole('button', { name: 'Working notes', exact: true }).click()
  await expect(page.getByLabel('Title', { exact: true })).toHaveValue('Cache draft')
  expect(writes).toHaveLength(1)
  expect(writes[0].url).toBe('/api/notebook/items/routing-note')
  expect(pages[0].items[0].content).toBe(original.content)
  await page.getByRole('button', { name: 'Discard draft', exact: true }).click()
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Cache writes', exact: true })).toBeVisible()
  await expect(page.getByLabel('Title', { exact: true })).toHaveCount(0)
})

test('moving a note and a failed save preserve its draft until that note saves successfully', async ({
  page,
}) => {
  const { pages, writes } = await mockNotebook(page, true)
  await page.goto(`/?screen=notebook&path=${journey.id}`)
  await page.getByRole('button', { name: 'Edit selected note', exact: true }).click()
  await page.getByLabel('Content · Markdown supported').fill('Revised write ordering.')
  await page.getByLabel('Notebook section', { exact: true }).selectOption('reference')
  await expect.poll(() => pages[1].items.map((item) => item.id)).toContain('cache-note')
  await page.getByRole('button', { name: /^Cache writes/ }).click()
  await expect(page.getByLabel('Content · Markdown supported')).toHaveValue(
    'Revised write ordering.',
  )
  await page.getByRole('button', { name: 'Save note', exact: true }).click()
  await expect(page.getByRole('alert').filter({ hasText: 'Save failed' })).toBeVisible()
  await page.reload()
  await page.getByRole('button', { name: /^Cache writes/ }).click()
  await expect(page.getByLabel('Content · Markdown supported')).toHaveValue(
    'Revised write ordering.',
  )
  await page.getByRole('button', { name: 'Save note', exact: true }).click()
  await expect(page.getByLabel('Content · Markdown supported')).toHaveCount(0)
  await expect(page.locator('article')).toContainText('Revised write ordering.')
  expect(writes.filter((write) => write.body.content)).toHaveLength(2)
})

test('a note deep link selects that note and returns to its exact originating thread response', async ({
  page,
}) => {
  await mockNotebook(page)
  await page.goto(`/?screen=notebook&path=${journey.id}&note=removed-note`)
  await expect(
    page.getByText('The linked note is no longer available', { exact: false }),
  ).toBeVisible()
  await page.goto(`/?screen=notebook&path=${journey.id}&note=routing-note`)
  await expect(page.getByRole('heading', { name: 'Routing', exact: true })).toBeVisible()
  await page.goto(`/?screen=notebook&path=${journey.id}&note=cache-note`)
  await page.getByRole('button', { name: 'Return to original response', exact: true }).click()
  await expect(page).toHaveURL(new RegExp(`thread=${thread.id}.*interaction=${original.id}`))
  await expect(page.getByRole('heading', { name: original.prompt, exact: true })).toBeVisible()
  await expect(page.locator('article').first()).toContainText('Update the database')
  await expect(page.locator('article').first()).not.toContainText('A later response.')
})

for (const reviseSavedNote of [false, true]) {
  test(`a delayed save preserves ${reviseSavedNote ? 'newer edits and other notes' : 'other notes drafted after returning'}`, async ({
    page,
  }) => {
    const { pages } = await mockNotebook(page)
    let finishSave: (() => void) | undefined
    await page.route('**/api/notebook/items/cache-note', async (route) => {
      await new Promise<void>((resolve) => {
        finishSave = resolve
      })
      await route.fallback()
    })
    await page.goto(`/?screen=notebook&path=${journey.id}`)
    await page.getByRole('button', { name: 'Edit selected note', exact: true }).click()
    await page.getByLabel('Content · Markdown supported').fill('First revision.')
    await page.getByRole('button', { name: 'Save note', exact: true }).click()
    await expect.poll(() => !!finishSave).toBe(true)
    await page.getByRole('link', { name: 'Study & export', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Study material', exact: true })).toBeVisible()
    await page
      .getByRole('navigation', { name: 'Journey sections' })
      .getByRole('button', { name: 'Notebook', exact: true })
      .click()
    await expect(page.getByLabel('Content · Markdown supported')).toHaveValue('First revision.')
    if (reviseSavedNote)
      await page.getByLabel('Content · Markdown supported').fill('Newer unsaved revision.')
    await page.getByRole('button', { name: 'Reference notes', exact: true }).click()
    await page.getByRole('button', { name: 'Edit selected note', exact: true }).click()
    await page.getByLabel('Content · Markdown supported').fill('Independent routing draft.')
    finishSave!()
    await expect.poll(() => pages[0].items[0].content).toBe('First revision.')
    await page.reload()
    if (reviseSavedNote)
      await expect(page.getByLabel('Content · Markdown supported')).toHaveValue(
        'Newer unsaved revision.',
      )
    else await expect(page.locator('article')).toContainText('First revision.')
    await page.getByRole('button', { name: 'Reference notes', exact: true }).click()
    await expect(page.getByLabel('Content · Markdown supported')).toHaveValue(
      'Independent routing draft.',
    )
  })
}

test('study preview renders the selected notes and sources in the saved export order', async ({
  page,
}) => {
  const { selection } = await mockNotebook(page)
  await page.goto(`/?screen=session&path=${journey.id}`)
  const preview = page.getByRole('region', { name: 'Reading preview', exact: true })
  await expect(preview.getByRole('heading', { level: 3 })).toHaveText(['Routing', 'Cache writes'])
  await expect(preview.locator('code')).toHaveText('round robin')
  await expect(preview.locator('strong')).toHaveText('Update the database')
  await preview.getByText('Saved sources', { exact: true }).click()
  await expect(preview).toContainText('Update the data store first.')
  await page.getByRole('button', { name: 'Move Cache writes earlier', exact: true }).click()
  await expect(preview.getByRole('heading', { level: 3 })).toHaveText(['Cache writes', 'Routing'])
  expect(selection.item_ids).toEqual(['cache-note', 'routing-note'])
  await page.reload()
  await expect(preview.getByRole('heading', { level: 3 })).toHaveText(['Cache writes', 'Routing'])
  await page.getByRole('checkbox', { name: /^Routing/ }).click()
  await expect(page.getByRole('checkbox', { name: /^Routing/ })).not.toBeChecked()
  await expect(preview.getByRole('heading', { level: 3 })).toHaveText(['Cache writes'])
})
