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

async function analyzeShaft() {
  console.log('='.repeat(50));
  console.log('Step 2 Shaft 드롭다운 분석 및 선택');
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

    // Shaft 드롭다운 찾기
    console.log('=== Shaft 드롭다운 분석 ===\n');

    // "Select Shaft" 또는 Shaft 관련 드롭다운 트리거 찾기
    const dropdownTriggers = await page.evaluate(() => {
      const results = [];
      // 모든 요소에서 "Select Shaft" 텍스트 찾기
      const allElements = document.querySelectorAll('*');
      for (const el of allElements) {
        const text = el.textContent?.trim();
        if (text === 'Select Shaft' || (text && text.includes('Select') && el.closest('.avp-option')?.textContent?.includes('Shaft*'))) {
          results.push({
            tag: el.tagName,
            class: el.className?.substring(0, 50),
            text: text.substring(0, 30),
            visible: el.offsetParent !== null
          });
        }
      }
      return results.slice(0, 10);
    });
    console.log('Select Shaft 트리거 요소:');
    dropdownTriggers.forEach(t => console.log(`  ${t.tag} | "${t.text}" | visible: ${t.visible}`));

    // Shaft 옵션 컨테이너 구조 분석
    const shaftContainer = await page.evaluate(() => {
      const titles = document.querySelectorAll('.avp-option-title');
      for (const title of titles) {
        if (title.textContent?.includes('Shaft*') && !title.textContent?.includes('length') && !title.textContent?.includes('lean')) {
          const container = title.closest('.avp-option');
          if (container && container.offsetParent !== null) {
            // 클릭 가능한 요소 찾기
            const clickables = container.querySelectorAll('label, div[class*="select"], span[class*="select"], .avis-swatch-container');
            return {
              found: true,
              containerClass: container.className,
              clickableElements: Array.from(clickables).slice(0, 5).map(c => ({
                tag: c.tagName,
                class: c.className?.substring(0, 40),
                text: c.textContent?.trim().substring(0, 30)
              }))
            };
          }
        }
      }
      return { found: false };
    });
    console.log('\nShaft 컨테이너 구조:');
    console.log(JSON.stringify(shaftContainer, null, 2));

    // "Select Shaft" label 클릭 시도
    console.log('\n[Select Shaft 클릭 시도]');
    const clickResult = await page.evaluate(() => {
      const labels = document.querySelectorAll('label.option-avis-swatch-value-label');
      for (const label of labels) {
        if (label.textContent?.trim() === 'Select Shaft') {
          label.click();
          return { clicked: true, text: label.textContent?.trim() };
        }
      }
      // 다른 방법 시도 - Shaft 옵션 영역에서 첫번째 label 클릭
      const titles = document.querySelectorAll('.avp-option-title');
      for (const title of titles) {
        if (title.textContent?.includes('Shaft*') && !title.textContent?.includes('length')) {
          const container = title.closest('.avp-option');
          const firstLabel = container?.querySelector('label');
          if (firstLabel) {
            firstLabel.click();
            return { clicked: true, text: 'first label in Shaft container' };
          }
        }
      }
      return { clicked: false };
    });
    console.log(clickResult.clicked ? `  ✓ 클릭: ${clickResult.text}` : '  ✗ 클릭 실패');

    await page.waitForTimeout(1000);

    // 드롭다운 열린 후 옵션 확인
    console.log('\n[드롭다운 열린 후 보이는 옵션들]');
    const visibleOptions = await page.evaluate(() => {
      const labels = document.querySelectorAll('label.option-avis-swatch-value-label');
      const results = [];
      for (const label of labels) {
        if (label.offsetParent !== null) {
          results.push(label.textContent?.trim().substring(0, 50));
        }
      }
      return results;
    });
    console.log('보이는 옵션들:');
    visibleOptions.forEach(o => console.log(`  - "${o}"`));

    console.log('\n60초 대기 - 브라우저에서 확인하세요...');
    await page.waitForTimeout(60000);

  } catch (error) {
    console.error('오류:', error.message);
  } finally {
    await closeBrowser();
  }
}

analyzeShaft();
