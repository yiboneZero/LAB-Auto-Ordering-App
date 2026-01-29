const { initBrowser, closeBrowser } = require('./browser');
const { waitForManualLogin } = require('./login');

// pill 버튼 선택 함수 (이미 선택되어 있으면 클릭 안함)
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

// 스와치 드롭다운 선택 함수 (먼저 드롭다운을 열고, 옵션 선택)
async function selectSwatchDropdown(page, optionTitle, value) {
  // 1. 해당 옵션 영역 찾기 및 드롭다운 열기
  const openResult = await page.evaluate((title) => {
    const titles = document.querySelectorAll('.avp-option-title');
    for (const titleEl of titles) {
      const titleText = titleEl.textContent || '';
      // 정확한 옵션 타이틀 매칭 (Shaft*, Shaft length* 구분)
      if (titleText.includes(title + '*') || titleText.includes(title + ' *')) {
        const container = titleEl.closest('.avp-option');
        if (container && container.offsetParent !== null) {
          // "Select..." 라벨 찾아서 클릭 (드롭다운 열기)
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

  if (!openResult.success) {
    return { success: false, reason: 'option container not found' };
  }

  await page.waitForTimeout(500);

  // 2. 열린 드롭다운에서 옵션 선택
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

// 일반 드롭다운(SELECT) 선택 함수
async function selectDropdown(page, value) {
  return await page.evaluate((val) => {
    const selects = document.querySelectorAll('select');
    for (const select of selects) {
      if (select.offsetParent === null) continue;
      const hasOption = Array.from(select.options).some(opt => opt.value === val || opt.textContent?.trim() === val);
      if (hasOption) {
        // value로 먼저 시도
        const optionByValue = Array.from(select.options).find(opt => opt.value === val);
        if (optionByValue) {
          select.value = optionByValue.value;
        } else {
          // text로 시도
          const optionByText = Array.from(select.options).find(opt => opt.textContent?.trim() === val);
          if (optionByText) {
            select.value = optionByText.value;
          }
        }
        select.dispatchEvent(new Event('change', { bubbles: true }));
        return { success: true, selectName: select.name || select.id };
      }
    }
    return { success: false };
  }, value);
}

async function testStep2Fixed() {
  console.log('='.repeat(50));
  console.log('Step 2 (FUNCTION) 수정된 테스트');
  console.log('='.repeat(50));

  let page;

  try {
    page = await initBrowser();
    await waitForManualLogin(page);

    // 상품 페이지로 이동
    console.log('\n상품 페이지로 이동...');
    await page.goto('https://labgolf.com/products/oz1i-hs-custom', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(3000);

    // ===== Step 1 =====
    console.log('\n=== Step 1 (FOUNDATION) ===\n');
    const step1Options = { 'Hand': 'LEFT', 'Putting style': 'STANDARD', 'Head weight': 'LIGHTER' };

    for (const [name, value] of Object.entries(step1Options)) {
      const result = await selectPillOption(page, value);
      console.log(result.success
        ? `  ✓ ${name}: ${value}${result.alreadySelected ? ' (이미 선택됨)' : ''}`
        : `  ✗ ${name}: ${value}`);
      await page.waitForTimeout(300);
    }

    // NEXT STEP 클릭
    console.log('\n[NEXT STEP: FUNCTION 클릭]');
    await page.locator('text=NEXT STEP').first().click();
    console.log('  ✓ 클릭 완료');
    await page.waitForTimeout(2000);

    // ===== Step 2 =====
    console.log('\n=== Step 2 (FUNCTION) ===\n');

    // 1. Riser 선택 (드롭다운)
    console.log('1. Riser 선택...');
    const riserResult = await selectDropdown(page, 'Riser - Black');
    console.log(riserResult.success ? '  ✓ Riser: Riser - Black' : '  ✗ Riser 선택 실패');
    await page.waitForTimeout(500);

    // 2. Lie angle 선택 (드롭다운)
    console.log('2. Lie angle 선택...');
    const lieResult = await selectDropdown(page, '70°');
    console.log(lieResult.success ? '  ✓ Lie angle: 70°' : '  ✗ Lie angle 선택 실패');
    await page.waitForTimeout(500);

    // 3. Shaft 선택 (스와치 드롭다운 - 클릭으로 열고 선택)
    console.log('3. Shaft 선택 (드롭다운 방식)...');
    const shaftResult = await selectSwatchDropdown(page, 'Shaft', 'Diamana Matte');
    console.log(shaftResult.success ? `  ✓ Shaft: ${shaftResult.selected}` : '  ✗ Shaft 선택 실패');
    await page.waitForTimeout(500);

    // 4. Shaft length 선택 (드롭다운)
    console.log('4. Shaft length 선택...');
    const lengthResult = await selectDropdown(page, '34"');
    console.log(lengthResult.success ? '  ✓ Shaft length: 34"' : '  ✗ Shaft length 선택 실패');
    await page.waitForTimeout(500);

    // 5. Shaft lean 선택 (드롭다운)
    console.log('5. Shaft lean 선택...');
    const leanResult = await selectDropdown(page, '0°');
    console.log(leanResult.success ? '  ✓ Shaft lean: 0°' : '  ✗ Shaft lean 선택 실패');
    await page.waitForTimeout(500);

    // 결과 요약
    console.log('\n=== Step 2 결과 요약 ===');
    const results = [
      { name: 'Riser', success: riserResult.success },
      { name: 'Lie angle', success: lieResult.success },
      { name: 'Shaft', success: shaftResult.success },
      { name: 'Shaft length', success: lengthResult.success },
      { name: 'Shaft lean', success: leanResult.success },
    ];
    results.forEach(r => console.log(`  ${r.success ? '✓' : '✗'} ${r.name}`));

    // NEXT STEP 버튼 확인
    console.log('\n[NEXT STEP: FORM 버튼 확인]');
    const nextButton = await page.evaluate(() => {
      const elements = document.querySelectorAll('*');
      for (const el of elements) {
        const text = el.textContent?.trim();
        if (text && text.includes('NEXT STEP') && text.includes('FORM')) {
          return { found: true, text: text.substring(0, 30) };
        }
      }
      return { found: false };
    });
    console.log(nextButton.found ? `  버튼 발견: ${nextButton.text}` : '  NEXT STEP 버튼 못찾음');

    console.log('\n60초 대기 - 브라우저에서 확인하세요...');
    await page.waitForTimeout(60000);

  } catch (error) {
    console.error('오류:', error.message);
  } finally {
    await closeBrowser();
  }
}

testStep2Fixed();
