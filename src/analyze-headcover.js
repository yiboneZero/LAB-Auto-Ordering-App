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
        if (!isAlreadySelected) label.click();
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
      if (titleText.toLowerCase().includes(title.toLowerCase())) {
        const container = titleEl.closest('.avp-option');
        if (container && container.offsetParent !== null) {
          const selectLabel = container.querySelector('label.option-avis-swatch-value-label');
          if (selectLabel) {
            selectLabel.click();
            return { success: true };
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
    const keywords = val.replace(/[()]/g, ' ').split(/[\s,.-]+/).filter(k => k.length > 2);
    for (const label of labels) {
      if (label.offsetParent === null) continue;
      const text = label.textContent?.trim() || '';
      if (text.includes(val)) {
        label.click();
        return { success: true, selected: text };
      }
      const textLower = text.toLowerCase();
      const allKeywordsMatch = keywords.every(k => textLower.includes(k.toLowerCase()));
      if (allKeywordsMatch && keywords.length >= 2) {
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
      const option = Array.from(select.options).find(opt => opt.value === val || opt.textContent?.trim() === val);
      if (option) {
        select.value = option.value;
        select.dispatchEvent(new Event('change', { bubbles: true }));
        return { success: true };
      }
    }
    return { success: false };
  }, value);
}

async function selectColorSwatch(page, optionTitle, value) {
  return await page.evaluate((args) => {
    const { title, val } = args;
    const titles = document.querySelectorAll('.avp-option-title');
    for (const titleEl of titles) {
      const titleText = titleEl.textContent || '';
      if (titleText.includes(title)) {
        const container = titleEl.closest('.avp-option');
        if (container && container.offsetParent !== null) {
          const labels = container.querySelectorAll('label.avp-productoptionswatchwrapper');
          for (const label of labels) {
            if (label.offsetParent === null) continue;
            const input = label.querySelector('input');
            if (input?.disabled) continue;
            const text = label.textContent || '';
            if (text.includes(val)) {
              label.click();
              return { success: true, selected: text.substring(0, 30) };
            }
          }
        }
      }
    }
    return { success: false };
  }, { title: optionTitle, val: value });
}

async function analyzeHeadcover() {
  console.log('='.repeat(50));
  console.log('MEZZ.1 MAX - Headcover selection 구조 분석');
  console.log('='.repeat(50));

  let page;

  try {
    page = await initBrowser();
    await waitForManualLogin(page);

    console.log('\n상품 페이지로 이동...');
    await page.goto('https://labgolf.com/products/mezz-1-max-custom', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(3000);

    // Step 1
    await selectPillOption(page, 'RIGHT');
    await selectPillOption(page, 'STANDARD');
    await selectPillOption(page, 'STANDARD');
    await page.waitForTimeout(500);

    // Step 2
    await page.locator('text=NEXT STEP').first().click();
    await page.waitForTimeout(2000);

    await selectSwatchDropdown(page, 'Shaft', 'GEARS');
    await page.waitForTimeout(1000);
    await selectDropdown(page, '35"');
    await page.waitForTimeout(1000);
    await selectDropdown(page, '69°');
    await page.waitForTimeout(1000);

    // Step 3
    await page.locator('text=NEXT STEP').first().click();
    await page.waitForTimeout(2000);

    await selectColorSwatch(page, 'Putter color', 'Purple');
    await page.waitForTimeout(500);
    await selectSwatchDropdown(page, 'Alignment', 'Thick Line');
    await page.waitForTimeout(500);
    await selectSwatchDropdown(page, 'Grip', 'Press II 1.5');
    await page.waitForTimeout(500);

    // Headcover selection 구조 분석
    console.log('\n=== Headcover selection 구조 분석 ===\n');
    const headcoverAnalysis = await page.evaluate(() => {
      const results = {
        titleText: null,
        visible: false,
        currentSelected: null,
        type: null,
        options: []
      };

      const titles = document.querySelectorAll('.avp-option-title');
      for (const title of titles) {
        const text = title.textContent || '';
        if (text.toLowerCase().includes('headcover')) {
          results.titleText = text.trim();
          const container = title.closest('.avp-option');
          if (container) {
            results.visible = container.offsetParent !== null;

            // 현재 선택된 값 (타이틀에서 | 뒤의 값)
            if (text.includes('|')) {
              results.currentSelected = text.split('|')[1]?.trim();
            }

            // 색상 스와치 확인
            const colorSwatches = container.querySelectorAll('label.avp-productoptionswatchwrapper');
            if (colorSwatches.length > 0) {
              results.type = 'colorSwatch';
              colorSwatches.forEach(label => {
                const input = label.querySelector('input');
                results.options.push({
                  text: label.textContent?.trim().substring(0, 40),
                  visible: label.offsetParent !== null,
                  disabled: input?.disabled,
                  checked: input?.checked
                });
              });
            }

            // 스와치 드롭다운 확인
            const swatchLabels = container.querySelectorAll('label.option-avis-swatch-value-label');
            if (swatchLabels.length > 0) {
              results.type = 'swatchDropdown';
              swatchLabels.forEach(label => {
                results.options.push({
                  text: label.textContent?.trim().substring(0, 40),
                  visible: label.offsetParent !== null
                });
              });
            }
          }
        }
      }

      return results;
    });

    console.log('Headcover 분석 결과:');
    console.log(`  타이틀: ${headcoverAnalysis.titleText}`);
    console.log(`  보임: ${headcoverAnalysis.visible}`);
    console.log(`  현재 선택: ${headcoverAnalysis.currentSelected}`);
    console.log(`  타입: ${headcoverAnalysis.type}`);
    console.log(`\n  옵션들:`);
    headcoverAnalysis.options.forEach(opt => {
      const status = [];
      if (opt.visible) status.push('보임');
      if (opt.checked) status.push('선택됨');
      if (opt.disabled) status.push('비활성화');
      console.log(`    - ${opt.text} [${status.join(', ') || '숨김'}]`);
    });

    console.log('\n30초 대기...');
    await page.waitForTimeout(30000);

  } catch (error) {
    console.error('오류:', error.message);
  } finally {
    await closeBrowser();
  }
}

analyzeHeadcover();
