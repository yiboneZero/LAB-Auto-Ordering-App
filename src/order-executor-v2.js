// 자동주문 실행 모듈 v2 - 제품별 전용 처리
const { initBrowser, closeBrowser } = require('./browser');
const { waitForManualLogin } = require('./login');
const { getProductConfig, getProductType } = require('./product-configs');
const { getProductUrl } = require('./parser');

// 상태 관리
let currentStatus = { status: 'idle', message: '', step: '', progress: 0 };
let statusCallback = null;
let isExecuting = false; // 실행 중 플래그

function setStatusCallback(callback) { statusCallback = callback; }
function updateStatus(status, message, step = '', progress = 0) {
  currentStatus = { status, message, step, progress };
  if (statusCallback) statusCallback(currentStatus);
  console.log(`[${progress}%] ${message}`);
}
function getStatus() { return currentStatus; }

// ===== 비활성화 옵션 에러 클래스 =====
class DisabledOptionError extends Error {
  constructor(optionTitle, optionValue) {
    super(`비활성화된 옵션: ${optionTitle} - "${optionValue}"`);
    this.name = 'DisabledOptionError';
    this.optionTitle = optionTitle;
    this.optionValue = optionValue;
  }
}

// ===== 공통 선택 함수들 =====

// Pill 버튼 선택
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

// 스와치 드롭다운 선택
async function selectSwatchDropdown(page, optionTitle, value) {
  const openResult = await page.evaluate((title) => {
    const titles = document.querySelectorAll('.avp-option-title');
    for (const titleEl of titles) {
      const titleText = titleEl.textContent || '';
      if (titleText.includes(title + '*') || titleText.includes(title + ' *') || titleText.toLowerCase().includes(title.toLowerCase())) {
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

  if (!openResult.success) return { success: false, reason: 'not found' };
  await page.waitForTimeout(500);

  const selectResult = await page.evaluate((val) => {
    const labels = document.querySelectorAll('label.option-avis-swatch-value-label');

    // 모든 보이는 라벨 (비활성화 포함)
    const allVisibleLabels = Array.from(labels).filter(l => l.offsetParent !== null);

    // 비활성화 여부 체크 함수 (다양한 방식 체크)
    const isDisabled = (label) => {
      const input = label.querySelector('input');
      // input disabled 체크
      if (input?.disabled) return true;
      // opacity 체크
      const style = window.getComputedStyle(label);
      if (parseFloat(style.opacity) < 0.5) return true;
      // pointer-events 체크
      if (style.pointerEvents === 'none') return true;
      // 비활성화 클래스 체크
      if (label.classList.contains('disabled') || label.classList.contains('unavailable') || label.classList.contains('out-of-stock')) return true;
      // 부모 요소의 disabled 클래스 체크
      const parent = label.closest('.avp-option, .option-container');
      if (parent?.classList.contains('disabled')) return true;
      // data 속성 체크
      if (label.dataset.disabled === 'true' || label.dataset.available === 'false') return true;
      // aria 속성 체크
      if (label.getAttribute('aria-disabled') === 'true') return true;
      return false;
    };

    // 매칭 함수 (라벨이 값과 일치하는지)
    const matchesValue = (label, val) => {
      const text = label.textContent?.trim() || '';
      // 정확한 매칭
      if (text === val) return true;
      // 부분 매칭 (val로 시작하지만 중복 제외)
      if (text.startsWith(val) && !text.startsWith(val + val[val.length - 1])) return true;
      // 키워드 매칭
      const keywords = val.replace(/[()]/g, ' ').split(/[\s,.-]+/).filter(k => k.length > 2);
      if (keywords.length >= 2) {
        const textLower = text.toLowerCase();
        if (keywords.every(k => textLower.includes(k.toLowerCase()))) return true;
      }
      return false;
    };

    // 디버그: 모든 옵션 상태 출력
    const debugInfo = allVisibleLabels.map(label => {
      const text = label.textContent?.trim() || '';
      const input = label.querySelector('input');
      const style = window.getComputedStyle(label);
      return {
        text: text.substring(0, 30),
        inputDisabled: input?.disabled,
        opacity: style.opacity,
        pointerEvents: style.pointerEvents,
        classes: label.className,
        isDisabledResult: isDisabled(label)
      };
    });
    console.log('[DEBUG] 옵션 목록:', JSON.stringify(debugInfo, null, 2));

    // 먼저 원하는 값이 존재하는지 확인 (비활성화 포함)
    for (const label of allVisibleLabels) {
      if (matchesValue(label, val)) {
        const text = label.textContent?.trim() || '';
        const input = label.querySelector('input');

        // 비활성화된 옵션인 경우
        if (isDisabled(label)) {
          console.log(`[DEBUG] 비활성화 감지: ${text}`);
          return { success: false, disabled: true, optionValue: text };
        }

        // 활성화된 옵션 - 선택
        if (input?.checked) {
          return { success: true, selected: text, alreadySelected: true };
        }
        label.click();
        return { success: true, selected: text };
      }
    }

    return { success: false };
  }, value);

  return selectResult;
}

// 스와치 드롭다운 선택 (비활성화 시 에러 발생)
async function selectSwatchDropdownWithCheck(page, optionTitle, value) {
  const result = await selectSwatchDropdown(page, optionTitle, value);
  if (result.disabled) {
    throw new DisabledOptionError(optionTitle, result.optionValue || value);
  }
  return result;
}

// 색상 스와치 선택
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
              // 이미 선택되어 있으면 클릭하지 않음
              if (input?.checked) {
                return { success: true, selected: text.substring(0, 30), alreadySelected: true };
              }
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

// 드롭다운(SELECT) 선택
async function selectDropdown(page, value) {
  return await page.evaluate((val) => {
    const selects = document.querySelectorAll('select');
    for (const select of selects) {
      if (select.offsetParent === null) continue;

      // 1. 정확한 매칭 시도
      let option = Array.from(select.options).find(opt => opt.value === val || opt.textContent?.trim() === val);

      // 2. 부분 매칭 시도 (값으로 시작하거나 포함)
      if (!option) {
        option = Array.from(select.options).find(opt => {
          const text = opt.textContent?.trim() || '';
          const optVal = opt.value || '';
          return text.startsWith(val) || optVal.startsWith(val) || text.includes(val);
        });
      }

      if (option) {
        select.value = option.value;
        select.dispatchEvent(new Event('change', { bubbles: true }));
        return { success: true, selectName: select.name, selectedText: option.textContent?.trim() };
      }
    }
    return { success: false };
  }, value);
}

// NEXT STEP 클릭
async function clickNextStep(page) {
  try {
    await page.locator('text=NEXT STEP').first().click();
    await page.waitForTimeout(2000);
    return { success: true };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

// Add to Cart 클릭
async function clickAddToCart(page) {
  try {
    // avis-new-addcart-button 클래스만 선택 (페이지에 ADD TO CART 버튼이 2개 있음)
    const button = page.locator('button.avis-new-addcart-button');
    await button.waitFor({ state: 'visible', timeout: 5000 });

    // 버튼이 활성화(disabled가 아닌 상태)될 때까지 추가 대기
    await page.waitForFunction(() => {
      const btn = document.querySelector('button.avis-new-addcart-button, button[name="add"]');
      return btn && !btn.disabled;
    }, { timeout: 5000 });

    // JavaScript로 직접 클릭 (Playwright click이 실제로 작동하지 않는 경우 대비)
    const clicked = await page.evaluate(() => {
      const btn = document.querySelector('button.avis-new-addcart-button, button[name="add"]');
      if (btn && !btn.disabled) {
        btn.click();
        return true;
      }
      return false;
    });

    if (!clicked) {
      // 폴백: Playwright click 시도
      await button.click();
    }

    // 장바구니 페이지로 이동 대기 (최대 10초)
    try {
      await page.waitForURL('**/cart**', { timeout: 10000 });
      console.log('장바구니 페이지로 이동 완료');
      return { success: true, navigated: true };
    } catch (navError) {
      // URL 변경이 없어도 장바구니에 추가되었을 수 있음 (AJAX)
      console.log('장바구니 페이지로 이동하지 않음 - AJAX 방식일 수 있음');
      await page.waitForTimeout(2000);
      return { success: true, navigated: false };
    }
  } catch (e) {
    console.error('Add to Cart 오류:', e.message);
    return { success: false, error: e.message };
  }
}

// ===== OZ.1i HS 전용 실행 =====
async function executeOz1iHs(page, options) {
  const results = [];

  // Step 1: FOUNDATION
  updateStatus('running', 'Step 1: FOUNDATION', 'step1', 20);

  let result = await selectPillOption(page, options.hand);
  results.push({ option: 'Hand', value: options.hand, success: result.success });
  await page.waitForTimeout(300);

  result = await selectPillOption(page, options.puttingStyle);
  results.push({ option: 'Putting style', value: options.puttingStyle, success: result.success });
  await page.waitForTimeout(300);

  result = await selectPillOption(page, options.headWeight);
  results.push({ option: 'Head weight', value: options.headWeight, success: result.success });
  await page.waitForTimeout(300);

  await clickNextStep(page);

  // Step 2: FUNCTION (순차 선택)
  updateStatus('running', 'Step 2: FUNCTION', 'step2', 35);

  result = await selectSwatchDropdownWithCheck(page, 'Shaft', options.shaft);
  results.push({ option: 'Shaft', value: options.shaft, success: result.success });
  await page.waitForTimeout(1500);  // 샤프트 변경 시 옵션 갱신 대기

  result = await selectDropdown(page, options.shaftLength);
  results.push({ option: 'Shaft length', value: options.shaftLength, success: result.success });
  await page.waitForTimeout(1000);

  if (options.shaftLean) {
    result = await selectDropdown(page, options.shaftLean);
    results.push({ option: 'Shaft lean', value: options.shaftLean, success: result.success });
    await page.waitForTimeout(1000);
  }

  // Grip Selection - 'Grip'으로도 매칭 시도
  result = await selectSwatchDropdownWithCheck(page, 'Grip', options.gripSelection);
  results.push({ option: 'Grip Selection', value: options.gripSelection, success: result.success });
  await page.waitForTimeout(1000);

  await clickNextStep(page);

  // Step 3: FORM
  updateStatus('running', 'Step 3: FORM', 'step3', 60);

  result = await selectDropdown(page, 'Riser - ' + (options.riser || 'Black'));
  results.push({ option: 'Riser', value: options.riser, success: result.success });
  await page.waitForTimeout(500);

  if (options.lieAngle) {
    result = await selectDropdown(page, options.lieAngle);
    results.push({ option: 'Lie angle', value: options.lieAngle, success: result.success });
    await page.waitForTimeout(500);
  }

  result = await selectColorSwatch(page, 'Putter color', options.putterColor);
  results.push({ option: 'Putter color', value: options.putterColor, success: result.success });
  await page.waitForTimeout(500);

  if (options.insert) {
    result = await selectDropdown(page, options.insert);
    results.push({ option: 'Insert', value: options.insert, success: result.success });
    await page.waitForTimeout(500);
  }

  if (options.alignmentFront) {
    result = await selectSwatchDropdownWithCheck(page, 'Alignment Mark Front', options.alignmentFront);
    results.push({ option: 'Alignment Front', value: options.alignmentFront, success: result.success });
    await page.waitForTimeout(500);
  }

  if (options.alignmentBack) {
    result = await selectSwatchDropdownWithCheck(page, 'Alignment Mark Back', options.alignmentBack);
    results.push({ option: 'Alignment Back', value: options.alignmentBack, success: result.success });
    await page.waitForTimeout(500);
  }

  return results;
}

// ===== OZ.1 전용 실행 (Grip Selection이 Step 3에 있음) =====
async function executeOz1(page, options) {
  const results = [];

  // Step 1: FOUNDATION
  updateStatus('running', 'Step 1: FOUNDATION', 'step1', 20);

  let result = await selectPillOption(page, options.hand);
  results.push({ option: 'Hand', value: options.hand, success: result.success });
  await page.waitForTimeout(300);

  result = await selectPillOption(page, options.puttingStyle);
  results.push({ option: 'Putting style', value: options.puttingStyle, success: result.success });
  await page.waitForTimeout(300);

  result = await selectPillOption(page, options.headWeight);
  results.push({ option: 'Head weight', value: options.headWeight, success: result.success });
  await page.waitForTimeout(300);

  await clickNextStep(page);

  // Step 2: FUNCTION (Lie angle 포함, Grip Selection 없음)
  updateStatus('running', 'Step 2: FUNCTION', 'step2', 35);

  result = await selectSwatchDropdownWithCheck(page, 'Shaft', options.shaft);
  results.push({ option: 'Shaft', value: options.shaft, success: result.success });
  await page.waitForTimeout(1500);

  result = await selectDropdown(page, options.shaftLength);
  results.push({ option: 'Shaft length', value: options.shaftLength, success: result.success });
  await page.waitForTimeout(1000);

  if (options.shaftLean) {
    result = await selectDropdown(page, options.shaftLean);
    results.push({ option: 'Shaft lean', value: options.shaftLean, success: result.success });
    await page.waitForTimeout(1000);
  }

  // OZ.1은 Lie angle이 Step 2에 있음
  if (options.lieAngle) {
    result = await selectDropdown(page, options.lieAngle);
    results.push({ option: 'Lie angle', value: options.lieAngle, success: result.success });
    await page.waitForTimeout(1000);
  }

  await clickNextStep(page);

  // Step 3: FORM (OZ.1: Putter color → Alignment → Grip → Headcover)
  updateStatus('running', 'Step 3: FORM', 'step3', 60);

  result = await selectColorSwatch(page, 'Putter color', options.putterColor);
  results.push({ option: 'Putter color', value: options.putterColor, success: result.success });
  await page.waitForTimeout(500);

  // Alignment Mark Front (커스텀 드롭다운)
  if (options.alignmentFront) {
    result = await selectSwatchDropdownWithCheck(page, 'Alignment Mark Front', options.alignmentFront);
    results.push({ option: 'Alignment Front', value: options.alignmentFront, success: result.success });
    await page.waitForTimeout(500);
  }

  // Alignment Mark Back (커스텀 드롭다운)
  if (options.alignmentBack) {
    result = await selectSwatchDropdownWithCheck(page, 'Alignment Mark Back', options.alignmentBack);
    results.push({ option: 'Alignment Back', value: options.alignmentBack, success: result.success });
    await page.waitForTimeout(500);
  }

  // Grip Selection (드롭다운)
  if (options.gripSelection) {
    result = await selectSwatchDropdownWithCheck(page, 'Grip', options.gripSelection);
    results.push({ option: 'Grip Selection', value: options.gripSelection, success: result.success });
    await page.waitForTimeout(500);
  }

  // Headcover - 기본값 유지
  const currentHeadcover = await page.evaluate(() => {
    const titles = document.querySelectorAll('.avp-option-title');
    for (const title of titles) {
      if (title.textContent?.toLowerCase().includes('headcover')) {
        const text = title.textContent || '';
        if (text.includes('|')) {
          return text.split('|')[1]?.trim();
        }
      }
    }
    return 'default';
  });
  results.push({ option: 'Headcover', value: `기본값 유지 (${currentHeadcover})`, success: true });

  return results;
}

// ===== DF3 전용 실행 =====
async function executeDF3(page, options) {
  const results = [];

  // Step 1: FOUNDATION
  updateStatus('running', 'Step 1: FOUNDATION', 'step1', 20);

  let result = await selectPillOption(page, options.hand);
  results.push({ option: 'Hand', value: options.hand, success: result.success });
  await page.waitForTimeout(300);

  result = await selectPillOption(page, options.puttingStyle);
  results.push({ option: 'Putting style', value: options.puttingStyle, success: result.success });
  await page.waitForTimeout(300);

  result = await selectPillOption(page, options.headWeight);
  results.push({ option: 'Head weight', value: options.headWeight, success: result.success });
  await page.waitForTimeout(300);

  await clickNextStep(page);

  // Step 2: FUNCTION
  updateStatus('running', 'Step 2: FUNCTION', 'step2', 35);

  result = await selectSwatchDropdownWithCheck(page, 'Shaft', options.shaft);
  results.push({ option: 'Shaft', value: options.shaft, success: result.success });
  await page.waitForTimeout(1500);

  result = await selectDropdown(page, options.shaftLength);
  results.push({ option: 'Shaft length', value: options.shaftLength, success: result.success });
  await page.waitForTimeout(1000);

  if (options.lieAngle) {
    result = await selectDropdown(page, options.lieAngle);
    results.push({ option: 'Lie angle', value: options.lieAngle, success: result.success });
    await page.waitForTimeout(1000);
  }

  if (options.shaftLean) {
    result = await selectDropdown(page, options.shaftLean);
    results.push({ option: 'Shaft lean', value: options.shaftLean, success: result.success });
    await page.waitForTimeout(1000);
  }

  await clickNextStep(page);

  // Step 3: FORM
  updateStatus('running', 'Step 3: FORM', 'step3', 60);

  // DF3 Putter color 형식: "DF3 - Black" 등
  const putterColorValue = options.putterColor?.includes('DF3')
    ? options.putterColor
    : `DF3 - ${options.putterColor}`;
  result = await selectColorSwatch(page, 'Putter color', putterColorValue);
  results.push({ option: 'Putter color', value: putterColorValue, success: result.success });
  await page.waitForTimeout(500);

  // Alignment mark (드롭다운) - alignmentMark 또는 alignmentFront 사용
  const alignmentValue = options.alignmentMark || options.alignmentFront;
  if (alignmentValue) {
    result = await selectSwatchDropdownWithCheck(page, 'Alignment mark', alignmentValue);
    results.push({ option: 'Alignment mark', value: alignmentValue, success: result.success });
    await page.waitForTimeout(500);
  }

  // Grip selection (드롭다운) - "Grip selection" 타이틀 사용
  if (options.gripSelection) {
    result = await selectSwatchDropdownWithCheck(page, 'Grip selection', options.gripSelection);
    results.push({ option: 'Grip selection', value: options.gripSelection, success: result.success });
    await page.waitForTimeout(500);
  }

  // Headcover selection (스와치) - 기본값 유지
  const currentHeadcover = await page.evaluate(() => {
    const titles = document.querySelectorAll('.avp-option-title');
    for (const title of titles) {
      if (title.textContent?.toLowerCase().includes('headcover')) {
        const text = title.textContent || '';
        if (text.includes('|')) {
          return text.split('|')[1]?.trim();
        }
      }
    }
    return 'default';
  });
  results.push({ option: 'Headcover', value: `기본값 유지 (${currentHeadcover})`, success: true });

  return results;
}

// ===== MEZZ.1 MAX 전용 실행 =====
async function executeMezz1Max(page, options) {
  const results = [];

  // Step 1: FOUNDATION
  updateStatus('running', 'Step 1: FOUNDATION', 'step1', 20);

  let result = await selectPillOption(page, options.hand);
  results.push({ option: 'Hand', value: options.hand, success: result.success });
  await page.waitForTimeout(300);

  result = await selectPillOption(page, options.puttingStyle);
  results.push({ option: 'Putting style', value: options.puttingStyle, success: result.success });
  await page.waitForTimeout(300);

  result = await selectPillOption(page, options.headWeight);
  results.push({ option: 'Head weight', value: options.headWeight, success: result.success });
  await page.waitForTimeout(300);

  await clickNextStep(page);

  // Step 2: FUNCTION (순차 선택)
  updateStatus('running', 'Step 2: FUNCTION', 'step2', 35);

  result = await selectSwatchDropdownWithCheck(page, 'Shaft', options.shaft);
  results.push({ option: 'Shaft', value: options.shaft, success: result.success });
  await page.waitForTimeout(1000);

  result = await selectDropdown(page, options.shaftLength);
  results.push({ option: 'Shaft length', value: options.shaftLength, success: result.success });
  await page.waitForTimeout(1000);

  if (options.lieAngle) {
    result = await selectDropdown(page, options.lieAngle);
    results.push({ option: 'Lie angle', value: options.lieAngle, success: result.success });
    await page.waitForTimeout(1000);
  }

  await clickNextStep(page);

  // Step 3: FORM
  updateStatus('running', 'Step 3: FORM', 'step3', 60);

  result = await selectColorSwatch(page, 'Putter color', options.putterColor);
  results.push({ option: 'Putter color', value: options.putterColor, success: result.success });
  await page.waitForTimeout(500);

  // Alignment mark (단일)
  if (options.alignmentFront || options.alignmentMark) {
    const alignValue = options.alignmentMark || options.alignmentFront;
    result = await selectSwatchDropdownWithCheck(page, 'Alignment', alignValue);
    results.push({ option: 'Alignment', value: alignValue, success: result.success });
    await page.waitForTimeout(500);
  }

  // Grip Selection
  if (options.gripSelection) {
    result = await selectSwatchDropdownWithCheck(page, 'Grip', options.gripSelection);
    results.push({ option: 'Grip Selection', value: options.gripSelection, success: result.success });
    await page.waitForTimeout(500);
  }

  // Headcover - null이면 기본 선택 유지 (선택하지 않음)
  if (options.headcover) {
    result = await selectColorSwatch(page, 'Headcover', options.headcover);
    results.push({ option: 'Headcover', value: options.headcover, success: result.success });
    await page.waitForTimeout(500);
  } else {
    // 기본 선택 유지 - 현재 선택된 값 확인만
    const currentHeadcover = await page.evaluate(() => {
      const titles = document.querySelectorAll('.avp-option-title');
      for (const title of titles) {
        if (title.textContent?.toLowerCase().includes('headcover')) {
          const text = title.textContent || '';
          if (text.includes('|')) {
            return text.split('|')[1]?.trim();
          }
        }
      }
      return 'default';
    });
    results.push({ option: 'Headcover', value: `기본값 유지 (${currentHeadcover})`, success: true });
  }

  return results;
}

// ===== LINK.1 전용 실행 =====
// LINK.1: Step 1 (Hand, Putting style)
//         Step 2 (Shaft, Length, Lie angle → Putter Color, Headcover 나타남)
//         Step 3 (Grip Selection, Alignment Mask)
async function executeLink1(page, options) {
  const results = [];

  // Step 1: FOUNDATION (Hand, Putting style만)
  updateStatus('running', 'Step 1: FOUNDATION', 'step1', 20);

  let result = await selectPillOption(page, options.hand);
  results.push({ option: 'Hand', value: options.hand, success: result.success });
  await page.waitForTimeout(300);

  result = await selectPillOption(page, options.puttingStyle);
  results.push({ option: 'Putting style', value: options.puttingStyle, success: result.success });
  await page.waitForTimeout(300);

  // LINK.1은 Head weight 옵션이 없음

  await clickNextStep(page);

  // Step 2: FUNCTION (Shaft, Shaft length, Lie angle, Putter Color, Headcover)
  updateStatus('running', 'Step 2: FUNCTION', 'step2', 35);

  result = await selectSwatchDropdownWithCheck(page, 'Shaft', options.shaft);
  results.push({ option: 'Shaft', value: options.shaft, success: result.success });
  await page.waitForTimeout(1000);

  result = await selectDropdown(page, options.shaftLength);
  results.push({ option: 'Shaft length', value: options.shaftLength, success: result.success });
  await page.waitForTimeout(1000);

  if (options.lieAngle) {
    result = await selectDropdown(page, options.lieAngle);
    results.push({ option: 'Lie angle', value: options.lieAngle, success: result.success });
    await page.waitForTimeout(1000);
  }

  // LINK.1은 Putter Color 옵션이 없음 (단일 색상 - Silver)
  results.push({ option: 'Putter color', value: options.putterColor || 'Silver (고정)', success: true });

  // Step 3로 이동
  await clickNextStep(page);

  // Step 3: FORM (Grip Selection, Alignment Mask, Headcover)
  updateStatus('running', 'Step 3: FORM', 'step3', 60);

  // Grip Selection (swatchDropdown)
  if (options.gripSelection) {
    result = await selectSwatchDropdownWithCheck(page, 'Grip selection', options.gripSelection);
    results.push({ option: 'Grip Selection', value: options.gripSelection, success: result.success });
    await page.waitForTimeout(500);
  }

  // Alignment mark (LINK.1은 단일 Alignment - swatchDropdown)
  if (options.alignmentFront) {
    result = await selectSwatchDropdownWithCheck(page, 'Alignment mark', options.alignmentFront);
    results.push({ option: 'Alignment mark', value: options.alignmentFront, success: result.success });
    await page.waitForTimeout(500);
  }

  // Headcover - 항상 기본 선택 유지
  const currentHeadcover = await page.evaluate(() => {
    const titles = document.querySelectorAll('.avp-option-title');
    for (const title of titles) {
      if (title.textContent?.toLowerCase().includes('headcover')) {
        const text = title.textContent || '';
        if (text.includes('|')) {
          return text.split('|')[1]?.trim();
        }
      }
    }
    return 'default';
  });
  results.push({ option: 'Headcover', value: `기본값 유지 (${currentHeadcover})`, success: true });

  return results;
}

// ===== 메인 실행 함수 =====
async function executeOrder(options) {
  // 이미 실행 중이면 거부
  if (isExecuting) {
    console.log('이미 주문이 실행 중입니다. 완료될 때까지 기다려주세요.');
    return { success: false, results: [], message: '이미 주문이 실행 중입니다.' };
  }

  isExecuting = true;
  let page;
  let results = [];

  try {
    updateStatus('running', '브라우저 시작 중...', 'init', 5);
    page = await initBrowser();

    updateStatus('running', '로그인 대기 중...', 'login', 10);
    await waitForManualLogin(page);

    updateStatus('running', '상품 페이지로 이동 중...', 'navigate', 15);
    const productUrl = getProductUrl(options.product);
    const productType = getProductType(options.product);

    console.log(`제품 타입: ${productType}`);
    console.log(`제품 URL: ${productUrl}`);
    console.log(`파싱된 옵션:`, JSON.stringify(options, null, 2));

    await page.goto(productUrl, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(3000);

    // 제품별 실행
    if (productType === 'mezz1-max') {
      results = await executeMezz1Max(page, options);
    } else if (productType === 'link1') {
      results = await executeLink1(page, options);
    } else if (productType === 'oz1') {
      // OZ.1 전용 (Grip Selection이 Step 3에 있음)
      results = await executeOz1(page, options);
    } else if (productType === 'oz1i') {
      // OZ.1i 일반 (OZ.1과 유사한 구조 - Grip이 Step 3)
      results = await executeOz1(page, options);
    } else if (productType === 'oz1i-hs') {
      results = await executeOz1iHs(page, options);
    } else if (productType === 'df3') {
      results = await executeDF3(page, options);
    } else {
      results = await executeOz1iHs(page, options);
    }

    // 옵션 선택 실패 체크
    const failedOptions = results.filter(r => !r.success);
    if (failedOptions.length > 0) {
      const failedList = failedOptions.map(r => `"${r.option}: ${r.value}"`).join(', ');
      const failedMsg = `옵션 선택 실패: ${failedList}`;
      console.log('\n========================================');
      console.log(`[옵션 선택 실패] 다음 옵션을 선택하지 못했습니다:`);
      failedOptions.forEach(r => {
        console.log(`  - ${r.option}: "${r.value}" (해당 옵션이 존재하지 않거나 선택할 수 없습니다)`);
      });
      console.log('========================================\n');

      // 결과 출력
      console.log('\n=== 실행 결과 ===');
      results.forEach(r => {
        console.log(`  ${r.success ? '✓' : '✗'} ${r.option}: ${r.value}`);
      });

      updateStatus('error', failedMsg, 'option_failed', 100);
      return {
        success: false,
        results,
        message: failedMsg,
        failedOptions: failedOptions.map(r => ({ option: r.option, value: r.value }))
      };
    }

    // Add to Cart
    updateStatus('running', '장바구니에 추가 중...', 'addToCart', 90);
    const cartResult = await clickAddToCart(page);
    results.push({ option: 'Add to Cart', value: 'click', success: cartResult.success });

    await page.waitForTimeout(3000);

    if (cartResult.success) {
      updateStatus('completed', '주문이 장바구니에 추가되었습니다!', 'done', 100);
    } else {
      updateStatus('error', '장바구니 추가 실패', 'error', 100);
    }

    // 결과 출력
    console.log('\n=== 실행 결과 ===');
    results.forEach(r => {
      console.log(`  ${r.success ? '✓' : '✗'} ${r.option}: ${r.value}`);
    });

    return {
      success: cartResult.success,
      results,
      message: cartResult.success ? '장바구니에 추가 완료!' : '장바구니 추가 실패'
    };

  } catch (error) {
    console.error('오류:', error.message);

    // 비활성화 옵션 에러인 경우 - 브라우저 유지, 특별 메시지 표시
    if (error instanceof DisabledOptionError) {
      const disabledMsg = `[옵션 선택 불가] "${error.optionTitle}" 항목의 "${error.optionValue}" 옵션이 비활성화되어 있어 선택할 수 없습니다. 다른 옵션을 선택해주세요.`;
      console.log('\n========================================');
      console.log(disabledMsg);
      console.log('브라우저는 열린 상태로 유지됩니다.');
      console.log('========================================\n');
      updateStatus('error', disabledMsg, 'disabled_option', 0);
      // 브라우저는 닫지 않음 - 사용자가 수동으로 수정 가능
      return { success: false, results, message: disabledMsg, disabledOption: true };
    }

    updateStatus('error', `오류 발생: ${error.message}`, 'error', 0);
    // 일반 오류 시에만 브라우저 닫기
    await closeBrowser();
    return { success: false, results, message: error.message };
  } finally {
    // 플래그만 초기화 (성공 시 브라우저는 열어둠 - 수동 주문 진행용)
    isExecuting = false;
  }
}

module.exports = {
  executeOrder,
  getStatus,
  setStatusCallback,
  updateStatus
};
