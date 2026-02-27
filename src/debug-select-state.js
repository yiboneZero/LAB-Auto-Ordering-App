const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.connectOverCDP('http://localhost:9222');
  const page = browser.contexts()[0].pages()[0];

  const info = await page.evaluate(() => {
    const selects = document.querySelectorAll('select');
    const selectInfo = [];
    for (const select of selects) {
      if (select.offsetParent === null) continue;
      const label = select.closest('.avp-option')?.querySelector('.avp-option-title')?.textContent?.trim();
      selectInfo.push({
        label,
        name: select.name,
        selectedValue: select.value,
        selectedText: select.options[select.selectedIndex]?.textContent?.trim(),
        selectedIndex: select.selectedIndex,
      });
    }

    // Putter Color 존재 여부 (hidden 포함)
    const allOptions = document.querySelectorAll('.avp-option');
    const putterColorInfo = [];
    for (const opt of allOptions) {
      const title = opt.querySelector('.avp-option-title')?.textContent?.trim() || '';
      if (title.toLowerCase().includes('color') || title.toLowerCase().includes('putter')) {
        putterColorInfo.push({
          title,
          visible: opt.offsetParent !== null,
          display: window.getComputedStyle(opt).display,
          className: opt.className,
        });
      }
    }

    return { selects: selectInfo, putterColor: putterColorInfo };
  });

  console.log('=== SELECT 현재 상태 ===');
  info.selects.forEach(s => console.log(`  ${s.label}: [${s.selectedIndex}] "${s.selectedText}" (value=${s.selectedValue})`));
  console.log('\n=== Putter Color 요소 ===');
  if (info.putterColor.length === 0) {
    console.log('  Putter Color 요소가 DOM에 존재하지 않습니다');
  } else {
    console.log(JSON.stringify(info.putterColor, null, 2));
  }

  await browser.close();
})().catch(console.error);
