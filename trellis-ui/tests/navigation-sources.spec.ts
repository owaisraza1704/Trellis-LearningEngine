import { test, expect, type Page } from '@playwright/test'
import type { Location, PathDetail, Source, Thread } from '../src/lib/api'

const created = '2026-09-25T10:00:00Z'
const paths: PathDetail[] = [
  {
    id: 'databases',
    title: 'Database fundamentals',
    description: 'Understand relational data.',
    input: 'Learn databases',
    progress: 0,
    node_count: 2,
    completed_count: 0,
    updated_at: created,
    nodes: [
      {
        id: 'transactions',
        path_id: 'databases',
        parent_id: null,
        title: 'Transactions',
        description: 'Atomic units of work.',
        position: 0,
        status: 'in_progress',
        evidence_ids: ['passage-1'],
      },
      {
        id: 'indexes',
        path_id: 'databases',
        parent_id: null,
        title: 'Indexes',
        description: 'Finding rows efficiently.',
        position: 1,
        status: 'not_started',
        evidence_ids: ['passage-1'],
      },
    ],
    generation: {
      mode: 'goal',
      provider: 'openai',
      model: 'configured-model',
      created_at: created,
      evidence: [
        {
          id: 'passage-1',
          source_id: 'source-1',
          title: 'Database handbook',
          location: 'Page 12',
          excerpt: 'An index helps locate rows without scanning every row.',
          url: 'https://example.org/database-handbook',
        },
      ],
      evaluation: {
        status: 'evaluated',
        grounding: 0.9,
        relevance: 0.8,
        explanation: 'The source covers both requested topics.',
      },
    },
  },
  {
    id: 'networks',
    title: 'Computer networks',
    description: 'Connections and packets.',
    input: 'Networking',
    progress: 0,
    node_count: 1,
    completed_count: 0,
    updated_at: created,
    nodes: [
      {
        id: 'routing',
        path_id: 'networks',
        parent_id: null,
        title: 'Routing',
        description: 'Moving packets.',
        position: 0,
        status: 'not_started',
      },
    ],
  },
]
const thread: Thread = {
  id: 'index-details',
  path_id: 'databases',
  node_id: 'indexes',
  title: 'Index details',
  status: 'open',
  seed_context: '',
  created_at: created,
}

// These tests isolate browser navigation and request contracts from live AI services.
async function mockLearningWorkspace(page: Page, holdFirstWrite = false) {
  let location: Location = { path_id: 'databases', node_id: 'transactions', thread_id: null }
  const sessions: Record<string, Location> = {
    databases: location,
    networks: { path_id: 'networks', node_id: 'routing', thread_id: null },
  }
  const writes: Location[] = []
  let releaseFirstWrite = () => {}
  const firstWrite = new Promise<void>((resolve) => {
    releaseFirstWrite = resolve
  })
  let inFlight = 0
  let maximumInFlight = 0
  await page.route('**/api/**', async (route) => {
    const url = new URL(route.request().url()).pathname
    if (url === '/api/workspace')
      return route.fulfill({
        json: {
          paths,
          location,
          location_detail: {
            path_title: paths.find((path) => path.id === location.path_id)?.title,
            node_title: paths
              .flatMap((path) => path.nodes)
              .find((node) => node.id === location.node_id)?.title,
            thread_title: location.thread_id === thread.id ? thread.title : null,
          },
          stats: { paths: 2, nodes: 3, completed: 0, notebook_items: 0 },
        },
      })
    if (url === '/api/location') {
      const body: Location = route.request().postDataJSON()
      writes.push(body)
      inFlight++
      maximumInFlight = Math.max(maximumInFlight, inFlight)
      if (holdFirstWrite && writes.length === 1) await firstWrite
      location = 'node_id' in body ? body : sessions[body.path_id!] || body
      sessions[location.path_id!] = location
      await route.fulfill({ json: location })
      inFlight--
      return
    }
    if (url === '/api/paths') return route.fulfill({ json: paths })
    const path = paths.find((item) => url === `/api/paths/${item.id}`)
    if (path)
      return route.fulfill({ json: path.id === 'networks' ? { ...path, generation: {} } : path })
    const parent = paths.find((item) => item.nodes.some((node) => url === `/api/nodes/${node.id}`))
    if (parent)
      return route.fulfill({
        json: {
          node: parent.nodes.find((node) => url === `/api/nodes/${node.id}`),
          path: parent,
          nodes: parent.nodes,
          interactions: [],
          threads: url.endsWith('/indexes') ? [thread] : [],
        },
      })
    if (url === `/api/threads/${thread.id}`)
      return route.fulfill({
        json: { thread, node: paths[0].nodes[1], path: paths[0], interactions: [] },
      })
    return route.fulfill({ status: 404, json: { detail: `Unexpected ${url}` } })
  })
  return {
    writes,
    location: () => location,
    maximumInFlight: () => maximumInFlight,
    releaseFirstWrite,
  }
}

test('Back and Forward save the actual node while graph visits preserve it', async ({ page }) => {
  const state = await mockLearningWorkspace(page)
  await page.goto('/?screen=node&path=databases&node=transactions')
  await expect
    .poll(() => state.writes.at(-1))
    .toEqual({ path_id: 'databases', node_id: 'transactions', thread_id: null })
  await page
    .getByRole('main')
    .getByRole('button', { name: 'Database fundamentals', exact: true })
    .first()
    .click()
  await expect(
    page.getByRole('heading', { name: 'Database fundamentals', exact: true }),
  ).toBeVisible()
  await expect.poll(() => state.writes.at(-1)).toEqual({ path_id: 'databases' })
  expect(state.location().node_id).toBe('transactions')
  await page.getByRole('button', { name: 'Outline', exact: true }).click()
  await page.getByRole('button', { name: 'Indexes', exact: true }).click()
  await page.getByRole('button', { name: 'Open learning node' }).click()
  await expect.poll(() => state.location().node_id).toBe('indexes')
  await page.goBack()
  await expect(page.getByRole('heading', { name: 'Indexes', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Outline', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Indexes Last studied' })).toHaveAttribute(
    'aria-current',
    'step',
  )
  expect(state.location().node_id).toBe('indexes')
  await page.goBack()
  await expect.poll(() => state.location().node_id).toBe('transactions')
  await page.goForward()
  await expect(page.getByRole('heading', { name: 'Transactions', exact: true })).toBeVisible()
  expect(state.location().node_id).toBe('transactions')
  await page.goForward()
  await expect.poll(() => state.location().node_id).toBe('indexes')
  await page.getByRole('button', { name: 'Home', exact: true }).click()
  await expect(page.getByText('Last studied: Indexes', { exact: true })).toBeVisible()
})

test('direct thread links, graph visits and journey switching retain meaningful resume locations', async ({
  page,
}) => {
  const state = await mockLearningWorkspace(page)
  await page.goto('/?screen=node&path=databases&node=indexes&thread=index-details')
  await expect
    .poll(() => state.location())
    .toEqual({ path_id: 'databases', node_id: 'indexes', thread_id: 'index-details' })
  await page.getByRole('button', { name: 'My Journeys', exact: true }).click()
  await expect.poll(() => state.writes.at(-1)).toEqual({ path_id: 'databases' })
  await page.getByLabel('Choose journey').selectOption('networks')
  await expect
    .poll(() => state.location())
    .toEqual({ path_id: 'networks', node_id: 'routing', thread_id: null })
  await expect(page.getByRole('heading', { name: 'Routing', exact: true })).toBeVisible()
  await page.getByLabel('Choose journey').selectOption('databases')
  await expect.poll(() => state.location().thread_id).toBe('index-details')
  await expect(page.getByRole('heading', { name: 'Indexes', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Home', exact: true }).click()
  await expect(page.getByText('Exploring: Index details', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Continue', exact: true }).click()
  await expect(page).toHaveURL(/node=indexes&thread=index-details/)
  await expect(page.getByRole('heading', { name: 'Index details', exact: true })).toBeVisible()
})

test('rapid navigation serializes location writes and saves the newest route last', async ({
  page,
}) => {
  const state = await mockLearningWorkspace(page, true)
  await page.goto('/?screen=node&path=databases&node=transactions')
  await expect.poll(() => state.writes.length).toBe(1)
  await page.getByRole('button', { name: 'My Journeys', exact: true }).click()
  await page.getByRole('button', { name: 'Outline', exact: true }).click()
  await page.getByRole('button', { name: 'Indexes', exact: true }).click()
  await page.getByRole('button', { name: 'Open learning node' }).click()
  await expect(page).toHaveURL(/node=indexes/)
  expect(state.writes).toHaveLength(1)
  state.releaseFirstWrite()
  await expect.poll(() => state.location().node_id).toBe('indexes')
  expect(state.maximumInFlight()).toBe(1)
  expect(state.writes.at(-1)).toEqual({ path_id: 'databases', node_id: 'indexes', thread_id: null })
  await page.getByRole('button', { name: 'Home', exact: true }).click()
  await expect(page.getByText('Last studied: Indexes', { exact: true })).toBeVisible()
})

test('curriculum shows its original retained evidence and honest legacy assessment state', async ({
  page,
}) => {
  await mockLearningWorkspace(page)
  await page.goto('/?screen=graph&path=databases')
  await page.getByText('Original curriculum sources and assessment', { exact: true }).click()
  await expect(
    page.getByText('Recorded when this journey was created. Later edits have not been reassessed.'),
  ).toBeVisible()
  await expect(page.getByText('The source covers both requested topics.')).toBeVisible()
  await expect(
    page.getByText('An index helps locate rows without scanning every row.', { exact: true }),
  ).toBeVisible()
  await expect(
    page.getByRole('link', { name: 'https://example.org/database-handbook' }),
  ).toHaveAttribute('href', 'https://example.org/database-handbook')
  await expect(page.getByText('Original sources for this topic', { exact: true })).toBeVisible()
  await expect(
    page.getByText(
      'Automated assessment can make mistakes. Review the retained sources when checking a topic.',
    ),
  ).toBeVisible()
  await page.screenshot({
    path: test.info().outputPath('curriculum-source-basis.png'),
    fullPage: true,
  })
  await page.getByLabel('Choose journey').selectOption('networks')
  await expect(page.getByRole('heading', { name: 'Computer networks', exact: true })).toBeVisible()
  await page.getByText('Original curriculum sources and assessment', { exact: true }).click()
  await expect(page.getByText('Source assessment not recorded for this journey.')).toBeVisible()
  await expect(page.getByText('The source covers both requested topics.')).toHaveCount(0)
})

test('stale ready sources can reindex and surface processing failures in the list and details', async ({
  page,
}) => {
  const source: Source = {
    id: 'source-1',
    path_id: null,
    title: 'Database handbook',
    kind: 'text',
    status: 'ready',
    chunk_count: 2,
    created_at: created,
    needs_reindex: true,
    embedding_profile: 'previous-embedding-profile',
  }
  let retries = 0
  await page.route('**/api/**', async (route) => {
    const url = new URL(route.request().url()).pathname
    if (url === '/api/workspace')
      return route.fulfill({
        json: {
          paths: [],
          location: {},
          stats: { paths: 0, nodes: 0, completed: 0, notebook_items: 0 },
        },
      })
    if (url === '/api/sources/source-1/retry') {
      expect(route.request().method()).toBe('POST')
      retries++
      source.status = 'processing'
      return route.fulfill({ json: source })
    }
    if (url === '/api/sources') return route.fulfill({ json: [source] })
    if (url === '/api/sources/source-1')
      return route.fulfill({
        json: { ...source, excerpts: [{ content: 'A retained passage.', location: 'Page 12' }] },
      })
    return route.fulfill({ status: 404, json: { detail: `Unexpected ${url}` } })
  })
  await page.goto('/?screen=sources')
  await expect(
    page.getByText('Reindex needed to match the current embedding settings.'),
  ).toBeVisible()
  await page.getByRole('button', { name: 'Reindex Database handbook', exact: true }).click()
  await expect(page.getByText('processing', { exact: true })).toBeVisible()
  await expect(
    page.getByRole('button', { name: 'Reindex Database handbook', exact: true }),
  ).toHaveCount(0)
  expect(retries).toBe(1)
  source.status = 'failed'
  source.error = 'The embedding service is unavailable.'
  await expect(page.getByRole('main').getByRole('alert')).toHaveText(source.error)
  await expect(
    page.getByRole('button', { name: 'Retry Database handbook', exact: true }),
  ).toBeVisible()
  await page.getByRole('button', { name: 'Database handbook', exact: true }).click()
  const dialog = page.getByRole('dialog')
  await expect(dialog.getByRole('alert')).toHaveText(source.error)
  await expect(dialog.getByText('A retained passage.', { exact: true })).toBeVisible()
  await expect(dialog.getByRole('button', { name: 'Retry source', exact: true })).toBeVisible()
})

test('reviewing sources from a node attaches new material to that journey', async ({ page }) => {
  await mockLearningWorkspace(page)
  await page.route('**/api/nodes/transactions', (route) =>
    route.fulfill({
      json: {
        node: paths[0].nodes[0],
        path: paths[0],
        nodes: paths[0].nodes,
        threads: [],
        interactions: [
          {
            id: 'withheld',
            path_id: 'databases',
            node_id: 'transactions',
            thread_id: null,
            prompt: 'Explain transactions',
            content: 'More evidence is needed.',
            action: 'question',
            status: 'abstained',
            evidence: [],
            evaluation: { status: 'insufficient_evidence' },
            provider: 'openai',
            model: 'configured-model',
            created_at: created,
          },
        ],
      },
    }),
  )
  let source: Source | undefined
  let sourceBody: Record<string, unknown> | undefined
  const filters: Array<string | null> = []
  await page.route('**/api/sources**', async (route) => {
    const url = new URL(route.request().url())
    if (url.pathname === '/api/sources') {
      filters.push(url.searchParams.get('path_id'))
      return route.fulfill({ json: source ? [source] : [] })
    }
    if (url.pathname === '/api/sources/text') {
      sourceBody = route.request().postDataJSON()
      source = {
        id: 'new-source',
        path_id: sourceBody!.path_id as string,
        title: sourceBody!.title as string,
        kind: 'text',
        status: 'ready',
        chunk_count: 1,
        created_at: created,
      }
      return route.fulfill({ status: 202, json: source })
    }
    return route.fulfill({ status: 404, json: { detail: `Unexpected ${url.pathname}` } })
  })
  await page.goto('/?screen=node&path=databases&node=transactions')
  await page.getByRole('button', { name: 'Review sources', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Your sources', exact: true })).toBeVisible()
  await expect.poll(() => filters.at(-1)).toBe('databases')
  await page.getByRole('button', { name: 'Add Source', exact: true }).click()
  const dialog = page.getByRole('dialog')
  await expect(
    dialog.getByText('This source will be attached to the current journey.'),
  ).toBeVisible()
  await dialog.getByRole('button', { name: 'Paste text', exact: true }).click()
  await dialog.getByLabel('Source title').fill('Transaction handbook')
  await dialog.getByLabel('Source text').fill('A transaction is an atomic unit of work.')
  await dialog.getByRole('button', { name: 'Add Source', exact: true }).click()
  await expect(dialog).toHaveCount(0)
  expect(sourceBody).toEqual({
    title: 'Transaction handbook',
    content: 'A transaction is an atomic unit of work.',
    path_id: 'databases',
  })
  await expect(
    page.getByRole('button', { name: 'Transaction handbook', exact: true }),
  ).toBeVisible()
  await page.getByRole('button', { name: 'All sources', exact: true }).click()
  await expect.poll(() => filters.at(-1)).toBeNull()
})
