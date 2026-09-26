import { expect, test, type Page } from '@playwright/test'
import type { Source } from '../src/lib/api'

const created = '2026-09-25T10:00:00Z'
const material: Source[] = [
  {
    id: 'uploaded-handbook',
    path_id: null,
    title: 'Database handbook.pdf',
    kind: 'upload',
    status: 'ready',
    chunk_count: 3,
    created_at: created,
  },
  {
    id: 'added-url',
    path_id: null,
    title: 'Official database guide',
    kind: 'url',
    url: 'https://example.org/database-guide',
    status: 'ready',
    chunk_count: 2,
    created_at: created,
  },
  {
    id: 'discovered-page',
    path_id: null,
    title: 'Automatically discovered page',
    kind: 'web',
    status: 'ready',
    chunk_count: 1,
    created_at: created,
  },
  {
    id: 'other-journey-material',
    path_id: 'another-journey',
    title: 'Another journey handbook',
    kind: 'text',
    status: 'ready',
    chunk_count: 1,
    created_at: created,
  },
]

// Local browser fixtures keep these interactions independent of uploads, stored data and AI.
async function mockSourceLibrary(page: Page) {
  const sources = material.map((source) => ({ ...source }))
  const submissions: unknown[] = []
  const deletions: string[] = []
  let addedSource: Source | undefined
  await page.route('**/api/**', async (route) => {
    const request = route.request()
    const url = new URL(request.url()).pathname
    if (url === '/api/workspace')
      return route.fulfill({
        json: {
          paths: [],
          location: {},
          stats: { paths: 0, nodes: 0, completed: 0, notebook_items: 0 },
        },
      })
    if (url === '/api/sources') return route.fulfill({ json: sources })
    if (url === '/api/sources/text') {
      const body = request.postDataJSON()
      addedSource = {
        id: 'new-material',
        path_id: body.path_id,
        title: body.title,
        kind: 'text',
        status: 'processing',
        chunk_count: 0,
        created_at: created,
      }
      sources.unshift(addedSource)
      return route.fulfill({ status: 202, json: addedSource })
    }
    const source = sources.find((item) => url === `/api/sources/${item.id}`)
    if (source && request.method() === 'DELETE') {
      deletions.push(source.id)
      sources.splice(sources.indexOf(source), 1)
      return route.fulfill({ status: 204 })
    }
    if (source)
      return route.fulfill({
        json: {
          ...source,
          excerpts: [{ content: 'A transaction groups database operations.', location: 'Page 2' }],
        },
      })
    if (url === '/api/paths' && request.method() === 'POST') {
      submissions.push(request.postDataJSON())
      return route.fulfill({ status: 503, json: { detail: 'Test model is unavailable.' } })
    }
    return route.fulfill({ status: 404, json: { detail: `Unexpected ${request.method()} ${url}` } })
  })
  return { submissions, deletions, addedSource: () => addedSource }
}

test('new journeys start empty and library preview or cancelled choices do not select evidence', async ({
  page,
}) => {
  const state = await mockSourceLibrary(page)
  await page.goto('/?screen=create')
  await expect(page.getByText('No material selected', { exact: true })).toBeVisible()
  await expect(page.getByText('Database handbook.pdf', { exact: true })).toHaveCount(0)
  await page.getByLabel('Your goal').fill('Learn transactions')
  await page.getByRole('button', { name: 'Choose from source library', exact: true }).click()
  const library = page.getByRole('dialog', { name: 'Choose from source library', exact: true })
  await expect(library.getByRole('checkbox')).toHaveCount(2)
  await expect(library.getByText('Automatically discovered page')).toHaveCount(0)
  await expect(library.getByText('Another journey handbook')).toHaveCount(0)
  await expect(library.getByText('Uploaded file', { exact: true })).toBeVisible()
  await expect(library.getByText('Added URL', { exact: true })).toBeVisible()
  await library.getByRole('checkbox', { name: 'Database handbook.pdf', exact: true }).check()
  await library
    .getByRole('button', { name: 'Preview Official database guide', exact: true })
    .click()
  const preview = page.getByRole('dialog', { name: 'Official database guide', exact: true })
  await expect(preview.getByText('A transaction groups database operations.')).toBeVisible()
  await expect(
    preview.getByRole('link', { name: 'https://example.org/database-guide' }),
  ).toHaveAttribute('href', 'https://example.org/database-guide')
  await preview.getByRole('button', { name: 'Close dialog', exact: true }).click()
  await expect(
    library.getByRole('checkbox', { name: 'Database handbook.pdf', exact: true }),
  ).toBeChecked()
  await library.getByRole('button', { name: 'Close dialog', exact: true }).click()
  await expect(page.getByText('No material selected', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Build My Learning Path', exact: true }).click()
  await expect(
    page.getByRole('alert').filter({ hasText: 'Test model is unavailable.' }),
  ).toBeVisible()
  expect(state.submissions).toEqual([{ input: 'Learn transactions', mode: 'goal', source_ids: [] }])
  expect(state.deletions).toEqual([])
})

test('removing selected material keeps it in the library and sends only remaining choices', async ({
  page,
}) => {
  const state = await mockSourceLibrary(page)
  await page.goto('/?screen=create')
  await page.getByLabel('Your goal').fill('Learn transactions')
  await page.getByRole('button', { name: 'Choose from source library', exact: true }).click()
  const library = page.getByRole('dialog', { name: 'Choose from source library', exact: true })
  await library.getByRole('checkbox', { name: 'Database handbook.pdf', exact: true }).check()
  await library.getByRole('checkbox', { name: 'Official database guide', exact: true }).check()
  await library.getByRole('button', { name: 'Use selected sources', exact: true }).click()
  await page.getByRole('button', { name: 'Preview Database handbook.pdf', exact: true }).click()
  const preview = page.getByRole('dialog', { name: 'Database handbook.pdf', exact: true })
  await expect(preview.getByText('A transaction groups database operations.')).toBeVisible()
  await preview.getByRole('button', { name: 'Close dialog', exact: true }).click()
  await page
    .getByRole('button', { name: 'Remove Database handbook.pdf from selection', exact: true })
    .click()
  await expect(page.getByText('Database handbook.pdf', { exact: true })).toHaveCount(0)
  await page.getByRole('button', { name: 'Choose from source library', exact: true }).click()
  await expect(
    library.getByRole('checkbox', { name: 'Database handbook.pdf', exact: true }),
  ).not.toBeChecked()
  await expect(
    library.getByRole('checkbox', { name: 'Official database guide', exact: true }),
  ).toBeChecked()
  await library.getByRole('button', { name: 'Close dialog', exact: true }).click()
  await page.getByRole('button', { name: 'Build My Learning Path', exact: true }).click()
  await expect(
    page.getByRole('alert').filter({ hasText: 'Test model is unavailable.' }),
  ).toBeVisible()
  expect(state.submissions).toEqual([
    { input: 'Learn transactions', mode: 'goal', source_ids: ['added-url'] },
  ])
  expect(state.deletions).toEqual([])
})

test('adding material selects it immediately and waits for indexing before building', async ({
  page,
}) => {
  const state = await mockSourceLibrary(page)
  await page.goto('/?screen=create')
  await page.getByLabel('Your goal').fill('Learn transactions')
  await page.getByRole('button', { name: 'Add files or URLs', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'Add learning material', exact: true })
  await dialog.getByRole('button', { name: 'Paste text', exact: true }).click()
  await dialog.getByLabel('Source title').fill('My transaction notes')
  await dialog.getByLabel('Source text').fill('A transaction groups database operations.')
  await dialog.getByRole('button', { name: 'Add Source', exact: true }).click()
  await expect(dialog).toHaveCount(0)
  await expect(page.getByText('My transaction notes', { exact: true })).toBeVisible()
  await expect(page.getByText('Pasted text', { exact: true })).toBeVisible()
  await expect(
    page.getByRole('button', { name: 'Build My Learning Path', exact: true }),
  ).toBeDisabled()
  state.addedSource()!.status = 'ready'
  state.addedSource()!.chunk_count = 1
  await expect(
    page.getByRole('button', { name: 'Build My Learning Path', exact: true }),
  ).toBeEnabled()
  await page.getByRole('button', { name: 'Build My Learning Path', exact: true }).click()
  await expect(
    page.getByRole('alert').filter({ hasText: 'Test model is unavailable.' }),
  ).toBeVisible()
  expect(state.submissions).toEqual([
    { input: 'Learn transactions', mode: 'goal', source_ids: ['new-material'] },
  ])
})

test('source management confirms permanent deletion and keeps discovered evidence identifiable', async ({
  page,
}) => {
  const state = await mockSourceLibrary(page)
  await page.goto('/?screen=sources')
  await expect(page.getByRole('heading', { name: 'Source Library', exact: true })).toBeVisible()
  await expect(page.getByText('Found by Trellis', { exact: true })).toBeVisible()
  await expect(page.getByText('Discovered on the web')).toBeVisible()
  const remove = page.getByRole('button', {
    name: 'Delete Database handbook.pdf permanently',
    exact: true,
  })
  page.once('dialog', (dialog) => dialog.dismiss())
  await remove.click()
  expect(state.deletions).toEqual([])
  await expect(
    page.getByRole('button', { name: 'Database handbook.pdf', exact: true }),
  ).toBeVisible()
  page.once('dialog', async (dialog) => {
    expect(dialog.message()).toContain('Delete this source permanently?')
    expect(dialog.message()).toContain(
      'Evidence already saved in answers and notebooks will remain.',
    )
    await dialog.accept()
  })
  await remove.click()
  await expect(
    page.getByRole('button', { name: 'Database handbook.pdf', exact: true }),
  ).toHaveCount(0)
  expect(state.deletions).toEqual(['uploaded-handbook'])
})
