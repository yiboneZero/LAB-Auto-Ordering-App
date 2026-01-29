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

// 색상 스와치 선택 함수 (이미지 버튼 형태) - 보이는 요소만 클릭
async function selectColorSwatch(page, optionTitle, value) {
  return await page.evaluate((args) => {
    const { title, val } = args;
    const titles = document.querySelectorAll('.avp-option-title');
    for (const titleEl of titles) {
      const titleText = titleEl.textContent || '';
      if (titleText.includes(title)) {
        const container = titleEl.closest('.avp-option');
        if (container && container.offsetParent !== null) {
          // avp-productoptionswatchwrapper 라벨 찾기 - 보이는 것만!
          const labels = container.querySelectorAll('label.avp-productoptionswatchwrapper');
          for (const label of labels) {
            // 보이지 않거나 비활성화된 요소 스킵
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

// 일반 드롭다운(SELECT) 선택 함수 - 보이는 요소만 대상
async function selectDropdown(page, value) {
  return await page.evaluate((val) => {
    const selects = document.querySelectorAll('select');
    for (const select of selects) {
      if (select.offsetParent === null) continue; // 보이지 않으면 스킵
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
        return { success: true, selectName: select.name || select.id };
      }
    }
    return { success: false };
  }, value);
}

async function testStep2Step3() {
  console.log('='.repeat(50));
  console.log('Step 1 → Step 2 → Step 3 테스트');
  console.log('(조건부 옵션: 순차 선택 필요)');
  console.log('='.repeat(50));

  let page;

  try {
    page = await initBrowser();
    await waitForManualLogin(page);

    // 상품 페이지로 이동
    console.log('\n상품 페이지로 이동...');
    await page.goto('https://labgolf.com/products/oz1i-hs-custom', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(3000);

    // ===== Step 1 (FOUNDATION) =====
    console.log('\n=== Step 1 (FOUNDATION) ===\n');
    const step1Options = { 'Hand': 'LEFT', 'Putting style': 'STANDARD', 'Head weight': 'LIGHTER' };

    for (const [name, value] of Object.entries(step1Options)) {
      const result = await selectPillOption(page, value);
      console.log(result.success
        ? `  ✓ ${name}: ${value}${result.alreadySelected ? ' (이미 선택됨)' : ''}`
        : `  ✗ ${name}: ${value}`);
      await page.waitForTimeout(300);
    }

    // NEXT STEP 클릭 (Step 2로)
    console.log('\n[NEXT STEP: FUNCTION 클릭]');
    await page.locator('text=NEXT STEP').first().click();
    console.log('  ✓ 클릭 완료');
    await page.waitForTimeout(2000);

    // ===== Step 2 (FUNCTION) - 순차 선택 =====
    console.log('\n=== Step 2 (FUNCTION) - 순차 선택 ===\n');

    // 1. Shaft 선택 → Shaft Length 활성화
    console.log('1. Shaft 선택...');
    const shaftResult = await selectSwatchDropdown(page, 'Shaft', 'Diamana Matte');
    console.log(shaftResult.success ? `  ✓ Shaft: ${shaftResult.selected}` : '  ✗ Shaft 선택 실패');
    await page.waitForTimeout(1000); // 다음 옵션 로드 대기

    // 2. Shaft Length 선택 → Shaft Lean 활성화
    console.log('2. Shaft length 선택...');
    const lengthResult = await selectDropdown(page, '34"');
    console.log(lengthResult.success ? '  ✓ Shaft length: 34"' : '  ✗ Shaft length 선택 실패');
    await page.waitForTimeout(1000); // 다음 옵션 로드 대기

    // 3. Shaft Lean 선택 → Grip Selection 활성화
    console.log('3. Shaft lean 선택...');
    const leanResult = await selectDropdown(page, '0°');
    console.log(leanResult.success ? '  ✓ Shaft lean: 0°' : '  ✗ Shaft lean 선택 실패');
    await page.waitForTimeout(1000); // 다음 옵션 로드 대기

    // 4. Grip Selection
    console.log('4. Grip Selection 선택...');
    const gripResult = await selectSwatchDropdown(page, 'Grip Selection', 'Garsen Quad Tour');
    console.log(gripResult.success ? `  ✓ Grip: ${gripResult.selected}` : '  ✗ Grip 선택 실패');
    await page.waitForTimeout(1000);

    // NEXT STEP 클릭 (Step 3로)
    console.log('\n[NEXT STEP: FORM 클릭]');
    await page.locator('text=NEXT STEP').first().click();
    console.log('  ✓ 클릭 완료');
    await page.waitForTimeout(2000);

    // ===== Step 3 (FORM) =====
    console.log('\n=== Step 3 (FORM) ===\n');

    // 현재 보이는 옵션 확인
    console.log('[Step 3 보이는 옵션들]');
    const step3Options = await page.evaluate(() => {
      const results = [];
      const optionTitles = document.querySelectorAll('.avp-option-title');
      for (const title of optionTitles) {
        const container = title.closest('.avp-option');
        if (container && container.offsetParent !== null) {
          results.push(title.textContent?.trim().substring(0, 50));
        }
      }
      return results;
    });
    step3Options.forEach(opt => console.log(`  - ${opt}`));

    // 1. Riser 선택
    console.log('\n1. Riser 선택...');
    const riserResult = await selectDropdown(page, 'Riser - Black');
    console.log(riserResult.success ? '  ✓ Riser: Riser - Black' : '  ✗ Riser 선택 실패');
    await page.waitForTimeout(500);

    // 2. Lie angle 선택
    console.log('2. Lie angle 선택...');
    const lieResult = await selectDropdown(page, '70°');
    console.log(lieResult.success ? '  ✓ Lie angle: 70°' : '  ✗ Lie angle 선택 실패');
    await page.waitForTimeout(500);

    // 3. Putter color 선택 (색상 스와치 형태)
    console.log('3. Putter color 선택...');
    const colorResult = await selectColorSwatch(page, 'Putter color', 'Red');
    console.log(colorResult.success ? `  ✓ Putter color: ${colorResult.selected}` : '  ✗ Putter color 선택 실패');
    await page.waitForTimeout(500);

    // 4. Insert 선택
    console.log('4. Insert 선택...');
    const insertResult = await selectDropdown(page, 'Medium Fly Mill - Stainless Steel');
    console.log(insertResult.success ? '  ✓ Insert: Medium Fly Mill - Stainless Steel' : '  ✗ Insert 선택 실패');
    await page.waitForTimeout(500);

    // 5. Alignment Mark Front 선택
    console.log('5. Alignment Mark Front 선택...');
    const alignFrontResult = await selectSwatchDropdown(page, 'Alignment Mark Front', 'B');
    console.log(alignFrontResult.success ? `  ✓ Alignment Front: ${alignFrontResult.selected}` : '  ✗ Alignment Front 선택 실패');
    await page.waitForTimeout(500);

    // 6. Alignment Mark Back 선택
    console.log('6. Alignment Mark Back 선택...');
    const alignBackResult = await selectSwatchDropdown(page, 'Alignment Mark Back', '1');
    console.log(alignBackResult.success ? `  ✓ Alignment Back: ${alignBackResult.selected}` : '  ✗ Alignment Back 선택 실패');
    await page.waitForTimeout(500);

    // 7. Headcover 선택
    console.log('7. Headcover 선택...');
    const headcoverResult = await selectSwatchDropdown(page, 'Headcover', 'Black');
    console.log(headcoverResult.success ? `  ✓ Headcover: ${headcoverResult.selected}` : '  ✗ Headcover 선택 실패');
    await page.waitForTimeout(500);

    // 8. Build time 선택
    console.log('8. Build time 선택...');
    const buildResult = await selectPillOption(page, 'Standard');
    console.log(buildResult.success ? `  ✓ Build time: Standard${buildResult.alreadySelected ? ' (이미 선택됨)' : ''}` : '  ✗ Build time 선택 실패');
    await page.waitForTimeout(500);

    // Add to Cart 버튼 상태 확인
    console.log('\n=== Add to Cart 버튼 상태 ===');
    const cartButton = await page.evaluate(() => {
      const btn = document.querySelector('button.avis-new-addcart-button, button[name="add"]');
      return {
        found: !!btn,
        disabled: btn?.disabled,
        text: btn?.textContent?.trim().substring(0, 30)
      };
    });
    console.log(`  버튼: ${cartButton.found ? '발견' : '없음'}, 비활성화: ${cartButton.disabled}, 텍스트: "${cartButton.text}"`);

    // Add to Cart 클릭
    console.log('\n=== Add to Cart 클릭 ===');
    const addToCartResult = await page.evaluate(() => {
      const btn = document.querySelector('button.avis-new-addcart-button, button[name="add"]');
      if (btn && !btn.disabled) {
        btn.click();
        return { success: true };
      }
      return { success: false, disabled: btn?.disabled };
    });
    console.log(addToCartResult.success ? '  ✓ Add to Cart 클릭 완료!' : `  ✗ Add to Cart 클릭 실패 (disabled: ${addToCartResult.disabled})`);

    // 장바구니 추가 확인 대기
    await page.waitForTimeout(3000);

    // 장바구니 상태 확인
    console.log('\n=== 장바구니 확인 ===');
    const cartStatus = await page.evaluate(() => {
      // 장바구니 아이콘의 숫자 확인
      const cartCount = document.querySelector('.cart-count, .cart-item-count, [data-cart-count]');
      // 성공 메시지 확인
      const successMsg = document.querySelector('.cart-notification, .added-to-cart, [data-cart-notification]');
      return {
        cartCount: cartCount?.textContent?.trim(),
        hasSuccessMessage: !!successMsg,
        successText: successMsg?.textContent?.trim().substring(0, 50)
      };
    });
    console.log(`  장바구니 수량: ${cartStatus.cartCount || '확인 불가'}`);
    if (cartStatus.hasSuccessMessage) {
      console.log(`  성공 메시지: ${cartStatus.successText}`);
    }

    console.log('\n30초 대기 - 브라우저에서 확인하세요...');
    await page.waitForTimeout(30000);

  } catch (error) {
    console.error('오류:', error.message);
  } finally {
    await closeBrowser();
  }
}

testStep2Step3();
