import { expect, test, type Page } from '@playwright/test'
import type { Location, PathDetail } from '../src/lib/api'

const paths: PathDetail[] = [
  {
    id: 'databases',
    title: 'Database fundamentals',
    description: 'Understand relational data.',
    input: 'Learn databases',
    progress: 0,
    node_count: 1,
    completed_count: 0,
    updated_at: '2026-09-25T10:00:00Z',
    last_studied_at: '2026-09-25T10:00:00Z',
    resume: { path_id: 'databases', node_id: 'transactions', thread_id: 'atomicity' },
    notebook_item_count: 0,
    notebook_updated_at: null,
    nodes: [
      {
        id: 'transactions',
        path_id: 'databases',
        parent_id: null,
        title: 'Transactions',
        description: 'Atomic units of work.',
        position: 0,
        status: 'in_progress',
      },
    ],
  },
  {
    id: 'system-design',
    title: 'Learning System Design',
    description: 'Design scalable systems.',
    input: 'Learn system design',
    progress: 0,
    node_count: 2,
    completed_count: 0,
    updated_at: '2026-09-24T10:00:00Z',
    last_studied_at: '2026-09-24T10:00:00Z',
    resume: { path_id: 'system-design', node_id: 'cache-invalidation', thread_id: null },
    notebook_item_count: 0,
    notebook_updated_at: null,
    nodes: [
      {
        id: 'load-balancing',
        path_id: 'system-design',
        parent_id: null,
        title: 'Load balancing',
        description: 'Distribute requests.',
        position: 0,
        status: 'not_started',
      },
      {
        id: 'cache-invalidation',
        path_id: 'system-design',
        parent_id: null,
        title: 'Cache invalidation',
        description: 'Keep cached data useful.',
        position: 1,
        status: 'in_progress',
      },
    ],
  },
]

async function mockNavigation(page: Page) {
  const writes: Location[] = []
  const reads: string[] = []
  await page.route('**/api/**', async (route) => {
    const url = new URL(route.request().url())
    if (route.request().method() === 'GET') reads.push(`${url.pathname}${url.search}`)
    if (url.pathname === '/api/workspace')
      return route.fulfill({
        json: {
          paths,
          location: paths[0].resume,
          location_detail: {
            path_title: paths[0].title,
            node_title: 'Transactions',
            thread_title: 'Atomicity',
          },
          stats: { paths: 2, nodes: 3, completed: 0, notebook_items: 0 },
        },
      })
    if (url.pathname === '/api/location') {
      writes.push(route.request().postDataJSON())
      return route.fulfill({ json: writes.at(-1) })
    }
    if (url.pathname === '/api/paths') return route.fulfill({ json: paths })
    const path = paths.find((item) => url.pathname === `/api/paths/${item.id}`)
    if (path) return route.fulfill({ json: path })
    if (
      ['/api/notebook/pages', '/api/study-sessions', '/api/exports', '/api/sources'].includes(
        url.pathname,
      )
    )
      return route.fulfill({ json: [] })
    return route.fulfill({ status: 404, json: { detail: `Unexpected ${url.pathname}` } })
  })
  return { writes, reads }
}

test('local journey sections keep their explicit journey without replacing the latest study position', async ({
  page,
}) => {
  const state = await mockNavigation(page)
  await page.goto('/?screen=graph&path=system-design')
  await expect(page.getByRole('heading', { name: 'Cache invalidation', exact: true })).toBeVisible()
  const sections = page.getByRole('navigation', { name: 'Journey sections' })
  await expect(sections.getByRole('button', { name: 'Curriculum', exact: true })).toHaveAttribute(
    'aria-current',
    'page',
  )
  await expect(page.getByRole('navigation', { name: 'Journey breadcrumb' })).toContainText(
    'Learning System Design',
  )

  await sections.getByRole('button', { name: 'Notebook', exact: true }).click()
  await expect(page).toHaveURL(/\?screen=notebook&path=system-design$/)
  await expect(
    page.getByRole('heading', { name: 'Learning System Design notebook', exact: true }),
  ).toBeVisible()
  await expect(sections.getByRole('button', { name: 'Notebook', exact: true })).toHaveAttribute(
    'aria-current',
    'page',
  )
  await expect(page.getByLabel('Learning journey', { exact: true })).toHaveCount(0)

  await sections.getByRole('button', { name: 'Sources', exact: true }).click()
  await expect(page).toHaveURL(/\?screen=sources&path=system-design$/)
  await expect(
    page.getByRole('heading', { name: 'Sources for Learning System Design', exact: true }),
  ).toBeVisible()
  await expect(
    page.getByRole('button', { name: 'Add source to this journey', exact: true }),
  ).toBeVisible()
  await expect.poll(() => state.reads).toContain('/api/sources?path_id=system-design')

  await sections.getByRole('button', { name: 'Study', exact: true }).click()
  await expect(page).toHaveURL(/\?screen=session&path=system-design$/)
  await expect(page.getByRole('heading', { name: 'Study material', exact: true })).toBeVisible()
  await expect.poll(() => state.reads).toContain('/api/study-sessions?path_id=system-design')
  await expect.poll(() => state.reads).toContain('/api/exports?path_id=system-design')

  await sections.getByRole('button', { name: 'Curriculum', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Cache invalidation', exact: true })).toBeVisible()
  await page
    .getByRole('navigation', { name: 'Main navigation' })
    .getByRole('button', { name: 'Home', exact: true })
    .click()
  await expect(page.getByText('Exploring: Atomicity', { exact: true })).toBeVisible()
  expect(state.writes).toEqual([])
})

test('global sidebar destinations always open collections and clear the journey header', async ({
  page,
}) => {
  const state = await mockNavigation(page)
  for (const [label, screen] of [
    ['My Journeys', 'journeys'],
    ['Notebooks', 'notebooks'],
    ['Source Library', 'sources'],
  ]) {
    await page.goto('/?screen=notebook&path=system-design')
    await expect(page.getByRole('navigation', { name: 'Journey sections' })).toBeVisible()
    await page
      .getByRole('navigation', { name: 'Main navigation' })
      .getByRole('button', { name: label, exact: true })
      .click()
    await expect(page).toHaveURL(new RegExp(`\\?screen=${screen}$`))
    await expect(page.getByRole('heading', { name: label, exact: true })).toBeVisible()
    await expect(page.getByRole('navigation', { name: 'Journey sections' })).toHaveCount(0)
    if (screen !== 'sources') await expect(page.getByRole('article')).toHaveCount(2)
  }
  await expect(page.getByRole('button', { name: 'Add to library', exact: true })).toBeVisible()
  await expect.poll(() => state.reads).toContain('/api/sources')
  expect(state.writes).toEqual([])
})

test('legacy pathless screens and stale global path parameters open collections without borrowing resume scope', async ({
  page,
}) => {
  const state = await mockNavigation(page)
  for (const [query, heading] of [
    ['screen=graph', 'My Journeys'],
    ['screen=notebook', 'Notebooks'],
    ['screen=session', 'Notebooks'],
    ['screen=journeys&path=system-design', 'My Journeys'],
    ['screen=notebooks&path=system-design', 'Notebooks'],
  ]) {
    await page.goto(`/?${query}`)
    await expect(page.getByRole('heading', { name: heading, exact: true })).toBeVisible()
    await expect(page.getByRole('article')).toHaveCount(2)
    await expect(page.getByRole('navigation', { name: 'Journey sections' })).toHaveCount(0)
  }
  expect(state.reads.every((url) => url === '/api/workspace')).toBe(true)
  expect(state.writes).toEqual([])
})
