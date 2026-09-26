import { expect, test, type Page } from '@playwright/test'
import type { Interaction, NotebookPage } from '../src/lib/api'

const journey = {
  id: 'sidebar-journey',
  title: 'Caching fundamentals',
  description: 'Understand cache-aside.',
  progress: 0,
  node_count: 1,
  completed_count: 0,
  updated_at: '2026-09-25T10:00:00Z',
}
const node = {
  id: 'sidebar-node',
  path_id: journey.id,
  parent_id: null,
  title: 'Cache-aside',
  description: 'Read through a cache and refresh missing values.',
  position: 0,
  status: 'in_progress',
}
const longTitle = `Redis.${'ConnectionMultiplexer.'.repeat(24)}Reference`
const longLocation = `configuration/${'connection-options/'.repeat(20)}reference`
const longExcerpt = [
  'private static ConnectionMultiplexer cacheConnection =',
  `    ConnectionMultiplexer.Connect("${'redis-connection-option-'.repeat(50)}");`,
  'The application reads the cache before loading data from the database.',
].join('\n')
const answer: Interaction = {
  id: 'cache-answer',
  path_id: journey.id,
  node_id: node.id,
  thread_id: null,
  prompt: 'Explain cache hits and cache misses',
  content: 'A cache hit returns the stored value. A cache miss reads the database. [1]',
  action: 'question',
  status: 'answered',
  evidence: [
    {
      id: 'redis-passage',
      source_id: 'redis-source',
      title: longTitle,
      location: longLocation,
      kind: 'url',
      url: 'https://example.com/cache-aside',
      excerpt: longExcerpt,
    },
  ],
  evaluation: { status: 'passed', grounding: 1 },
  provider: 'fixture',
  model: 'fixture',
  created_at: journey.updated_at,
}
const notebook: NotebookPage[] = [
  {
    id: 'cache-notebook',
    path_id: journey.id,
    title: longLocation,
    position: 0,
    items: [
      {
        id: 'cache-note',
        page_id: 'cache-notebook',
        node_id: node.id,
        title: longTitle,
        content: answer.content,
        position: 0,
        created_at: journey.updated_at,
      },
    ],
  },
]

test.beforeEach(async ({ page }) => {
  // Keep resize and overflow checks independent of saved learner data and AI providers.
  await page.route('**/api/**', async (route) => {
    const url = new URL(route.request().url()).pathname
    if (url === '/api/workspace')
      return route.fulfill({
        json: {
          paths: [journey],
          location: { path_id: journey.id, node_id: node.id, thread_id: null },
          stats: { paths: 1, nodes: 1, completed: 0, notebook_items: 1 },
        },
      })
    if (url === '/api/location') return route.fulfill({ json: route.request().postDataJSON() })
    if (url === `/api/nodes/${node.id}`)
      return route.fulfill({
        json: { node, path: journey, nodes: [node], interactions: [answer], threads: [] },
      })
    if (url === '/api/notebook/pages') return route.fulfill({ json: notebook })
    return route.fulfill({ status: 404, json: { detail: `Unexpected ${url}` } })
  })
})

async function openLesson(page: Page) {
  await page.goto(`/?screen=node&path=${journey.id}&node=${node.id}`)
  await expect(page.getByRole('heading', { name: answer.prompt, exact: true })).toBeVisible()
  await page.locator('.screen-enter').evaluate(async (element) => {
    await Promise.all(element.getAnimations().map((animation) => animation.finished))
    await document.fonts.ready
  })
}

async function dragDivider(page: Page, x: number) {
  const divider = page.getByRole('separator', { name: 'Resize study panel' })
  const bounds = await divider.boundingBox()
  expect(bounds).not.toBeNull()
  const y = bounds!.y + bounds!.height / 2
  await page.mouse.move(bounds!.x + bounds!.width / 2, y)
  await page.mouse.down()
  await page.mouse.move(x, y, { steps: 12 })
  await page.mouse.up()
}

test('desktop tools resize within limits, retain width between tabs and restore on reload', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1920, height: 1000 })
  await openLesson(page)
  const tools = page.getByRole('complementary', { name: 'Study tools' })
  const width = () => tools.evaluate((element) => element.getBoundingClientRect().width)
  await expect.poll(width).toBeGreaterThanOrEqual(359)
  await expect.poll(width).toBeLessThanOrEqual(361)

  const initial = await tools.boundingBox()
  await dragDivider(page, initial!.x - 110)
  await expect.poll(width).toBeGreaterThan(450)
  const resizedWidth = await width()
  for (const tab of ['evidence', 'notebook', 'AI']) {
    await tools.getByRole('button', { name: tab, exact: true }).click()
    expect(Math.abs((await width()) - resizedWidth)).toBeLessThan(2)
  }
  await page.reload()
  await expect.poll(width).toBeGreaterThan(resizedWidth - 2)
  await expect.poll(width).toBeLessThan(resizedWidth + 2)

  await dragDivider(page, 10)
  await expect.poll(width).toBeGreaterThanOrEqual(519)
  await expect.poll(width).toBeLessThanOrEqual(521)
  await dragDivider(page, 1910)
  await expect.poll(width).toBeGreaterThanOrEqual(279)
  await expect.poll(width).toBeLessThanOrEqual(281)
})

test('keyboard resizing protects lesson width when the browser or navigation changes', async ({
  page,
}) => {
  await openLesson(page)
  const tools = page.getByRole('complementary', { name: 'Study tools' })
  const lesson = page.getByRole('region', { name: 'Lesson', exact: true })
  const divider = page.getByRole('separator', { name: 'Resize study panel' })
  const width = () => tools.evaluate((element) => element.getBoundingClientRect().width)
  const before = await width()
  await divider.focus()
  await page.keyboard.press('ArrowLeft')
  await expect.poll(width).toBeGreaterThan(before)
  await page.keyboard.press('ArrowRight')
  await expect.poll(width).toBeLessThan(before + 2)
  await page.keyboard.press('Home')
  await expect.poll(width).toBeGreaterThan(before)

  for (const viewportWidth of [1280, 1440]) {
    await page.setViewportSize({ width: viewportWidth, height: 1000 })
    await expect
      .poll(async () => {
        const lessonWidth = await lesson.evaluate(
          (element) => element.getBoundingClientRect().width,
        )
        return lessonWidth / (lessonWidth + (await width()))
      })
      .toBeGreaterThanOrEqual(0.549)
    await expect.poll(width).toBeLessThanOrEqual(521)
    await expect.poll(width).toBeGreaterThanOrEqual(279)
  }
  await page.getByRole('button', { name: 'Collapse sidebar', exact: true }).click()
  await page.getByRole('button', { name: 'Expand sidebar', exact: true }).click()
  await expect
    .poll(async () => {
      const lessonWidth = await lesson.evaluate((element) => element.getBoundingClientRect().width)
      return lessonWidth / (lessonWidth + (await width()))
    })
    .toBeGreaterThanOrEqual(0.549)
  await divider.focus()
  await page.keyboard.press('End')
  await expect.poll(width).toBeGreaterThanOrEqual(279)
  await expect.poll(width).toBeLessThanOrEqual(281)
})

test('full evidence code, long titles and notebook entries stay inside a narrow tools panel', async ({
  page,
}) => {
  await openLesson(page)
  const tools = page.getByRole('complementary', { name: 'Study tools' })
  await dragDivider(page, 1430)
  await page.getByRole('button', { name: 'View cited passage 1', exact: true }).click()
  const passage = tools.getByRole('article', { name: 'Cited passage 1' })
  await expect(passage).toBeFocused()
  await expect(passage.locator('blockquote')).toHaveText(longExcerpt)
  await expect(passage.getByRole('button', { name: 'Show less', exact: true })).toBeVisible()
  const evidenceOverflow = await passage.evaluate((element) => {
    const elements = [element, ...element.querySelectorAll('p, blockquote')]
    return elements.map((item) => item.scrollWidth - item.clientWidth)
  })
  expect(evidenceOverflow.every((overflow) => overflow <= 1)).toBe(true)
  expect(
    await tools.evaluate((element) => element.scrollWidth - element.clientWidth),
  ).toBeLessThanOrEqual(1)
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth),
  ).toBeLessThanOrEqual(1)
  await page.screenshot({
    path: test.info().outputPath('evidence-narrow-panel.png'),
    animations: 'disabled',
  })

  await tools.getByRole('button', { name: 'notebook', exact: true }).click()
  await expect(tools.getByText(longTitle, { exact: true })).toBeVisible()
  const notebookOverflow = await tools.evaluate((element) =>
    [element, ...element.querySelectorAll('button, p')].map(
      (item) => item.scrollWidth - item.clientWidth,
    ),
  )
  expect(notebookOverflow.every((overflow) => overflow <= 1)).toBe(true)
})

test('smaller screens stack the tools below the lesson and restore resizing when widened', async ({
  page,
}) => {
  await openLesson(page)
  const tools = page.getByRole('complementary', { name: 'Study tools' })
  const lesson = page.getByRole('region', { name: 'Lesson', exact: true })
  await dragDivider(page, 10)
  const preferredWidth = await tools.evaluate((element) => element.getBoundingClientRect().width)
  for (const viewportWidth of [1024, 390]) {
    await page.setViewportSize({ width: viewportWidth, height: 900 })
    await expect(page.getByRole('separator', { name: 'Resize study panel' })).toHaveCount(0)
    await expect
      .poll(() =>
        tools.evaluate((element) => {
          const toolsBounds = element.getBoundingClientRect()
          const lessonBounds = document
            .querySelector('section[aria-label="Lesson"]')!
            .getBoundingClientRect()
          return (
            toolsBounds.y >= lessonBounds.bottom - 1 &&
            Math.abs(toolsBounds.width - lessonBounds.width) < 2
          )
        }),
      )
      .toBe(true)
    await tools.getByRole('button', { name: 'evidence', exact: true }).click()
    await tools.getByRole('button', { name: 'Read full passage', exact: true }).click()
    await expect(tools.locator('blockquote')).toHaveText(longExcerpt)
    expect(
      await tools.evaluate((element) => element.scrollWidth - element.clientWidth),
    ).toBeLessThanOrEqual(1)
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth),
    ).toBeLessThanOrEqual(1)
    await tools.getByRole('button', { name: 'AI', exact: true }).click()
  }
  await page.setViewportSize({ width: 1440, height: 1000 })
  await expect(page.getByRole('separator', { name: 'Resize study panel' })).toBeVisible()
  await expect
    .poll(async () =>
      Math.abs(
        (await tools.evaluate((element) => element.getBoundingClientRect().width)) - preferredWidth,
      ),
    )
    .toBeLessThan(2)
  const toolsBounds = await tools.boundingBox()
  const lessonBounds = await lesson.boundingBox()
  expect(toolsBounds!.x).toBeGreaterThanOrEqual(lessonBounds!.x + lessonBounds!.width)
  expect(toolsBounds!.width).toBeLessThanOrEqual(521)
})
