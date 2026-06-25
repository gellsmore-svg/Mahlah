// Generic screenshot of a URL (optionally click the first .session).
import { chromium } from 'playwright'

const URL = process.env.URL || 'http://localhost:5274'
const OUT = process.argv[2] || '/tmp/shot.png'
const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] })
const page = await browser.newContext({ viewport: { width: 1280, height: 800 } }).then((c) => c.newPage())
await page.goto(URL, { waitUntil: 'networkidle' })
const first = page.locator('.session').first()
if ((await first.count()) > 0) {
  await first.click()
  await page.waitForTimeout(700)
}
await page.screenshot({ path: OUT })
console.log('saved', OUT, '| sessions:', await page.locator('.session').count(), '| logrows:', await page.locator('.logrow').count())
await browser.close()
