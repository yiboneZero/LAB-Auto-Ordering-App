const { initBrowser, closeBrowser } = require('./browser');

async function checkShaft() {
  let page;
  try {
    page = await initBrowser();
    await page.goto('https://labgolf.com/products/oz1i-hs-custom', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(5000);

    const shaftOptions = await page.$$eval('input[name="Shaft"]', els =>
      els.map(el => ({ value: el.value, id: el.id }))
    );
    console.log('Shaft 옵션들:');
    shaftOptions.forEach(s => console.log(`  value: "${s.value}"`));

    await page.waitForTimeout(5000);
  } finally {
    await closeBrowser();
  }
}

checkShaft();
