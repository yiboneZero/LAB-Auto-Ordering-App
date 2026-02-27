const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.connectOverCDP('http://localhost:9222');
  const page = browser.contexts()[0].pages()[0];

  console.log('현재 URL:', page.url());

  // 1. 모든 select 요소 나열 (hidden 포함)
  const allSelects = await page.evaluate(() => {
    const selects = document.querySelectorAll('select');
    return Array.from(selects).map((select, i) => {
      const label = select.closest('.avp-option')?.querySelector('.avp-option-title')?.textContent?.trim();
      const isVisible = select.offsetParent !== null;
      const opts = Array.from(select.options).map(o => ({ text: o.textContent?.trim(), value: o.value }));
      return {
        domIndex: i,
        label: label || select.name || '(no label)',
        visible: isVisible,
        selectedIndex: select.selectedIndex,
        selectedText: select.options[select.selectedIndex]?.textContent?.trim(),
        optionCount: opts.length,
        options: opts.slice(0, 5),
        id: select.id,
        name: select.name,
        className: select.className,
      };
    });
  });

  console.log('\n=== 모든 SELECT 요소 (hidden 포함) ===');
  allSelects.forEach(s => {
    const vis = s.visible ? 'VISIBLE' : 'HIDDEN';
    console.log(`  [${s.domIndex}] ${vis} "${s.label}" selected=[${s.selectedIndex}] "${s.selectedText}" (name=${s.name}, id=${s.id})`);
    s.options.forEach((o, i) => console.log(`       ${i}. "${o.text}" (value="${o.value}")`));
  });

  // 2. selectDropdown과 같은 로직으로 "2°" 찾기 시도
  const findResult = await page.evaluate(() => {
    const val = '2°';
    const selects = document.querySelectorAll('select');
    let selectIndex = 0;
    for (const select of selects) {
      if (select.offsetParent === null) { selectIndex++; continue; }
      let option = Array.from(select.options).find(opt => opt.value === val || opt.textContent?.trim() === val);
      if (!option) {
        option = Array.from(select.options).find(opt => {
          const text = opt.textContent?.trim() || '';
          const optVal = opt.value || '';
          return text.startsWith(val) || optVal.startsWith(val) || text.includes(val);
        });
      }
      if (option) {
        const label = select.closest('.avp-option')?.querySelector('.avp-option-title')?.textContent?.trim();
        return {
          found: true,
          selectIndex,
          label,
          optionValue: option.value,
          optionText: option.textContent?.trim(),
          selectName: select.name,
          selectId: select.id,
        };
      }
      selectIndex++;
    }
    return { found: false };
  });

  console.log('\n=== "2°" 검색 결과 ===');
  console.log(JSON.stringify(findResult, null, 2));

  if (findResult.found) {
    // 3. Playwright locator nth로 같은 요소인지 확인
    const locatorCheck = await page.locator('select').nth(findResult.selectIndex).evaluate(el => {
      const label = el.closest('.avp-option')?.querySelector('.avp-option-title')?.textContent?.trim();
      return {
        label,
        name: el.name,
        id: el.id,
        selectedIndex: el.selectedIndex,
        optionCount: el.options.length,
      };
    });
    console.log('\n=== page.locator("select").nth(' + findResult.selectIndex + ') 결과 ===');
    console.log(JSON.stringify(locatorCheck, null, 2));

    // 4. selectOption 시도
    console.log('\n=== selectOption 시도 ===');
    try {
      await page.locator('select').nth(findResult.selectIndex).selectOption(findResult.optionValue);
      console.log('selectOption 성공 (에러 없음)');
    } catch (e) {
      console.log('selectOption 에러:', e.message);
    }

    // 5. 선택 후 상태 확인
    const afterState = await page.evaluate((idx) => {
      const select = document.querySelectorAll('select')[idx];
      return {
        selectedIndex: select.selectedIndex,
        selectedText: select.options[select.selectedIndex]?.textContent?.trim(),
        value: select.value,
      };
    }, findResult.selectIndex);
    console.log('\n=== selectOption 후 상태 ===');
    console.log(JSON.stringify(afterState, null, 2));
  }

  await browser.close();
})().catch(console.error);
