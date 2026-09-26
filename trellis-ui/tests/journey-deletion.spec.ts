import { expect, test } from '@playwright/test'

const journeys = [
  {
    id: 'python',
    title: 'Python foundations',
    description: 'Learn Python',
    progress: 20,
    node_count: 5,
    completed_count: 1,
    updated_at: '2026-09-26T10:00:00Z',
    resume: null,
    last_studied_at: null,
    notebook_item_count: 2,
    notebook_updated_at: null,
  },
  {
    id: 'sql',
    title: 'SQL foundations',
    description: 'Learn SQL',
    progress: 0,
    node_count: 3,
    completed_count: 0,
    updated_at: '2026-09-25T10:00:00Z',
    resume: null,
    last_studied_at: null,
    notebook_item_count: 0,
    notebook_updated_at: null,
  },
]

test('journey deletion confirms the scope, handles failure, and updates collections', async ({
  page,
}) => {
  let saved = [...journeys]
  let deleteCalls = 0
  let failNext = true
  await page.route('**/api/**', (route) => {
    const url = new URL(route.request().url())
    if (url.pathname === '/api/workspace')
      return route.fulfill({
        json: {
          paths: saved,
          location: { path_id: null, node_id: null, thread_id: null },
          stats: { paths: saved.length, nodes: 8, completed: 1, notebook_items: 2 },
        },
      })
    if (url.pathname === '/api/paths/python' && route.request().method() === 'DELETE') {
      deleteCalls += 1
      if (failNext) {
        failNext = false
        return route.fulfill({ status: 500, json: { detail: 'Could not delete this journey.' } })
      }
      saved = saved.filter((journey) => journey.id !== 'python')
      return route.fulfill({ status: 204, body: '' })
    }
    return route.fulfill({ status: 404, json: { detail: 'Unexpected request.' } })
  })

  await page.goto('/?screen=journeys')
  const python = page.getByRole('article', { name: 'Python foundations' })
  const deleteButton = python.getByRole('button', { name: 'Delete journey Python foundations' })
  await expect(deleteButton).toBeVisible()

  page.once('dialog', async (dialog) => {
    expect(dialog.message()).toContain('notebook, and PDF exports will be removed')
    expect(dialog.message()).toContain('Sources you added will return to your source library')
    await dialog.dismiss()
  })
  await deleteButton.click()
  expect(deleteCalls).toBe(0)
  await expect(python).toBeVisible()

  page.once('dialog', (dialog) => dialog.accept())
  await deleteButton.click()
  await expect(page.getByRole('main').getByRole('alert')).toContainText(
    'Could not delete this journey.',
  )
  await expect(python).toBeVisible()

  page.once('dialog', (dialog) => dialog.accept())
  await deleteButton.click()
  await expect(python).toHaveCount(0)
  await expect(page.getByRole('article', { name: 'SQL foundations' })).toBeVisible()
  expect(deleteCalls).toBe(2)

  await page
    .getByRole('navigation', { name: 'Main navigation' })
    .getByRole('button', { name: 'Notebooks' })
    .click()
  await expect(page.getByRole('article', { name: 'Python foundations' })).toHaveCount(0)
  await expect(page.getByRole('article', { name: 'SQL foundations' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Delete journey SQL foundations' })).toHaveCount(0)
})
