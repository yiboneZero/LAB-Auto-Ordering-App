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
      if (titleText.includes(title + '*') || titleText.includes(title + ' *')) {
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

async function analyzeColorClick() {
  console.log('='.repeat(50));
  console.log('Putter Color 클릭 후 선택 상태 분석');
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

    // Step 2
    await page.locator('text=NEXT STEP').first().click();
    await page.waitForTimeout(2000);
    await selectSwatchDropdown(page, 'Shaft', 'Diamana Matte');
    await page.waitForTimeout(1000);
    await selectDropdown(page, '34"');
    await page.waitForTimeout(1000);
    await selectDropdown(page, '0°');
    await page.waitForTimeout(1000);
    await selectSwatchDropdown(page, 'Grip Selection', 'Garsen Quad Tour');
    await page.waitForTimeout(1000);

    // Step 3
    await page.locator('text=NEXT STEP').first().click();
    await page.waitForTimeout(2000);

    // 현재 Putter color 선택 상태 확인
    console.log('\n=== 클릭 전 Putter color 상태 ===');
    const beforeClick = await page.evaluate(() => {
      const titles = document.querySelectorAll('.avp-option-title');
      for (const title of titles) {
        if (title.textContent?.includes('Putter color')) {
          const container = title.closest('.avp-option');
          if (container) {
            // 현재 선택된 라디오 버튼 확인
            const checkedInput = container.querySelector('input[type="radio"]:checked');
            // 선택된 라벨 확인
            const selectedLabel = container.querySelector('label.avp-productoptionswatchwrapper.avp-product-option-selected, label.avp-productoptionswatchwrapper input:checked');

            // 모든 라벨과 input 상태
            const allLabels = container.querySelectorAll('label.avp-productoptionswatchwrapper');
            const labelStates = [];
            allLabels.forEach(label => {
              const input = label.querySelector('input');
              labelStates.push({
                text: label.textContent?.trim().substring(0, 25),
                checked: input?.checked,
                hasSelectedClass: label.classList.contains('avp-product-option-selected')
              });
            });

            return {
              titleText: title.textContent?.trim(),
              checkedInputValue: checkedInput?.value,
              labelStates: labelStates
            };
          }
        }
      }
      return null;
    });
    console.log('클릭 전 상태:');
    console.log(JSON.stringify(beforeClick, null, 2));

    // Red 색상 클릭
    console.log('\n=== Red 색상 클릭 시도 ===');
    const clickResult = await page.evaluate(() => {
      const titles = document.querySelectorAll('.avp-option-title');
      for (const title of titles) {
        if (title.textContent?.includes('Putter color')) {
          const container = title.closest('.avp-option');
          if (container && container.offsetParent !== null) {
            const labels = container.querySelectorAll('label.avp-productoptionswatchwrapper');
            for (const label of labels) {
              const text = label.textContent || '';
              if (text.includes('Red')) {
                // input 요소 찾기
                const input = label.querySelector('input[type="radio"]');
                console.log('Found input:', input?.id, input?.name, input?.value);

                // 클릭 전 상태
                const beforeChecked = input?.checked;

                // label 클릭
                label.click();

                // 또는 input 직접 클릭
                if (input) {
                  input.click();
                  input.dispatchEvent(new Event('change', { bubbles: true }));
                }

                return {
                  success: true,
                  labelText: text.substring(0, 30),
                  inputId: input?.id,
                  inputValue: input?.value,
                  beforeChecked: beforeChecked,
                  afterChecked: input?.checked
                };
              }
            }
          }
        }
      }
      return { success: false };
    });
    console.log('클릭 결과:', JSON.stringify(clickResult, null, 2));

    await page.waitForTimeout(1000);

    // 클릭 후 상태 확인
    console.log('\n=== 클릭 후 Putter color 상태 ===');
    const afterClick = await page.evaluate(() => {
      const titles = document.querySelectorAll('.avp-option-title');
      for (const title of titles) {
        if (title.textContent?.includes('Putter color')) {
          const container = title.closest('.avp-option');
          if (container) {
            const allLabels = container.querySelectorAll('label.avp-productoptionswatchwrapper');
            const labelStates = [];
            allLabels.forEach(label => {
              const input = label.querySelector('input');
              labelStates.push({
                text: label.textContent?.trim().substring(0, 25),
                checked: input?.checked,
                hasSelectedClass: label.classList.contains('avp-product-option-selected')
              });
            });

            return {
              titleText: title.textContent?.trim(),
              labelStates: labelStates
            };
          }
        }
      }
      return null;
    });
    console.log('클릭 후 상태:');
    console.log(JSON.stringify(afterClick, null, 2));

    console.log('\n30초 대기...');
    await page.waitForTimeout(30000);

  } catch (error) {
    console.error('오류:', error.message);
  } finally {
    await closeBrowser();
  }
}

analyzeColorClick();
