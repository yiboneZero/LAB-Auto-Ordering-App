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

async function testColorPlaywright() {
  console.log('='.repeat(50));
  console.log('Putter Color - Playwright 클릭 테스트');
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

    // 현재 상태 확인
    console.log('\n=== 클릭 전 상태 ===');
    const beforeState = await page.evaluate(() => {
      const title = document.querySelector('.avp-option-title');
      for (const t of document.querySelectorAll('.avp-option-title')) {
        if (t.textContent?.includes('Putter color')) {
          return t.textContent?.trim();
        }
      }
      return 'not found';
    });
    console.log('Putter color 타이틀:', beforeState);

    // Playwright locator로 Red 색상 클릭
    console.log('\n=== Playwright locator로 Red 클릭 ===');

    // 방법 1: tooltip 텍스트로 찾기
    try {
      const redSwatch = page.locator('label.avp-productoptionswatchwrapper', { hasText: 'Red' }).first();
      await redSwatch.click({ force: true });
      console.log('  방법 1 (label hasText Red): 클릭 완료');
    } catch (e) {
      console.log('  방법 1 실패:', e.message);
    }

    await page.waitForTimeout(1000);

    // 클릭 후 상태 확인
    console.log('\n=== 클릭 후 상태 ===');
    const afterState = await page.evaluate(() => {
      for (const t of document.querySelectorAll('.avp-option-title')) {
        if (t.textContent?.includes('Putter color')) {
          return t.textContent?.trim();
        }
      }
      return 'not found';
    });
    console.log('Putter color 타이틀:', afterState);

    // 상태 변경 확인
    if (afterState.includes('Red')) {
      console.log('\n✓ Red 색상 선택 성공!');
    } else {
      console.log('\n✗ Red 색상 선택 실패 - 다른 방법 시도');

      // 방법 2: input 직접 클릭
      console.log('\n=== 방법 2: input[value*="Red"] 직접 클릭 ===');
      try {
        const redInput = page.locator('input[type="radio"][value*="Red"]').first();
        await redInput.click({ force: true });
        console.log('  input 클릭 완료');
      } catch (e) {
        console.log('  방법 2 실패:', e.message);
      }

      await page.waitForTimeout(1000);

      const afterState2 = await page.evaluate(() => {
        for (const t of document.querySelectorAll('.avp-option-title')) {
          if (t.textContent?.includes('Putter color')) {
            return t.textContent?.trim();
          }
        }
        return 'not found';
      });
      console.log('클릭 후 타이틀:', afterState2);

      // 방법 3: JavaScript로 change 이벤트 발생
      if (!afterState2.includes('Red')) {
        console.log('\n=== 방법 3: JavaScript dispatchEvent ===');
        const result = await page.evaluate(() => {
          const inputs = document.querySelectorAll('input[type="radio"]');
          for (const input of inputs) {
            if (input.value?.includes('Red') && input.value?.includes('OZ.1i')) {
              input.checked = true;
              input.dispatchEvent(new Event('change', { bubbles: true }));
              input.dispatchEvent(new Event('input', { bubbles: true }));
              input.dispatchEvent(new Event('click', { bubbles: true }));

              // 부모 label도 클릭 이벤트 발생
              const label = input.closest('label');
              if (label) {
                label.dispatchEvent(new MouseEvent('click', { bubbles: true }));
              }

              return { success: true, value: input.value };
            }
          }
          return { success: false };
        });
        console.log('결과:', result);

        await page.waitForTimeout(1000);

        const afterState3 = await page.evaluate(() => {
          for (const t of document.querySelectorAll('.avp-option-title')) {
            if (t.textContent?.includes('Putter color')) {
              return t.textContent?.trim();
            }
          }
          return 'not found';
        });
        console.log('클릭 후 타이틀:', afterState3);
      }
    }

    console.log('\n30초 대기...');
    await page.waitForTimeout(30000);

  } catch (error) {
    console.error('오류:', error.message);
  } finally {
    await closeBrowser();
  }
}

testColorPlaywright();
