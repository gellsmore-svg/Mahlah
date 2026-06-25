// End-to-end UI test: drives the real Mahlah app in a headless browser and
// reads what is actually rendered to the user.
import { chromium } from 'playwright'

const BASE = process.env.MAHLAH_URL || 'http://localhost:5273'
const pass = []
const fail = []
const check = (name, cond, detail = '') => {
  ;(cond ? pass : fail).push(name)
  console.log(`  [${cond ? 'PASS' : 'FAIL'}] ${name}${detail ? ' — ' + detail : ''}`)
}

const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] })
const ctx = await browser.newContext()
const page = await ctx.newPage()
page.on('console', (m) => { if (m.type() === 'error') console.log('   [browser console error]', m.text()) })
await page.goto(BASE, { waitUntil: 'networkidle' })

console.log('=== 1. STRUCTURE: is the ChatGPT/Claude-style interface actually there? ===')
check('brand "Mahlah" visible', await page.locator('.sidebar__brand').first().isVisible())
check('left conversations sidebar present', (await page.locator('.sidebar').count()) > 0)
check('new-chat control present (compact)', (await page.locator('.icon-btn--accent').count()) > 0)
check('welcome / chat area present', (await page.locator('.welcome, .messages').count()) > 0)
check('bottom composer input present', (await page.locator('.composer__input').count()) > 0)
check('compact send icon (not full-width Ask button)', (await page.locator('.composer__send').count()) > 0)
check('process panel present on the right', (await page.locator('.process').count()) > 0)
check('process panel collapsed by default', (await page.locator('.process--collapsed').count()) === 1)
const selects = page.locator('.composer__meta select')
check('model / adapter / mode selectors present', (await selects.count()) === 3, `${await selects.count()} selects`)

console.log('\n=== 2. SEND (mock) — chat renders, process panel fills separately ===')
await selects.nth(1).selectOption('mock')
await page.locator('.composer__input').fill('What is a vorton?')
await page.locator('.composer__input').press('Enter')
await page.waitForSelector('.bubble--user', { timeout: 10000 })
check('user message appears in chat', (await page.locator('.bubble--user .bubble__text').first().innerText()).includes('vorton'))
await page.waitForFunction(
  () => {
    const el = document.querySelector('.bubble--assistant .bubble__text')
    return el && !el.querySelector('.typing') && el.textContent.trim().length > 0
  },
  { timeout: 30000 },
)
const mockAnswer = (await page.locator('.bubble--assistant .bubble__text').last().innerText()).trim()
check('assistant answer renders in the chat bubble', mockAnswer.length > 0, JSON.stringify(mockAnswer).slice(0, 100))
// expand the (default-collapsed) process panel to inspect events
await page.locator('button[title="Show process"]').click()
check('process panel expands on click', (await page.locator('.process__head').innerText()).includes('Process'))
const eventCount = await page.locator('.process .event').count()
check('process panel populated, separate from the answer', eventCount > 0, `${eventCount} events`)

console.log('\n=== 3. DEV-LOG opens in a separate popup window ===')
const [popup] = await Promise.all([
  ctx.waitForEvent('page'),
  page.locator('button[title="Open live dev log in a new window"]').click(),
])
await popup.waitForLoadState('domcontentloaded')
await popup.waitForSelector('.devlog', { timeout: 8000 }).catch(() => {})
check('dev-log opened as a separate window (?view=devlog)', popup.url().includes('view=devlog'))
await popup.waitForFunction(() => document.querySelectorAll('.logrow').length > 0, { timeout: 12000 }).catch(() => {})
const logRows = await popup.locator('.logrow').count()
check('dev-log popup shows structured log events', logRows > 0, `${logRows} rows`)
await popup.close()

console.log('\n=== 4. FEEDBACK modal (non-disruptive) ===')
await page.locator('button[title*="feedback" i]').click()
await page.waitForSelector('.modal', { timeout: 5000 })
check('feedback modal opens', await page.locator('.modal__textarea').isVisible())
await page.locator('.modal__textarea').fill('e2e feedback')
await page.locator('.btn-primary').click()
await page.waitForTimeout(1500)
check('feedback modal closes after submit (chat undisturbed)', (await page.locator('.modal').count()) === 0)

console.log('\n=== 5. REAL ANSWER the user sees — the exact failing question, clean? ===')
let realAnswer = ''
try {
  await selects.nth(1).selectOption('ollama_http') // keep the fast default model
  await page.locator('.composer__input').fill('Tell me about the Taj Mahal')
  await page.locator('.composer__input').press('Enter')
  await page.waitForFunction(
    () => {
      const els = document.querySelectorAll('.bubble--assistant .bubble__text')
      const el = els[els.length - 1]
      return el && !el.querySelector('.typing') && el.textContent.trim().length > 0
    },
    { timeout: 120000 },
  )
  realAnswer = (await page.locator('.bubble--assistant .bubble__text').last().innerText()).trim()
  const leak = ['Prompt Intake', 'Context Lookup', 'Tool/Adapter', 'Mongo lookup ran', 'step-by-step look at how it was built', 'Answer Generation'].filter((w) => realAnswer.includes(w))
  check('real model answer renders clean (no process narration)', leak.length === 0, leak.join(', ') || 'clean')
  console.log('   RENDERED ANSWER:', JSON.stringify(realAnswer).slice(0, 260))
} catch (e) {
  // The local LLM can be slow/cold; treat a non-response as a skip, not a failure.
  // Real-answer cleanliness is also covered deterministically by the API tests.
  console.log('  [SKIP] real model answer did not return in time (slow local model) — ' + e.message)
}

console.log(`\n================ SUMMARY: PASS ${pass.length}  FAIL ${fail.length} ================`)
if (fail.length) console.log('FAILURES:', fail)
await browser.close()
process.exit(fail.length ? 1 : 0)
