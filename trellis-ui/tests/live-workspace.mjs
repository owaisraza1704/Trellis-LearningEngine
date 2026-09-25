import { chromium, expect } from '@playwright/test'
import { readFile, writeFile, mkdir } from 'node:fs/promises'

const record = JSON.parse(await readFile('../.data/verification/live-api.json', 'utf8'))
const baseURL = process.env.TRELLIS_UI_URL || 'http://127.0.0.1:3100'
const browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL, headless: true })
const page = await browser.newPage({
  viewport: { width: 1440, height: 1000 },
  acceptDownloads: true,
})
const errors = []
page.on('pageerror', (error) => errors.push(error.message))
const report = { scenarios: [], pageErrors: errors }
const sidebar = page.locator('.workspace-sidebar')
const noteTitle = `Browser practice ${Date.now()}`
const sourceTitle = `Python list reference ${Date.now()}`
const nodeURL = `/?screen=node&path=${record.path_id}&node=${record.node_id}`
async function completed(name) {
  report.scenarios.push(name)
  console.log(name)
}
async function screenshot(path) {
  await page.evaluate(() => document.fonts.ready)
  await page.locator('main').evaluate((element) => {
    element.scrollTop = 0
  })
  await page.screenshot({ path, animations: 'disabled' })
}
try {
  await page.goto(baseURL + nodeURL)
  await page.getByLabel('Ask about this topic').waitFor()
  const initialPrompt = 'Explain list.append and list.pop from the supplied documentation.'
  if (
    (await page
      .getByRole('button', {
        name: 'According to the supplied Python documentation, what does list.pop() return?',
        exact: true,
      })
      .count()) === 0
  ) {
    await page
      .getByLabel('Ask about this topic')
      .fill('According to the supplied Python documentation, what does list.pop() return?')
    await page.getByRole('button', { name: 'Ask Trellis', exact: true }).click()
  } else {
    await page
      .getByRole('button', {
        name: 'According to the supplied Python documentation, what does list.pop() return?',
        exact: true,
      })
      .last()
      .click()
  }
  await expect(page.locator('article h2')).toHaveText(
    'According to the supplied Python documentation, what does list.pop() return?',
    { timeout: 180_000 },
  )
  await page.getByRole('button', { name: initialPrompt, exact: true }).first().click()
  await page.getByRole('button', { name: '↗ Tuple comparison open' }).first().click()
  await expect(page.getByRole('heading', { name: 'Tuple comparison', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Close thread', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Reopen thread' })).toBeVisible()
  await expect(page.getByLabel('Ask about this topic')).toBeDisabled()
  await page.getByRole('button', { name: 'Reopen thread' }).click()
  await expect(page.getByLabel('Ask about this topic')).toBeEnabled()
  await page.getByRole('button', { name: 'Return to Learning Node' }).click()
  await expect(page.locator('article h2')).toHaveText(initialPrompt)
  await page.reload()
  await expect(page.locator('article h2')).toHaveText(initialPrompt)
  await page.getByLabel('Learning progress').selectOption('in_progress')
  await expect(page.getByLabel('Learning progress')).toHaveValue('in_progress')
  await page.getByRole('button', { name: 'Mark complete', exact: true }).click()
  await expect(page.getByLabel('Learning progress')).toHaveValue('completed')
  await completed(
    'Live Azure question, prior-response restore, thread close/reopen and persisted progress',
  )

  await page.getByRole('button', { name: 'Save to Notebook', exact: true }).click()
  await page.getByRole('dialog').getByLabel('Note title').fill(noteTitle)
  await page
    .getByRole('dialog')
    .getByRole('button', { name: 'Create section', exact: true })
    .click()
  await page.getByRole('dialog').getByLabel('New section title').fill(`Saved ${noteTitle}`)
  await page
    .getByRole('dialog')
    .getByRole('button', { name: 'Save to Notebook', exact: true })
    .click()
  await expect(page.getByText('Saved to Notebook', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'evidence', exact: true }).click()
  await expect(page.getByText(/^\[1\]/).first()).toBeVisible()
  await screenshot('../docs/assets/trellis-learning-workspace.png')
  await sidebar.getByRole('button', { name: 'Notebook', exact: true }).click()
  await page.getByText(noteTitle, { exact: true }).click()
  await page.getByRole('button', { name: 'Edit selected note' }).click()
  await page
    .getByLabel('Content · Markdown supported')
    .fill(
      'Browser-verified personal revision.\n\nThe original response and sources remain attached.',
    )
  await page.getByRole('button', { name: 'Save note', exact: true }).click()
  await expect(page.getByText('Browser-verified personal revision.', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'New section', exact: true }).click()
  await page.getByLabel('Section title', { exact: true }).fill(`Review ${noteTitle}`)
  await page.getByRole('button', { name: 'Save section', exact: true }).click()
  await page.getByRole('button', { name: /^All notes/ }).click()
  await page.getByText(noteTitle, { exact: true }).first().click()
  const movePage = page.getByLabel('Notebook section', { exact: true })
  await movePage.selectOption({ label: `Review ${noteTitle}` })
  await expect(movePage.locator('option:checked')).toHaveText(`Review ${noteTitle}`)
  await completed('Saved actual response, edited content and moved notebook item to a new section')

  await page.getByRole('link', { name: 'Study & export' }).click()
  await page.getByRole('button', { name: 'New study selection' }).click()
  await page.getByLabel('Selection title').fill(`Study ${noteTitle}`)
  await page.getByRole('button', { name: 'Create selection' }).click()
  await page.getByRole('checkbox', { name: new RegExp(noteTitle) }).click()
  await expect(page.getByRole('checkbox', { name: new RegExp(noteTitle) })).toBeChecked()
  await expect(page.getByText('Selection saved locally', { exact: true })).toBeVisible()
  await page.reload()
  await page
    .getByLabel('Study selection', { exact: true })
    .selectOption({ label: `Study ${noteTitle}` })
  await expect(page.getByRole('checkbox', { name: new RegExp(noteTitle) })).toBeChecked()
  await page.getByRole('button', { name: 'Export PDF', exact: true }).click()
  const link = page.getByRole('link', { name: 'Download prepared PDF' })
  await expect(link).toBeVisible({ timeout: 30_000 })
  const downloadPromise = page.waitForEvent('download')
  await link.click()
  const download = await downloadPromise
  await download.saveAs('../.data/verification/browser-export.pdf')
  const pdf = await readFile('../.data/verification/browser-export.pdf')
  expect(pdf.subarray(0, 5).toString()).toBe('%PDF-')
  await completed('Study selection survives reload and actual PDF downloads successfully')

  await sidebar.getByRole('button', { name: 'Sources', exact: true }).click()
  await page.locator('main article').first().getByRole('button').first().click()
  await expect(page.getByRole('dialog')).toContainText('append')
  await page.getByRole('button', { name: 'Close dialog' }).click()
  await sidebar.getByRole('button', { name: 'Settings', exact: true }).click()
  await expect(page.getByLabel('Provider')).toHaveValue('azure')
  const options = await page.getByLabel('Provider').locator('option').allTextContents()
  expect(options.join(' ')).toMatch(/OpenAI/)
  expect(options.join(' ')).toMatch(/OpenRouter/)
  expect(options.join(' ')).toMatch(/Ollama/)
  await completed('Source passages readable and all four provider options available')

  await sidebar.getByRole('button', { name: 'New Journey', exact: true }).click()
  await page.getByRole('button', { name: 'Existing curriculum', exact: true }).click()
  await page
    .getByLabel('Curriculum or syllabus')
    .fill('Python lists\n  Appending values\n  Removing the final value with pop')
  await page.getByRole('button', { name: 'Add Source', exact: true }).click()
  await page.getByRole('button', { name: 'Paste text', exact: true }).click()
  await page.getByLabel('Source title').fill(sourceTitle)
  await page
    .getByLabel('Source text')
    .fill(
      'Python lists are mutable sequences. list.append(value) adds a value to the end of a list and returns None. list.pop(index=-1) removes the item at the given position and returns that item. If no index is supplied, pop removes and returns the last item. pop raises IndexError if the list is empty or the index is outside the valid range. These operations support last-in, first-out stacks. A list may be created using square brackets, for example values = [1, 2]. After values.append(3), values is [1, 2, 3]. Calling values.pop() returns 3 and leaves [1, 2]. Source: Python documentation, Data Structures, More on Lists.',
    )
  await page.getByRole('dialog').getByRole('button', { name: 'Add Source', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Build My Learning Path' })).toBeEnabled({
    timeout: 120_000,
  })
  await page.getByRole('button', { name: 'Build My Learning Path' }).click()
  await expect(page.getByRole('button', { name: 'Edit journey', exact: true })).toBeVisible({
    timeout: 180_000,
  })
  await screenshot('../.data/verification/browser-graph.png')
  await page.getByRole('button', { name: 'Outline', exact: true }).click()
  await page.getByRole('button', { name: 'Add Topic', exact: true }).click()
  await page.getByLabel('Title', { exact: true }).fill('Practice with a short list')
  await page.getByLabel('What this topic covers').fill('Use append and pop on a short list.')
  await page.getByRole('dialog').getByRole('button', { name: 'Add Topic', exact: true }).click()
  await expect(
    page.getByRole('button', { name: 'Edit Practice with a short list', exact: true }),
  ).toBeVisible()
  await completed(
    'Real pasted-source outline creates a curriculum; added topic persists in the outline',
  )

  await page.goto(baseURL + nodeURL)
  await page.getByLabel('Ask about this topic').waitFor()
  await page.setViewportSize({ width: 1024, height: 900 })
  await expect(page.getByLabel('Ask about this topic')).toBeVisible()
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)
  expect(overflow).toBe(false)
  await screenshot('../.data/verification/browser-laptop.png')
  await completed('1024px laptop layout has no horizontal overflow')
  expect(errors).toEqual([])
  report.result = 'passed'
} catch (error) {
  report.result = 'failed'
  report.error = String(error)
  await page.screenshot({
    path: '../.data/verification/browser-failure.png',
    animations: 'disabled',
  })
  throw error
} finally {
  await writeFile('../.data/verification/live-browser.json', JSON.stringify(report, null, 2))
  await browser.close()
}
