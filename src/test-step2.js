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

// 드롭다운 선택 함수
async function selectDropdown(page, value) {
  return await page.evaluate((val) => {
    const selects = document.querySelectorAll('select');
    for (const select of selects) {
      if (select.offsetParent === null) continue; // 보이지 않으면 스킵
      const hasOption = Array.from(select.options).some(opt => opt.value === val);
      if (hasOption) {
        select.value = val;
        select.dispatchEvent(new Event('change', { bubbles: true }));
        return { success: true, selectName: select.name || select.id };
      }
    }
    return { success: false };
  }, value);
}

// 스와치(이미지) 선택 함수
async function selectSwatch(page, value) {
  return await page.evaluate((val) => {
    // label 텍스트로 찾기
    const labels = document.querySelectorAll('label.option-avis-swatch-value-label');
    for (const label of labels) {
      if (label.offsetParent === null) continue;
      const text = label.textContent?.trim();
      if (text && text.includes(val)) {
        label.click();
        return { success: true, method: 'label' };
      }
    }
    // input value로 찾기
    const inputs = document.querySelectorAll('input[type="radio"]');
    for (const input of inputs) {
      if (input.value && input.value.includes(val)) {
        const label = input.closest('label') || document.querySelector(`label[for="${input.id}"]`);
        if (label && label.offsetParent !== null) {
          label.click();
          return { success: true, method: 'input-label' };
        }
      }
    }
    return { success: false };
  }, value);
}

async function testStep2() {
  console.log('='.repeat(50));
  console.log('Step 1 → Step 2 (FUNCTION) 테스트');
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

    // Step 2 옵션들 (내가 알려준 옵션 기준)
    // Riser: Riser - Black (드롭다운)
    console.log('Riser 선택...');
    const riserResult = await selectDropdown(page, 'Riser - Black');
    console.log(riserResult.success ? '  ✓ Riser: Riser - Black' : '  ✗ Riser 선택 실패');
    await page.waitForTimeout(500);

    // Lie angle: 70° (드롭다운)
    console.log('Lie angle 선택...');
    const lieResult = await selectDropdown(page, '70°');
    console.log(lieResult.success ? '  ✓ Lie angle: 70°' : '  ✗ Lie angle 선택 실패');
    await page.waitForTimeout(500);

    // Shaft: Diamana Matte x L.A.B. Golf (스와치)
    console.log('Shaft 선택...');
    const shaftResult = await selectSwatch(page, 'Diamana Matte');
    console.log(shaftResult.success ? '  ✓ Shaft: Diamana Matte' : '  ✗ Shaft 선택 실패');
    await page.waitForTimeout(500);

    // Shaft length: 34" (드롭다운)
    console.log('Shaft length 선택...');
    const lengthResult = await selectDropdown(page, '34"');
    console.log(lengthResult.success ? '  ✓ Shaft length: 34"' : '  ✗ Shaft length 선택 실패');
    await page.waitForTimeout(500);

    // Shaft lean: 0° (드롭다운)
    console.log('Shaft lean 선택...');
    const leanResult = await selectDropdown(page, '0°');
    console.log(leanResult.success ? '  ✓ Shaft lean: 0°' : '  ✗ Shaft lean 선택 실패');
    await page.waitForTimeout(500);

    // NEXT STEP 버튼 확인
    console.log('\n[NEXT STEP 버튼 확인]');
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

testStep2();
