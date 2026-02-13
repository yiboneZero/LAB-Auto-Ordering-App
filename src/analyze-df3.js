const { initBrowser, closeBrowser } = require('./browser');

async function analyzeDF3() {
  console.log('='.repeat(50));
  console.log('DF3 제품 옵션 분석');
  console.log('='.repeat(50));

  let page;

  try {
    page = await initBrowser();

    // DF3 페이지로 이동
    console.log('\nDF3 페이지로 이동...');
    await page.goto('https://labgolf.com/products/df3-custom', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(3000);

    // Step 이름들 찾기
    console.log('\n=== Step 구조 분석 ===');
    const steps = await page.evaluate(() => {
      const stepElements = document.querySelectorAll('.avp-step-title, [class*="step"]');
      const results = [];
      stepElements.forEach(el => {
        const text = el.textContent?.trim();
        if (text && text.length < 50) {
          results.push(text);
        }
      });
      return [...new Set(results)];
    });
    console.log('Steps:', steps);

    // 모든 옵션 라벨 찾기
    console.log('\n=== 옵션 라벨 분석 ===');
    const labels = await page.evaluate(() => {
      const labelElements = document.querySelectorAll('.avp-option-title, .option-title, label');
      const results = [];
      labelElements.forEach(el => {
        const text = el.textContent?.trim();
        if (text && text.length < 100 && !text.includes('$')) {
          results.push(text);
        }
      });
      return [...new Set(results)].slice(0, 30);
    });
    console.log('Labels:', labels);

    // Pill 버튼 옵션 찾기
    console.log('\n=== Pill 버튼 옵션 ===');
    const pillOptions = await page.evaluate(() => {
      const pills = document.querySelectorAll('label.avp-pilloptioncheckwrapper, .pill-option');
      const results = [];
      pills.forEach(el => {
        const text = el.textContent?.trim();
        if (text) results.push(text);
      });
      return results;
    });
    console.log('Pills:', pillOptions);

    // Select 드롭다운 찾기
    console.log('\n=== Select 드롭다운 ===');
    const selects = await page.evaluate(() => {
      const selectElements = document.querySelectorAll('select');
      const results = [];
      selectElements.forEach(sel => {
        if (sel.offsetParent === null) return;
        const options = Array.from(sel.options).map(opt => opt.text || opt.value).slice(0, 10);
        results.push({
          name: sel.name || sel.id || 'unnamed',
          options: options
        });
      });
      return results;
    });
    console.log('Selects:', JSON.stringify(selects, null, 2));

    // Swatch 옵션 찾기
    console.log('\n=== Swatch 옵션 ===');
    const swatches = await page.evaluate(() => {
      const swatchLabels = document.querySelectorAll('label.option-avis-swatch-value-label');
      const results = [];
      swatchLabels.forEach(el => {
        if (el.offsetParent === null) return;
        const text = el.textContent?.trim();
        if (text) results.push(text);
      });
      return results.slice(0, 20);
    });
    console.log('Swatches:', swatches);

    // 각 Step을 클릭하면서 옵션 분석
    console.log('\n=== Step별 세부 분석 ===');

    // NEXT STEP 버튼들 찾기
    const nextButtons = await page.locator('text=NEXT STEP').count();
    console.log(`NEXT STEP 버튼 수: ${nextButtons}`);

    // Step 1에서 기본 선택 후 Step 2로
    console.log('\n[Step 1 옵션 선택 중...]');
    await page.evaluate(() => {
      const pills = document.querySelectorAll('label.avp-pilloptioncheckwrapper');
      if (pills.length > 0) pills[0].click(); // 첫 번째 옵션 선택
    });
    await page.waitForTimeout(1000);

    // NEXT STEP 클릭
    try {
      await page.locator('text=NEXT STEP').first().click();
      await page.waitForTimeout(2000);
      console.log('Step 2로 이동');

      // Step 2 옵션 분석
      const step2Options = await page.evaluate(() => {
        const pills = document.querySelectorAll('label.avp-pilloptioncheckwrapper');
        const selects = document.querySelectorAll('select');
        const swatches = document.querySelectorAll('label.option-avis-swatch-value-label');

        return {
          pills: Array.from(pills).filter(p => p.offsetParent).map(p => p.textContent?.trim()).slice(0, 10),
          selects: Array.from(selects).filter(s => s.offsetParent).map(s => ({
            name: s.name || s.id,
            options: Array.from(s.options).map(o => o.text).slice(0, 5)
          })),
          swatches: Array.from(swatches).filter(s => s.offsetParent).map(s => s.textContent?.trim()).slice(0, 10)
        };
      });
      console.log('Step 2 옵션:', JSON.stringify(step2Options, null, 2));

      // Step 2 기본 선택 후 Step 3로
      await page.evaluate(() => {
        const pills = document.querySelectorAll('label.avp-pilloptioncheckwrapper');
        pills.forEach(p => {
          if (p.offsetParent && p.textContent?.includes('STANDARD')) p.click();
        });
      });
      await page.waitForTimeout(1000);

      // NEXT STEP 클릭
      await page.locator('text=NEXT STEP').first().click();
      await page.waitForTimeout(2000);
      console.log('Step 3로 이동');

      // Step 3 옵션 분석
      const step3Options = await page.evaluate(() => {
        const pills = document.querySelectorAll('label.avp-pilloptioncheckwrapper');
        const selects = document.querySelectorAll('select');
        const swatches = document.querySelectorAll('label.option-avis-swatch-value-label');
        const colorSwatches = document.querySelectorAll('.color-swatch, [class*="color"]');

        return {
          pills: Array.from(pills).filter(p => p.offsetParent).map(p => p.textContent?.trim()).slice(0, 10),
          selects: Array.from(selects).filter(s => s.offsetParent).map(s => ({
            name: s.name || s.id,
            options: Array.from(s.options).map(o => o.text).slice(0, 10)
          })),
          swatches: Array.from(swatches).filter(s => s.offsetParent).map(s => s.textContent?.trim()).slice(0, 15),
          colorCount: colorSwatches.length
        };
      });
      console.log('Step 3 옵션:', JSON.stringify(step3Options, null, 2));

    } catch (e) {
      console.log('Step 이동 오류:', e.message);
    }

    console.log('\n분석 완료. 60초 대기...');
    await page.waitForTimeout(60000);

  } catch (error) {
    console.error('오류:', error.message);
  } finally {
    await closeBrowser();
  }
}

analyzeDF3();
