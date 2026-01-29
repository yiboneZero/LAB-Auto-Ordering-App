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

async function checkVisibleColors() {
  console.log('='.repeat(50));
  console.log('현재 선택 가능한 Putter Color 확인');
  console.log('='.repeat(50));

  let page;

  try {
    page = await initBrowser();
    await waitForManualLogin(page);

    console.log('\n상품 페이지로 이동...');
    await page.goto('https://labgolf.com/products/oz1i-hs-custom', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(3000);

    // Step 1
    console.log('\n=== Step 1 (LEFT, STANDARD, LIGHTER) ===');
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

    // 보이는 Putter color 옵션들 확인
    console.log('\n=== Step 3에서 보이는 Putter Color 옵션들 ===\n');
    const visibleColors = await page.evaluate(() => {
      const results = [];
      const titles = document.querySelectorAll('.avp-option-title');

      for (const title of titles) {
        if (title.textContent?.includes('Putter color')) {
          const container = title.closest('.avp-option');
          if (container) {
            const labels = container.querySelectorAll('label.avp-productoptionswatchwrapper');
            labels.forEach(label => {
              const input = label.querySelector('input[type="radio"]');
              const isVisible = label.offsetParent !== null;
              const isDisabled = input?.disabled;
              const isHidden = label.classList.contains('avp-hiddenvarianttitleswatch');

              results.push({
                color: input?.value || label.textContent?.trim().substring(0, 25),
                visible: isVisible,
                disabled: isDisabled,
                hidden: isHidden,
                checked: input?.checked
              });
            });
          }
        }
      }

      return results;
    });

    console.log('전체 색상 옵션:');
    visibleColors.forEach(c => {
      const status = [];
      if (c.visible) status.push('✓보임');
      else status.push('✗숨김');
      if (c.disabled) status.push('비활성화');
      if (c.checked) status.push('선택됨');

      console.log(`  ${c.color}: ${status.join(', ')}`);
    });

    // 실제로 클릭 가능한 색상들
    const clickableColors = visibleColors.filter(c => c.visible && !c.disabled);
    console.log('\n클릭 가능한 색상:', clickableColors.length > 0 ? clickableColors.map(c => c.color).join(', ') : '없음');

    console.log('\n30초 대기...');
    await page.waitForTimeout(30000);

  } catch (error) {
    console.error('오류:', error.message);
  } finally {
    await closeBrowser();
  }
}

checkVisibleColors();
