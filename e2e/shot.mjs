import { chromium } from 'playwright'

const OUT = process.argv[2] || '/tmp/mahlah.png'
const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] })
const page = await browser.newContext({ viewport: { width: 1280, height: 800 } }).then((c) => c.newPage())
await page.goto('http://localhost:5273', { waitUntil: 'networkidle' })
// send one mock message so the chat + process panel are populated
await page.locator('.composer__meta select').nth(1).selectOption('mock')
await page.locator('.composer__input').fill('What is a vorton, and why does it stay stable?')
await page.locator('.composer__input').press('Enter')
await page
  .waitForFunction(
    () => {
      const el = document.querySelector('.bubble--assistant .bubble__text')
      return el && !el.querySelector('.typing') && el.textContent.trim().length > 0
    },
    { timeout: 30000 },
  )
  .catch(() => {})
await page.waitForTimeout(400)
await page.screenshot({ path: OUT, fullPage: false })
console.log('saved', OUT)
await browser.close()
