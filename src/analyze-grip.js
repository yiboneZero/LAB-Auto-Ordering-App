const { initBrowser, closeBrowser } = require('./browser');
const { waitForManualLogin } = require('./login');

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

async function selectSwatchDropdown(page, optionTitle, value) {
  const openResult = await page.evaluate((title) => {
    const titles = document.querySelectorAll('.avp-option-title');
    for (const titleEl of titles) {
      const titleText = titleEl.textContent || '';
      if (titleText.includes(title + '*') || titleText.includes(title + ' *')) {
        const container = titleEl.closest('.avp-option');
        if (container && container.offsetParent !== null) {
          const selectLabel = container.querySelector('label.option-avis-swatch-value-label');
          if (selectLabel) {
            selectLabel.click();
            return { success: true, opened: true };
          }
        }
      }
    }
    return { success: false };
  }, optionTitle);

  if (!openResult.success) return { success: false };
  await page.waitForTimeout(500);

  const selectResult = await page.evaluate((val) => {
    const labels = document.querySelectorAll('label.option-avis-swatch-value-label');
    for (const label of labels) {
      if (label.offsetParent === null) continue;
      const text = label.textContent?.trim() || '';
      if (text.includes(val)) {
        label.click();
        return { success: true, selected: text };
      }
    }
    return { success: false };
  }, value);

  return selectResult;
}

async function selectDropdown(page, value) {
  return await page.evaluate((val) => {
    const selects = document.querySelectorAll('select');
    for (const select of selects) {
      if (select.offsetParent === null) continue;
      const hasOption = Array.from(select.options).some(opt => opt.value === val || opt.textContent?.trim() === val);
      if (hasOption) {
        const optionByValue = Array.from(select.options).find(opt => opt.value === val);
        if (optionByValue) {
          select.value = optionByValue.value;
        } else {
          const optionByText = Array.from(select.options).find(opt => opt.textContent?.trim() === val);
          if (optionByText) {
            select.value = optionByText.value;
          }
        }
        select.dispatchEvent(new Event('change', { bubbles: true }));
        return { success: true };
      }
    }
    return { success: false };
  }, value);
}

async function analyzeGrip() {
  console.log('='.repeat(50));
  console.log('Grip Selection 구조 분석');
  console.log('='.repeat(50));

  let page;

  try {
    page = await initBrowser();
    await waitForManualLogin(page);

    console.log('\n상품 페이지로 이동...');
    await page.goto('https://labgolf.com/products/oz1i-hs-custom', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(3000);

    // Step 1
    await selectPillOption(page, 'LEFT');
    await selectPillOption(page, 'STANDARD');
    await selectPillOption(page, 'LIGHTER');
    await page.waitForTimeout(500);

    // Step 2로 이동
    await page.locator('text=NEXT STEP').first().click();
    await page.waitForTimeout(2000);

    // 순차 선택
    await selectSwatchDropdown(page, 'Shaft', 'Diamana Matte');
    await page.waitForTimeout(1000);
    await selectDropdown(page, '34"');
    await page.waitForTimeout(1000);
    await selectDropdown(page, '0°');
    await page.waitForTimeout(1000);

    console.log('\n=== Grip Selection 구조 분석 ===\n');

    const gripAnalysis = await page.evaluate(() => {
      const results = {
        optionTitle: null,
        containerVisible: false,
        swatchLabels: [],
        selectElements: [],
        allChildElements: []
      };

      const titles = document.querySelectorAll('.avp-option-title');
      for (const title of titles) {
        const text = title.textContent || '';
        if (text.includes('Grip')) {
          results.optionTitle = text.substring(0, 50);
          const container = title.closest('.avp-option');
          if (container) {
            results.containerVisible = container.offsetParent !== null;

            // 스와치 라벨 찾기
            const swatchLabels = container.querySelectorAll('label.option-avis-swatch-value-label');
            swatchLabels.forEach(label => {
              results.swatchLabels.push({
                text: label.textContent?.trim().substring(0, 40),
                visible: label.offsetParent !== null
              });
            });

            // SELECT 요소 찾기
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

            // 모든 클릭 가능한 요소
            const clickables = container.querySelectorAll('label, input, button, div[class*="swatch"]');
            clickables.forEach(el => {
              if (el.offsetParent !== null) {
                results.allChildElements.push({
                  tag: el.tagName,
                  class: el.className?.substring(0, 50),
                  text: el.textContent?.trim().substring(0, 30)
                });
              }
            });
          }
        }
      }

      return results;
    });

    console.log('Grip Selection 분석 결과:');
    console.log(JSON.stringify(gripAnalysis, null, 2));

    // 드롭다운 열어보기
    console.log('\n[Grip 드롭다운 열기 시도]');
    const openResult = await page.evaluate(() => {
      const titles = document.querySelectorAll('.avp-option-title');
      for (const title of titles) {
        if (title.textContent?.includes('Grip')) {
          const container = title.closest('.avp-option');
          if (container && container.offsetParent !== null) {
            const label = container.querySelector('label.option-avis-swatch-value-label');
            if (label) {
              label.click();
              return { clicked: true, labelText: label.textContent?.trim() };
            }
          }
        }
      }
      return { clicked: false };
    });
    console.log(openResult.clicked ? `  클릭: "${openResult.labelText}"` : '  클릭 실패');

    await page.waitForTimeout(1000);

    // 열린 후 옵션 확인
    console.log('\n[드롭다운 열린 후 보이는 옵션들]');
    const visibleLabels = await page.evaluate(() => {
      const labels = document.querySelectorAll('label.option-avis-swatch-value-label');
      const results = [];
      for (const label of labels) {
        if (label.offsetParent !== null) {
          results.push(label.textContent?.trim().substring(0, 50));
        }
      }
      return results;
    });
    visibleLabels.forEach(l => console.log(`  - "${l}"`));

    console.log('\n30초 대기...');
    await page.waitForTimeout(30000);

  } catch (error) {
    console.error('오류:', error.message);
  } finally {
    await closeBrowser();
  }
}

analyzeGrip();
