const { chromium } = require('playwright');
const path = require('path');
const outDir = path.join(__dirname, '..', 'docs', 'screenshots');

(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const page = await browser.newPage({ viewport: { width: 420, height: 900 }, deviceScaleFactor: 2 });
  await page.goto('http://127.0.0.1:8081/');
  await page.waitForTimeout(2000);
  await page.getByText('Esqueci a senha').first().click();
  await page.waitForTimeout(1000);
  await page.screenshot({ path: path.join(outDir, '03_mobile_recuperacao_senha.png') });
  await browser.close();
  console.log('Recuperação de senha capturada!');
})();
