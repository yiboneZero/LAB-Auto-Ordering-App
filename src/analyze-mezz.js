const { initBrowser, closeBrowser } = require('./browser');
const { waitForManualLogin } = require('./login');

async function analyzeMezz() {
  console.log('='.repeat(50));
  console.log('MEZZ.1 MAX 제품 페이지 구조 분석');
  console.log('='.repeat(50));

  let page;

  try {
    page = await initBrowser();
    await waitForManualLogin(page);

    console.log('\n상품 페이지로 이동...');
    await page.goto('https://labgolf.com/products/mezz-1-max-custom', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(3000);

    // Step 1 옵션 분석
    console.log('\n=== Step 1 옵션 분석 ===\n');
    const step1Options = await page.evaluate(() => {
      const results = [];
      const optionTitles = document.querySelectorAll('.avp-option-title');
      for (const title of optionTitles) {
        const container = title.closest('.avp-option');
        if (container && container.offsetParent !== null) {
          const pillLabels = container.querySelectorAll('label.avp-pilloptioncheckwrapper');
          const values = [];
          pillLabels.forEach(label => {
            values.push(label.textContent?.trim());
          });
          if (values.length > 0) {
            results.push({
              title: title.textContent?.trim(),
              type: 'pill',
              values: values
            });
          }
        }
      }
      return results;
    });
    console.log('Step 1 Pill 옵션:');
    step1Options.forEach(opt => {
      console.log(`  ${opt.title}: [${opt.values.join(', ')}]`);
    });

    // NEXT STEP 버튼 확인
    console.log('\n[NEXT STEP 버튼 확인]');
    const nextBtn = await page.evaluate(() => {
      const elements = document.querySelectorAll('*');
      for (const el of elements) {
        if (el.textContent?.includes('NEXT STEP') && el.offsetParent !== null) {
          return { found: true, text: el.textContent?.trim().substring(0, 50) };
        }
      }
      return { found: false };
    });
    console.log(nextBtn.found ? `  버튼 발견: "${nextBtn.text}"` : '  버튼 없음');

    // Step 2로 이동 시도
    console.log('\n[Step 2로 이동 시도]');
    try {
      await page.locator('text=NEXT STEP').first().click();
      await page.waitForTimeout(2000);
      console.log('  Step 2 이동 완료');
    } catch (e) {
      console.log('  Step 2 이동 실패:', e.message);
    }

    // Step 2 옵션 분석
    console.log('\n=== Step 2 옵션 분석 ===\n');
    const step2Options = await page.evaluate(() => {
      const results = [];
      const optionTitles = document.querySelectorAll('.avp-option-title');
      for (const title of optionTitles) {
        const container = title.closest('.avp-option');
        if (container && container.offsetParent !== null) {
          const titleText = title.textContent?.trim();

          // 스와치 드롭다운 확인
          const swatchLabels = container.querySelectorAll('label.option-avis-swatch-value-label');
          if (swatchLabels.length > 0) {
            results.push({
              title: titleText,
              type: 'swatch-dropdown',
              visible: true
            });
          }

          // SELECT 드롭다운 확인
          const selects = container.querySelectorAll('select');
          selects.forEach(sel => {
            if (sel.offsetParent !== null) {
              const options = Array.from(sel.options).slice(0, 5).map(o => o.value || o.textContent?.trim());
              results.push({
                title: titleText,
                type: 'select',
                name: sel.name,
                options: options
              });
            }
          });
        }
      }
      return results;
    });
    console.log('Step 2 옵션:');
    step2Options.forEach(opt => {
      if (opt.type === 'swatch-dropdown') {
        console.log(`  ${opt.title}: [스와치 드롭다운]`);
      } else if (opt.type === 'select') {
        console.log(`  ${opt.title} (${opt.name}): [${opt.options.join(', ')}]`);
      }
    });

    // Step 3로 이동 시도
    console.log('\n[Step 3로 이동 시도]');
    try {
      await page.locator('text=NEXT STEP').first().click();
      await page.waitForTimeout(2000);
      console.log('  Step 3 이동 완료');
    } catch (e) {
      console.log('  Step 3 이동 실패:', e.message);
    }

    // Step 3 옵션 분석
    console.log('\n=== Step 3 옵션 분석 ===\n');
    const step3Options = await page.evaluate(() => {
      const results = [];
      const optionTitles = document.querySelectorAll('.avp-option-title');
      for (const title of optionTitles) {
        const container = title.closest('.avp-option');
        if (container && container.offsetParent !== null) {
          results.push(title.textContent?.trim());
        }
      }
      return results;
    });
    console.log('Step 3 보이는 옵션:');
    step3Options.forEach(opt => console.log(`  - ${opt}`));

    console.log('\n30초 대기...');
    await page.waitForTimeout(30000);

  } catch (error) {
    console.error('오류:', error.message);
  } finally {
    await closeBrowser();
  }
}

analyzeMezz();
