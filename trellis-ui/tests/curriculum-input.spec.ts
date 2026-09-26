import { expect, test, type Page } from '@playwright/test'
import type { PathDetail } from '../src/lib/api'

const originalRequest = `  Learn system design for a production web application.

Phase 1: Foundations
  - HTTP, APIs and request lifecycles
  - SQL data models

Phase 2: Scaling
  - Load balancing
  - Caching and invalidation

Phase 3: Reliability
  - Queues, retries and idempotency
  - Failure recovery

Phase 4: Design practice
  - Compare the trade-offs of a URL shortener and a news feed.
Keep these phases and their subtopics. Explain <cache-aside> as literal terminology.
`

function curriculum(mode?: 'goal' | 'outline'): PathDetail {
  return {
    id: 'system-design',
    title: 'Learning System Design',
    description: 'A concise description of the learning journey.',
    input: originalRequest,
    progress: 0,
    node_count: 0,
    completed_count: 0,
    updated_at: '2026-09-26T10:00:00Z',
    nodes: [],
    generation: mode
      ? {
          mode,
          provider: 'openai',
          model: 'configured-model',
          created_at: '2026-09-26T10:00:00Z',
          evidence: [],
          evaluation: {},
        }
      : null,
  }
}

async function mockCurriculum(page: Page, path: PathDetail) {
  await page.route('**/api/**', async (route) => {
    const pathname = new URL(route.request().url()).pathname
    if (pathname === '/api/workspace')
      return route.fulfill({
        json: {
          paths: [path],
          location: { path_id: null, node_id: null, thread_id: null },
          stats: { paths: 1, nodes: 0, completed: 0, notebook_items: 0 },
        },
      })
    if (pathname === `/api/paths/${path.id}`) return route.fulfill({ json: path })
    if (pathname === '/api/sources') return route.fulfill({ json: [] })
    return route.fulfill({ status: 404, json: { detail: `Unexpected ${pathname}` } })
  })
}

for (const [mode, label] of [
  ['goal', 'Learning goal'],
  ['outline', 'Existing curriculum'],
] as const) {
  test(`${label} retains the complete original request with keyboard-accessible disclosure`, async ({
    page,
  }) => {
    await mockCurriculum(page, curriculum(mode))
    await page.goto('/?screen=graph&path=system-design')
    const original = page.getByRole('region', { name: 'Original request text', exact: true })
    await expect(original).not.toBeVisible()
    const disclosure = page.locator('summary').filter({ hasText: /^Original request$/ })
    await disclosure.focus()
    await page.keyboard.press('Space')
    await expect(original).toBeVisible()
    expect(await original.textContent()).toBe(originalRequest)
    await expect(original.locator('cache-aside')).toHaveCount(0)
    await expect(page.getByText(label, { exact: true })).toBeVisible()
    await page.getByText('Original curriculum sources and assessment', { exact: true }).click()
    await expect(
      page.getByText(
        'Recorded when this journey was created. Later edits have not been reassessed.',
        { exact: true },
      ),
    ).toBeVisible()
    await disclosure.focus()
    await page.keyboard.press('Space')
    await expect(original).not.toBeVisible()
  })
}

test('legacy journeys show their original request without inventing an input mode', async ({
  page,
}) => {
  await mockCurriculum(page, curriculum())
  await page.goto('/?screen=graph&path=system-design')
  await page.getByText('Original request', { exact: true }).click()
  expect(
    await page.getByRole('region', { name: 'Original request text', exact: true }).textContent(),
  ).toBe(originalRequest)
  await expect(page.getByText('Not recorded for this journey', { exact: true })).toBeVisible()
  await expect(page.getByRole('note', { name: 'Saved curriculum coverage' })).toHaveCount(0)
  await expect(page.getByText('Learning goal', { exact: true })).toHaveCount(0)
  await expect(page.getByText('Existing curriculum', { exact: true })).toHaveCount(0)
  await page.getByText('Original curriculum sources and assessment', { exact: true }).click()
  await expect(
    page.getByText('Source assessment not recorded for this journey.', { exact: true }),
  ).toBeVisible()
})

test('goal outlines show when detailed curriculum claims were not source verified', async ({
  page,
}) => {
  const path = curriculum('goal')
  path.generation!.evaluation = {
    status: 'plan_only',
    explanation: 'The detailed draft did not pass its source review.',
  }
  await mockCurriculum(page, path)

  await page.goto('/?screen=graph&path=system-design')

  await expect(page.getByRole('note', { name: 'Learning outline source status' })).toContainText(
    'Trellis checks evidence when you study each one.',
  )
  await page.getByText('Original curriculum sources and assessment', { exact: true }).click()
  await expect(page.getByText('plan only', { exact: true })).toBeVisible()
})

test('source roadmap imports identify their source-derived topics without invented scores', async ({
  page,
}) => {
  const path = curriculum('outline')
  path.generation!.basis = 'source_roadmap'
  path.generation!.provider = 'local'
  path.generation!.model = 'source structure'
  path.generation!.evaluation = {
    status: 'extracted',
    explanation: 'Imported 30 ordered roadmap sections from the selected article.',
  }
  await mockCurriculum(page, path)

  await page.goto('/?screen=graph&path=system-design')
  await page.getByText('Original curriculum sources and assessment', { exact: true }).click()

  await expect(page.getByText(/Imported source roadmap · local/)).toBeVisible()
  await expect(
    page.getByText('Imported 30 ordered roadmap sections from the selected article.'),
  ).toBeVisible()
  await expect(
    page.getByText('The selected source is the recorded curriculum basis.'),
  ).toBeVisible()
  await expect(page.getByText('100%', { exact: true })).toHaveCount(0)
})

test('creation explains hierarchy support in both modes and preserves text when switching', async ({
  page,
}) => {
  await mockCurriculum(page, curriculum())
  await page.goto('/?screen=create')
  await expect(
    page.getByText(
      'Start with a learning goal or an existing curriculum. Both support phases, topics and subtopics.',
      { exact: true },
    ),
  ).toBeVisible()
  const goal = page.getByRole('button', { name: 'Learning goal', exact: true })
  const outline = page.getByRole('button', { name: 'Existing curriculum', exact: true })
  await expect(goal).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByLabel('Your goal')).toHaveAccessibleDescription(
    'Trellis plans from your goal and preserves explicit topics. For a short topic with a matching roadmap source, it follows that roadmap.',
  )
  await page.getByLabel('Your goal').fill(originalRequest)
  await outline.click()
  await expect(outline).toHaveAttribute('aria-pressed', 'true')
  await expect(goal).toHaveAttribute('aria-pressed', 'false')
  await expect(page.getByLabel('Curriculum or syllabus')).toHaveAccessibleDescription(
    'Paste an outline to preserve its hierarchy, or enter a title and select one roadmap source to import its sections.',
  )
  await expect(page.getByLabel('Curriculum or syllabus')).toHaveValue(originalRequest)
})

test('failed curriculum coverage keeps the full request and selected sources for retry', async ({
  page,
}) => {
  await mockCurriculum(page, curriculum())
  await page.route('**/api/sources', (route) =>
    route.fulfill({
      json: [
        {
          id: 'design-handbook',
          path_id: null,
          title: 'System Design Handbook',
          kind: 'text',
          status: 'ready',
          chunk_count: 1,
          created_at: '2026-09-26T10:00:00Z',
        },
      ],
    }),
  )
  const detail =
    'The generated curriculum did not cover your full request or preserve its hierarchy. Missing coverage: Cache invalidation; <cache-aside>. Add relevant material or retry; no journey was created.'
  const submissions: unknown[] = []
  let finish = () => {}
  const pending = new Promise<void>((resolve) => {
    finish = resolve
  })
  await page.route('**/api/paths', async (route) => {
    submissions.push(route.request().postDataJSON())
    await pending
    return route.fulfill({ status: 502, json: { detail } })
  })
  await page.goto('/?screen=create')
  await page.getByLabel('Your goal').fill(originalRequest)
  await page.getByRole('button', { name: 'Choose from source library', exact: true }).click()
  await page.getByRole('checkbox', { name: 'System Design Handbook', exact: true }).check()
  await page.getByRole('button', { name: 'Use selected sources', exact: true }).click()
  await page.getByRole('button', { name: 'Build My Learning Path', exact: true }).click()
  try {
    await expect(page.getByRole('status')).toHaveText('Trellis is working on your learning path')
    await expect(page.getByRole('progressbar', { name: 'Building learning path' })).toBeVisible()
    await expect(page.getByText(/\d+:\d\d elapsed/)).not.toHaveText('0:00 elapsed')
    await expect(
      page.getByRole('button', { name: 'Building your learning path…', exact: true }),
    ).toBeDisabled()
  } finally {
    finish()
  }
  const error = page.getByRole('main').getByRole('alert')
  await expect(error).toHaveText(detail)
  await expect(page.getByRole('progressbar', { name: 'Building learning path' })).toHaveCount(0)
  await expect(error.locator('cache-aside')).toHaveCount(0)
  await expect(page).toHaveURL(/\?screen=create$/)
  await expect(page.getByLabel('Your goal')).toHaveValue(originalRequest)
  await expect(
    page.getByRole('button', { name: 'Remove System Design Handbook from selection', exact: true }),
  ).toBeVisible()
  await page.getByRole('button', { name: 'Build My Learning Path', exact: true }).click()
  await expect.poll(() => submissions.length).toBe(2)
  expect(submissions).toEqual(
    Array(2).fill({ input: originalRequest, mode: 'goal', source_ids: ['design-handbook'] }),
  )
  await expect(error).toHaveText(detail)
})

test('low saved completeness warns outside the assessment while retaining the original passed result', async ({
  page,
}) => {
  const path = curriculum('goal')
  path.generation!.evaluation = { completeness: 0.24, status: 'passed' }
  await mockCurriculum(page, path)
  await page.goto('/?screen=graph&path=system-design')
  const warning = page.getByRole('note', { name: 'Saved curriculum coverage' })
  await expect(warning).toContainText(
    'Some requested topics may be missing. Review the original request alongside this curriculum.',
  )
  await expect(warning).toContainText('Saved completeness assessment: 24%.')
  await expect(page.getByText('Originally recorded result:', { exact: true })).not.toBeVisible()
  await page.getByText('Original request', { exact: true }).click()
  expect(await page.getByRole('region', { name: 'Original request text' }).textContent()).toBe(
    originalRequest,
  )
  await page.getByText('Original curriculum sources and assessment', { exact: true }).click()
  await expect(page.getByText('Originally recorded result:', { exact: true })).toBeVisible()
  await expect(page.getByText('passed', { exact: true })).toBeVisible()
  await expect(warning).toBeVisible()
})

test('complete saved coverage does not invent a warning', async ({ page }) => {
  const path = curriculum('goal')
  path.generation!.evaluation = {
    completeness: 1,
    status: 'passed',
    missing_topics: [],
    hierarchy_preserved: true,
  }
  await mockCurriculum(page, path)
  await page.goto('/?screen=graph&path=system-design')
  await expect(page.getByRole('heading', { name: path.title, exact: true })).toBeVisible()
  await expect(page.getByRole('note', { name: 'Saved curriculum coverage' })).toHaveCount(0)
})

test('recorded missing topics warn even when the historical completeness score is high', async ({
  page,
}) => {
  const path = curriculum('goal')
  path.generation!.evaluation = {
    completeness: 1,
    status: 'passed',
    missing_topics: ['Cache invalidation'],
  }
  await mockCurriculum(page, path)
  await page.goto('/?screen=graph&path=system-design')
  await expect(page.getByRole('note', { name: 'Saved curriculum coverage' })).toContainText(
    'Some requested topics may be missing.',
  )
})

test('recorded hierarchy loss warns without inventing a completeness percentage', async ({
  page,
}) => {
  const path = curriculum('goal')
  path.generation!.evaluation = { hierarchy_preserved: false, status: 'passed' }
  await mockCurriculum(page, path)
  await page.goto('/?screen=graph&path=system-design')
  const warning = page.getByRole('note', { name: 'Saved curriculum coverage' })
  await expect(warning).toContainText('Some requested topics may be missing.')
  await expect(warning).not.toContainText('Saved completeness assessment:')
})
