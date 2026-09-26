import { test, expect, type Page } from '@playwright/test'
import type { Location, PathSummary } from '../src/lib/api'

const journeys: PathSummary[] = Array.from({ length: 27 }, (_, index) => {
  const number = String(index + 1).padStart(2, '0')
  const studied = index >= 14
  const completed = index >= 22
  return {
    id: `journey-${number}`,
    title: `Journey ${number}`,
    description:
      index === 2 ? 'Learn distributed systems and caching.' : `Learning topic ${number}.`,
    progress: completed ? 100 : 0,
    node_count: 4,
    completed_count: completed ? 4 : 0,
    updated_at: '2026-09-25T10:00:00Z',
    last_studied_at: studied ? `2026-09-${number}T10:00:00Z` : null,
    resume: studied
      ? { path_id: `journey-${number}`, node_id: `topic-${number}`, thread_id: `thread-${number}` }
      : null,
    notebook_item_count: index === 0 ? 0 : index,
    notebook_updated_at:
      index === 0 ? null : `2026-09-${String(28 - index).padStart(2, '0')}T10:00:00Z`,
  }
})

async function mockLibrary(
  page: Page,
  paths = journeys,
  initialLocation: Location = journeys[26].resume!,
) {
  let location = initialLocation
  const writes: Location[] = []
  await page.route('**/api/**', async (route) => {
    const pathname = new URL(route.request().url()).pathname
    if (pathname === '/api/workspace')
      return route.fulfill({
        json: {
          paths,
          location,
          location_detail: {
            path_title: 'Journey 27',
            node_title: 'Topic 27',
            thread_title: 'Exploration 27',
          },
          stats: {
            paths: paths.length,
            nodes: paths.length * 4,
            completed: 20,
            notebook_items: 30,
          },
        },
      })
    if (pathname === '/api/location') {
      location = route.request().postDataJSON()
      writes.push(location)
      return route.fulfill({ json: location })
    }
    if (pathname === '/api/paths') return route.fulfill({ json: paths })
    const path = paths.find((item) => pathname === `/api/paths/${item.id}`)
    if (path) return route.fulfill({ json: { ...path, input: path.description, nodes: [] } })
    const number = pathname.match(/^\/api\/(?:nodes\/topic|threads\/thread)-(\d+)$/)?.[1]
    if (number) {
      const parent = paths.find((item) => item.id === `journey-${number}`)!
      const node = {
        id: `topic-${number}`,
        path_id: parent.id,
        parent_id: null,
        title: `Topic ${number}`,
        description: '',
        position: 0,
        status: 'in_progress',
      }
      const thread = {
        id: `thread-${number}`,
        path_id: parent.id,
        node_id: node.id,
        title: `Exploration ${number}`,
        status: 'open',
        seed_context: '',
        created_at: parent.updated_at,
      }
      return route.fulfill({
        json: { node, path: parent, nodes: [node], thread, threads: [thread], interactions: [] },
      })
    }
    if (pathname === '/api/notebook/pages') return route.fulfill({ json: [] })
    return route.fulfill({ status: 404, json: { detail: `Unexpected ${pathname}` } })
  })
  return { writes, location: () => location }
}

test('journey library searches, filters and paginates a large collection', async ({ page }) => {
  const state = await mockLibrary(page)
  await page.goto('/?screen=journeys')
  await expect(page.getByRole('heading', { name: 'My Journeys', exact: true })).toBeVisible()
  await expect(page.getByRole('article')).toHaveCount(12)
  await expect(page.getByRole('status')).toHaveText('1–12 of 27 journeys')
  await expect(page.getByRole('article').first()).toHaveAccessibleName('Journey 27')
  await page.getByRole('button', { name: 'Next', exact: true }).click()
  await expect(page.getByRole('status')).toHaveText('13–24 of 27 journeys')
  await page.getByRole('button', { name: 'Next', exact: true }).click()
  await expect(page.getByRole('article')).toHaveCount(3)
  await expect(page.getByRole('button', { name: 'Next', exact: true })).toBeDisabled()
  await page.getByLabel('Search journeys').fill('caching')
  await expect(page.getByRole('article')).toHaveCount(1)
  await expect(page.getByRole('article').first()).toHaveAccessibleName('Journey 03')
  await expect(page.getByRole('status')).toHaveText('1–1 of 1 journey · 27 total')
  await page.getByRole('button', { name: 'Completed', exact: true }).click()
  await expect(page.getByText('No matching journeys.', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Clear filters', exact: true }).click()
  await expect(page.getByRole('article')).toHaveCount(12)
  await expect(page.getByRole('status')).toHaveText('1–12 of 27 journeys')
  expect(state.writes).toEqual([])
})

test('status filters include studied journeys with zero completed topics and sort by name', async ({
  page,
}) => {
  await mockLibrary(page)
  await page.goto('/?screen=journeys')
  await page.getByRole('button', { name: 'In progress', exact: true }).click()
  await expect(page.getByRole('article')).toHaveCount(8)
  await expect(page.getByRole('article').first()).toHaveAccessibleName('Journey 22')
  await page.getByLabel('Sort by', { exact: true }).selectOption('name')
  await expect(page.getByRole('article').first()).toHaveAccessibleName('Journey 15')
  await page.getByRole('button', { name: 'Completed', exact: true }).click()
  await expect(page.getByRole('article')).toHaveCount(5)
  await expect(page.getByRole('article').first()).toHaveAccessibleName('Journey 23')
  await page.getByRole('button', { name: 'Not started', exact: true }).click()
  await expect(page.getByRole('status')).toHaveText('1–12 of 14 journeys · 27 total')
  await expect(
    page.getByRole('article').getByRole('button', { name: 'Continue learning' }),
  ).toHaveCount(0)
})

test('opening a curriculum preserves resume while Continue learning opens the exact saved thread', async ({
  page,
}) => {
  const state = await mockLibrary(page)
  await page.goto('/?screen=journeys')
  await page
    .getByRole('article', { name: 'Journey 26', exact: true })
    .getByRole('button', { name: 'Open journey', exact: true })
    .click()
  await expect(page).toHaveURL(/screen=graph&path=journey-26$/)
  await expect(page.getByRole('heading', { name: 'Journey 26', exact: true })).toBeVisible()
  expect(state.writes).toEqual([])
  expect(state.location()).toEqual(journeys[26].resume)
  await page.getByRole('button', { name: 'My Journeys', exact: true }).first().click()
  await expect(page).toHaveURL(/\?screen=journeys$/)
  await page
    .getByRole('article', { name: 'Journey 26', exact: true })
    .getByRole('button', { name: 'Continue learning', exact: true })
    .click()
  await expect(page).toHaveURL(/screen=node&path=journey-26&node=topic-26&thread=thread-26$/)
  await expect(page.getByRole('heading', { name: 'Exploration 26', exact: true })).toBeVisible()
  await expect.poll(() => state.writes.at(-1)).toEqual(journeys[25].resume)
})

test('notebook library sorts by note activity and opens an explicit journey notebook', async ({
  page,
}) => {
  const state = await mockLibrary(page)
  await page.goto('/?screen=notebooks')
  await expect(page.getByRole('heading', { name: 'Notebooks', exact: true })).toBeVisible()
  await expect(page.getByRole('article').first()).toHaveAccessibleName('Journey 02')
  await expect(page.getByRole('article').first().getByText('1 note', { exact: true })).toBeVisible()
  await page.getByLabel('Search notebooks by journey').fill('Journey 01')
  await expect(page.getByText('0 notes', { exact: true })).toBeVisible()
  await expect(page.getByText('No notes added yet', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Open notebook', exact: true }).click()
  await expect(page).toHaveURL(/screen=notebook&path=journey-01$/)
  await expect(
    page.getByRole('heading', { name: 'Journey 01 notebook', exact: true }),
  ).toBeVisible()
  expect(state.writes).toEqual([])
})

test('Home limits recent journeys and continues the latest actual study location', async ({
  page,
}) => {
  const state = await mockLibrary(page)
  await page.goto('/?screen=dashboard')
  await expect(page.getByRole('article')).toHaveCount(4)
  await expect(page.getByRole('article').first()).toHaveAccessibleName('Journey 27')
  await expect(page.getByRole('article').last()).toHaveAccessibleName('Journey 24')
  await expect(page.getByText('Exploring: Exploration 27', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'View all journeys', exact: true }).click()
  await expect(page).toHaveURL(/\?screen=journeys$/)
  await expect(page.getByRole('article')).toHaveCount(12)
  expect(state.writes).toEqual([])
  await page.getByRole('button', { name: 'Home', exact: true }).click()
  await page.getByRole('button', { name: 'Continue', exact: true }).click()
  await expect(page).toHaveURL(/screen=node&path=journey-27&node=topic-27&thread=thread-27$/)
  await expect.poll(() => state.writes.at(-1)).toEqual(journeys[26].resume)
})

test('Home does not call an unopened journey a study session and empty collections offer creation', async ({
  page,
}) => {
  await mockLibrary(page, [journeys[0]], {
    path_id: journeys[0].id,
    node_id: 'topic-01',
    thread_id: null,
  })
  await page.goto('/?screen=dashboard')
  await expect(page.getByRole('button', { name: 'Continue', exact: true })).toHaveCount(0)
  await expect(page.getByText('Choose a journey to begin studying.', { exact: true })).toBeVisible()
  await page.unroute('**/api/**')
  await mockLibrary(page, [], { path_id: null, node_id: null, thread_id: null })
  await page.goto('/?screen=journeys')
  await expect(
    page.getByRole('button', { name: 'Create your first journey', exact: true }),
  ).toBeVisible()
  await expect(page.getByLabel('Search journeys')).toHaveCount(0)
})

test('Home ignores a legacy location from browsing and resumes the most recently studied journey', async ({
  page,
}) => {
  const state = await mockLibrary(page, journeys, {
    path_id: 'journey-01',
    node_id: 'topic-01',
    thread_id: null,
  })
  await page.goto('/?screen=dashboard')
  await expect(page.getByRole('article').first()).toHaveAccessibleName('Journey 27')
  await expect(page.getByText('Last studied: Topic 27', { exact: true })).toHaveCount(0)
  await page.getByRole('button', { name: 'Continue', exact: true }).click()
  await expect(page).toHaveURL(/screen=node&path=journey-27&node=topic-27&thread=thread-27$/)
  await expect.poll(() => state.writes.at(-1)).toEqual(journeys[26].resume)
})
