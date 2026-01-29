const { initBrowser, closeBrowser } = require('./browser');
const { waitForManualLogin } = require('./login');

// pill 버튼 선택 함수
async function selectPillOption(page, value) {
  return await page.evaluate((val) => {
    const labels = document.querySelectorAll('label.avp-pilloptioncheckwrapper');
    for (const label of labels) {
      const text = label.textContent?.trim();
      if (text === val) {
        const input = label.querySelector('input[type="radio"]');
        const isAlreadySelected = input?.checked || false;
        if (!isAlreadySelected) {
          label.click();
        }
        return { success: true, alreadySelected: isAlreadySelected };
      }
    }
    return { success: false };
  }, value);
}

async function analyzeRiserLie() {
  console.log('='.repeat(50));
  console.log('Riser / Lie angle 옵션 구조 분석');
  console.log('='.repeat(50));

  let page;

  try {
    page = await initBrowser();
    await waitForManualLogin(page);

    // 상품 페이지로 이동
    console.log('\n상품 페이지로 이동...');
    await page.goto('https://labgolf.com/products/oz1i-hs-custom', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(3000);

    // Step 1 빠르게 완료
    console.log('\n=== Step 1 완료 ===');
    await selectPillOption(page, 'LEFT');
    await selectPillOption(page, 'STANDARD');
    await selectPillOption(page, 'LIGHTER');
    await page.waitForTimeout(500);

    // Step 2로 이동
    await page.locator('text=NEXT STEP').first().click();
    await page.waitForTimeout(2000);
    console.log('Step 2로 이동 완료\n');

    // Riser 옵션 구조 분석
    console.log('=== Riser 옵션 분석 ===\n');
    const riserAnalysis = await page.evaluate(() => {
      const results = {
        selectElements: [],
        swatchContainers: [],
        optionTitles: []
      };

      // Riser 관련 옵션 타이틀 찾기
      const titles = document.querySelectorAll('.avp-option-title');
      for (const title of titles) {
        const text = title.textContent || '';
        if (text.includes('Riser')) {
          const container = title.closest('.avp-option');
          results.optionTitles.push({
            text: text.substring(0, 50),
            visible: container?.offsetParent !== null
          });

          if (container) {
            // 내부 select 요소 확인
            const selects = container.querySelectorAll('select');
            selects.forEach(sel => {
              results.selectElements.push({
                name: sel.name,
                id: sel.id,
                visible: sel.offsetParent !== null,
                optionCount: sel.options.length,
                options: Array.from(sel.options).slice(0, 5).map(o => o.value)
              });
            });

            // 내부 스와치 컨테이너 확인
            const swatches = container.querySelectorAll('.avis-swatch-container, label.option-avis-swatch-value-label');
            swatches.forEach(sw => {
              results.swatchContainers.push({
                tag: sw.tagName,
                class: sw.className?.substring(0, 40),
                text: sw.textContent?.trim().substring(0, 30),
                visible: sw.offsetParent !== null
              });
            });
          }
        }
      }

      return results;
    });
    console.log('Riser 분석 결과:');
    console.log(JSON.stringify(riserAnalysis, null, 2));

    // Lie angle 옵션 구조 분석
    console.log('\n=== Lie angle 옵션 분석 ===\n');
    const lieAnalysis = await page.evaluate(() => {
      const results = {
        selectElements: [],
        swatchContainers: [],
        optionTitles: []
      };

      const titles = document.querySelectorAll('.avp-option-title');
      for (const title of titles) {
        const text = title.textContent || '';
        if (text.includes('Lie angle') || text.includes('Lie Angle')) {
          const container = title.closest('.avp-option');
          results.optionTitles.push({
            text: text.substring(0, 50),
            visible: container?.offsetParent !== null
          });

          if (container) {
            const selects = container.querySelectorAll('select');
            selects.forEach(sel => {
              results.selectElements.push({
                name: sel.name,
                id: sel.id,
                visible: sel.offsetParent !== null,
                optionCount: sel.options.length,
                options: Array.from(sel.options).slice(0, 5).map(o => o.value)
              });
            });

            const swatches = container.querySelectorAll('.avis-swatch-container, label.option-avis-swatch-value-label');
            swatches.forEach(sw => {
              results.swatchContainers.push({
                tag: sw.tagName,
                class: sw.className?.substring(0, 40),
                text: sw.textContent?.trim().substring(0, 30),
                visible: sw.offsetParent !== null
              });
            });
          }
        }
      }

      return results;
    });
    console.log('Lie angle 분석 결과:');
    console.log(JSON.stringify(lieAnalysis, null, 2));

    // 페이지 내 모든 보이는 SELECT 요소 확인
    console.log('\n=== 페이지 내 모든 보이는 SELECT 요소 ===\n');
    const allSelects = await page.evaluate(() => {
      const selects = document.querySelectorAll('select');
      const results = [];
      for (const sel of selects) {
        if (sel.offsetParent !== null) {
          results.push({
            name: sel.name,
            id: sel.id,
            optionCount: sel.options.length,
            firstOptions: Array.from(sel.options).slice(0, 3).map(o => ({ value: o.value, text: o.textContent?.trim() }))
          });
        }
      }
      return results;
    });
    console.log('보이는 SELECT 요소:');
    allSelects.forEach(sel => {
      console.log(`  - name: ${sel.name}, id: ${sel.id}, options: ${sel.optionCount}`);
      sel.firstOptions.forEach(opt => console.log(`      "${opt.value}" / "${opt.text}"`));
    });

    console.log('\n30초 대기 - 브라우저에서 확인하세요...');
    await page.waitForTimeout(30000);

  } catch (error) {
    console.error('오류:', error.message);
  } finally {
    await closeBrowser();
  }
}

analyzeRiserLie();
