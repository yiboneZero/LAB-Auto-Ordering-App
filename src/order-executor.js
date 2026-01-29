// 자동주문 실행 모듈
const { initBrowser, closeBrowser } = require('./browser');
const { waitForManualLogin } = require('./login');
const { getProductUrl } = require('./parser');

// 상태 관리
let currentStatus = {
  status: 'idle',
  message: '',
  step: '',
  progress: 0
};

let statusCallback = null;

function setStatusCallback(callback) {
  statusCallback = callback;
}

function updateStatus(status, message, step = '', progress = 0) {
  currentStatus = { status, message, step, progress };
  if (statusCallback) {
    statusCallback(currentStatus);
  }
}

function getStatus() {
  return currentStatus;
}

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

// 스와치 드롭다운 선택 함수
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

  if (!openResult.success) {
    return { success: false, reason: 'option container not found' };
  }

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

// 색상 스와치 선택 함수
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

// 일반 드롭다운 선택 함수
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
        return { success: true, selectName: select.name || select.id };
      }
    }
    return { success: false };
  }, value);
}

// 메인 주문 실행 함수
async function executeOrder(options) {
  let page;
  const results = [];

  try {
    updateStatus('running', '브라우저 시작 중...', 'init', 5);

    page = await initBrowser();

    updateStatus('running', '로그인 대기 중...', 'login', 10);
    await waitForManualLogin(page);

    updateStatus('running', '상품 페이지로 이동 중...', 'navigate', 15);
    const productUrl = getProductUrl(options.product);
    await page.goto(productUrl, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(3000);

    // ===== Step 1 (FOUNDATION) =====
    updateStatus('running', 'Step 1: FOUNDATION 옵션 선택 중...', 'step1', 20);

    // Hand
    const handResult = await selectPillOption(page, options.hand);
    results.push({ option: 'Hand', value: options.hand, success: handResult.success });
    await page.waitForTimeout(300);

    // Putting style
    const styleResult = await selectPillOption(page, options.puttingStyle);
    results.push({ option: 'Putting style', value: options.puttingStyle, success: styleResult.success });
    await page.waitForTimeout(300);

    // Head weight
    const weightResult = await selectPillOption(page, options.headWeight);
    results.push({ option: 'Head weight', value: options.headWeight, success: weightResult.success });
    await page.waitForTimeout(300);

    // NEXT STEP
    updateStatus('running', 'Step 2로 이동 중...', 'step1-next', 30);
    await page.locator('text=NEXT STEP').first().click();
    await page.waitForTimeout(2000);

    // ===== Step 2 (FUNCTION) =====
    updateStatus('running', 'Step 2: FUNCTION 옵션 선택 중...', 'step2', 35);

    // Shaft
    const shaftResult = await selectSwatchDropdown(page, 'Shaft', options.shaft);
    results.push({ option: 'Shaft', value: options.shaft, success: shaftResult.success });
    await page.waitForTimeout(1000);

    // Shaft length
    const lengthResult = await selectDropdown(page, options.shaftLength);
    results.push({ option: 'Shaft length', value: options.shaftLength, success: lengthResult.success });
    await page.waitForTimeout(1000);

    // Shaft lean (없는 제품도 있음 - null이면 스킵)
    if (options.shaftLean) {
      const leanResult = await selectDropdown(page, options.shaftLean);
      results.push({ option: 'Shaft lean', value: options.shaftLean, success: leanResult.success });
      await page.waitForTimeout(1000);
    }

    // Grip Selection
    const gripResult = await selectSwatchDropdown(page, 'Grip Selection', options.gripSelection);
    results.push({ option: 'Grip Selection', value: options.gripSelection, success: gripResult.success });
    await page.waitForTimeout(1000);

    // NEXT STEP
    updateStatus('running', 'Step 3로 이동 중...', 'step2-next', 55);
    await page.locator('text=NEXT STEP').first().click();
    await page.waitForTimeout(2000);

    // ===== Step 3 (FORM) =====
    updateStatus('running', 'Step 3: FORM 옵션 선택 중...', 'step3', 60);

    // Riser
    const riserResult = await selectDropdown(page, 'Riser - ' + options.riser);
    results.push({ option: 'Riser', value: options.riser, success: riserResult.success });
    await page.waitForTimeout(500);

    // Lie angle
    if (options.lieAngle) {
      const lieResult = await selectDropdown(page, options.lieAngle);
      results.push({ option: 'Lie angle', value: options.lieAngle, success: lieResult.success });
      await page.waitForTimeout(500);
    }

    // Putter color
    const colorResult = await selectColorSwatch(page, 'Putter color', options.putterColor);
    results.push({ option: 'Putter color', value: options.putterColor, success: colorResult.success });
    await page.waitForTimeout(500);

    // Insert
    const insertResult = await selectDropdown(page, options.insert);
    results.push({ option: 'Insert', value: options.insert, success: insertResult.success });
    await page.waitForTimeout(500);

    // Alignment Mark Front
    if (options.alignmentFront) {
      const alignFrontResult = await selectSwatchDropdown(page, 'Alignment Mark Front', options.alignmentFront);
      results.push({ option: 'Alignment Front', value: options.alignmentFront, success: alignFrontResult.success });
      await page.waitForTimeout(500);
    }

    // Alignment Mark Back
    if (options.alignmentBack) {
      const alignBackResult = await selectSwatchDropdown(page, 'Alignment Mark Back', options.alignmentBack);
      results.push({ option: 'Alignment Back', value: options.alignmentBack, success: alignBackResult.success });
      await page.waitForTimeout(500);
    }

    // Add to Cart
    updateStatus('running', '장바구니에 추가 중...', 'addToCart', 90);
    const addToCartResult = await page.evaluate(() => {
      const btn = document.querySelector('button.avis-new-addcart-button, button[name="add"]');
      if (btn && !btn.disabled) {
        btn.click();
        return { success: true };
      }
      return { success: false, disabled: btn?.disabled };
    });
    results.push({ option: 'Add to Cart', value: 'click', success: addToCartResult.success });

    await page.waitForTimeout(3000);

    if (addToCartResult.success) {
      updateStatus('completed', '주문이 장바구니에 추가되었습니다!', 'done', 100);
    } else {
      updateStatus('error', '장바구니 추가 실패', 'error', 100);
    }

    return {
      success: addToCartResult.success,
      results,
      message: addToCartResult.success ? '장바구니에 추가 완료!' : '장바구니 추가 실패'
    };

  } catch (error) {
    updateStatus('error', `오류 발생: ${error.message}`, 'error', 0);
    return {
      success: false,
      results,
      message: error.message
    };
  }
}

module.exports = {
  executeOrder,
  getStatus,
  setStatusCallback,
  updateStatus
};
