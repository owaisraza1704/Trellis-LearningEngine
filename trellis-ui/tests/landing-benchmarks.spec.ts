import { readFile } from 'node:fs/promises'
import { test, expect } from '@playwright/test'

test('homepage publishes qualified paired results and a matching download without the API', async ({
  page,
}) => {
  await page.route('**/api/**', (route) =>
    route.fulfill({ status: 503, json: { detail: 'API offline' } }),
  )
  const mutations: string[] = []
  page.on('request', (request) => {
    if (request.method() === 'POST') mutations.push(request.url())
  })
  await page.goto('/')
  await expect(page.locator('.min-h-screen').first()).toHaveCSS('opacity', '1')
  await page
    .getByRole('navigation', { name: 'Homepage navigation' })
    .getByRole('link', { name: 'Benchmarks', exact: true })
    .click()
  await expect(page).toHaveURL(/#benchmarks$/)

  const section = page.getByRole('region', { name: 'Answer quality, measured.' })
  await expect(section.getByRole('heading', { name: 'Answer quality, measured.' })).toBeInViewport()
  await expect(section.getByRole('figure')).toContainText('0.905')
  await expect(section.getByRole('figure')).toContainText('0.636')
  await expect(section.getByRole('figure')).toContainText('39 paired test responses')
  await expect(section).toContainText('9.93s')
  await expect(section).toContainText('233,680')
  await section.locator('summary').getByText('How we measured', { exact: true }).click()
  await expect(section.getByRole('heading', { name: 'What is the baseline?' })).toBeVisible()
  await expect(section).toContainText('live search and page fetching were not tested')
  await expect(section.getByRole('row', { name: 'Sourced answers 34 27' })).toBeVisible()

  const downloadEvent = page.waitForEvent('download')
  await section.getByRole('link', { name: 'Download benchmark results' }).click()
  const download = await downloadEvent
  expect(download.suggestedFilename()).toBe('trellis-v1.json')
  const result = JSON.parse(await readFile((await download.path())!, 'utf8'))
  expect(result.run.executions).toBe(192)
  expect(result.dataset.total_cases).toBe(96)
  expect(result.paired_correctness.paired_rows).toBe(39)
  expect(result.paired_correctness.trellis_score.toFixed(3)).toBe('0.905')
  expect(result.methodology.human_reviewed).toBe(false)
  expect(result.test.baseline.metrics.answer_correctness.error_rows).toBe(1)
  expect(mutations).toEqual([])
})

test('mobile navigation reaches benchmarks and still opens the workspace', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 900 })
  await page.route('**/api/workspace', (route) =>
    route.fulfill({
      json: {
        paths: [],
        location: {},
        stats: { paths: 0, nodes: 0, completed: 0, notebook_items: 0 },
      },
    }),
  )
  await page.goto('/')
  const navigation = page.getByRole('navigation', { name: 'Homepage navigation' })
  await navigation.getByRole('button', { name: 'Open navigation', exact: true }).click()
  await navigation.getByRole('link', { name: 'Benchmarks', exact: true }).click()
  await expect(
    navigation.getByRole('button', { name: 'Open navigation', exact: true }),
  ).toHaveAttribute('aria-expanded', 'false')
  const section = page.getByRole('region', { name: 'Answer quality, measured.' })
  await expect(section.getByRole('heading', { name: 'Answer quality, measured.' })).toBeInViewport()
  await section.locator('summary').click()
  await expect(section.getByRole('table')).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(375)
  await navigation.getByRole('button', { name: 'Start learning', exact: true }).click()
  await expect(page).toHaveURL(/screen=dashboard/)
  await expect(page.getByRole('heading', { name: 'Room to grow.' })).toBeVisible()
})
