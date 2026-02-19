// 자동주문 실행 모듈 v2 - 1단계 구조 (wholesale)
const { getPage, getBrowserStatus, closeBrowser } = require('./browser');
const { getProductType } = require('./product-configs');
const { getProductUrl } = require('./parser');

// 상태 관리
let currentStatus = { status: 'idle', message: '', step: '', progress: 0 };
let statusCallback = null;
let isExecuting = false;

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
      if (text === val || text.startsWith(val + ' ') || text.startsWith(val + '(')) {
        const input = label.querySelector('input[type="radio"]');
        const isAlreadySelected = input?.checked || false;
        if (!isAlreadySelected) label.click();
        return { success: true, alreadySelected: isAlreadySelected };
      }
    }
    return { success: false };
  }, value);
}

// 드롭다운(SELECT) 선택
async function selectDropdown(page, value) {
  // 1단계: 대상 select와 매칭되는 옵션 value 찾기
  const found = await page.evaluate((val) => {
    const selects = document.querySelectorAll('select');
    let selectIndex = 0;
    for (const select of selects) {
      if (select.offsetParent === null) { selectIndex++; continue; }

      // 1. 정확한 매칭
      let option = Array.from(select.options).find(opt => opt.value === val || opt.textContent?.trim() === val);

      // 2. 부분 매칭
      if (!option) {
        option = Array.from(select.options).find(opt => {
          const text = opt.textContent?.trim() || '';
          const optVal = opt.value || '';
          return text.startsWith(val) || optVal.startsWith(val) || text.includes(val);
        });
      }

      // 3. 키워드 매칭
      if (!option) {
        const keywords = val.replace(/[()]/g, ' ').split(/[\s,.\-]+/).filter(k => k.length > 1);
        if (keywords.length >= 2) {
          option = Array.from(select.options).find(opt => {
            const text = (opt.textContent?.trim() || '').toLowerCase();
            return keywords.every(k => text.includes(k.toLowerCase()));
          });
        }
      }

      if (option) {
        return { success: true, selectIndex, optionValue: option.value, selectedText: option.textContent?.trim() };
      }
      selectIndex++;
    }
    return { success: false };
  }, value);

  if (!found.success) return { success: false };

  // 2단계: Playwright 네이티브 API로 선택 (브라우저 이벤트 완전 발생)
  try {
    const selectLocator = page.locator('select').nth(found.selectIndex);
    await selectLocator.selectOption(found.optionValue);
    return { success: true, selectedText: found.selectedText };
  } catch (e) {
    // 폴백: evaluate로 직접 선택
    await page.evaluate((args) => {
      const select = document.querySelectorAll('select')[args.idx];
      if (select) {
        select.value = args.val;
        select.dispatchEvent(new Event('change', { bubbles: true }));
      }
    }, { idx: found.selectIndex, val: found.optionValue });
    return { success: true, selectedText: found.selectedText };
  }
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

// 스와치 드롭다운 선택 (커스텀 드롭다운)
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
    const allVisibleLabels = Array.from(labels).filter(l => l.offsetParent !== null);

    const isDisabled = (label) => {
      const input = label.querySelector('input');
      if (input?.disabled) return true;
      const style = window.getComputedStyle(label);
      if (parseFloat(style.opacity) < 0.5) return true;
      if (style.pointerEvents === 'none') return true;
      if (label.classList.contains('disabled') || label.classList.contains('unavailable') || label.classList.contains('out-of-stock')) return true;
      if (label.getAttribute('aria-disabled') === 'true') return true;
      return false;
    };

    const matchesValue = (label, val) => {
      const text = label.textContent?.trim() || '';
      if (text === val) return true;
      if (text.startsWith(val) && !text.startsWith(val + val[val.length - 1])) return true;
      const keywords = val.replace(/[()]/g, ' ').split(/[\s,.-]+/).filter(k => k.length > 2);
      if (keywords.length >= 2) {
        const textLower = text.toLowerCase();
        if (keywords.every(k => textLower.includes(k.toLowerCase()))) return true;
      }
      return false;
    };

    for (const label of allVisibleLabels) {
      if (matchesValue(label, val)) {
        if (isDisabled(label)) {
          return { success: false, disabled: true, optionValue: label.textContent?.trim() };
        }
        const input = label.querySelector('input');
        if (input?.checked) {
          return { success: true, selected: label.textContent?.trim(), alreadySelected: true };
        }
        label.click();
        return { success: true, selected: label.textContent?.trim() };
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

// Add to Cart 클릭
async function clickAddToCart(page) {
  try {
    const button = page.locator('button.avis-new-addcart-button');
    await button.waitFor({ state: 'visible', timeout: 5000 });

    await page.waitForFunction(() => {
      const btn = document.querySelector('button.avis-new-addcart-button, button[name="add"]');
      return btn && !btn.disabled;
    }, { timeout: 5000 });

    const clicked = await page.evaluate(() => {
      const btn = document.querySelector('button.avis-new-addcart-button, button[name="add"]');
      if (btn && !btn.disabled) {
        btn.click();
        return true;
      }
      return false;
    });

    if (!clicked) {
      await button.click();
    }

    try {
      await page.waitForURL('**/cart**', { timeout: 10000 });
      console.log('장바구니 페이지로 이동 완료');
      return { success: true, navigated: true };
    } catch (navError) {
      console.log('장바구니 페이지로 이동하지 않음 - AJAX 방식일 수 있음');
      await page.waitForTimeout(2000);
      return { success: true, navigated: false };
    }
  } catch (e) {
    console.error('Add to Cart 오류:', e.message);
    return { success: false, error: e.message };
  }
}

// ===== 통합 옵션 선택 함수 (1단계 구조) =====
async function selectAllOptions(page, options) {
  const results = [];
  const totalOptions = 12; // 최대 옵션 수
  let currentOption = 0;

  const progressFor = () => Math.round(10 + (currentOption / totalOptions) * 70);

  // 1. Hand
  if (options.hand) {
    updateStatus('running', `옵션 선택: Hand - ${options.hand}`, 'options', progressFor());
    const result = await selectPillOption(page, options.hand);
    results.push({ option: 'Hand', value: options.hand, success: result.success });
    await page.waitForTimeout(300);
    currentOption++;
  }

  // 2. Putting Style
  if (options.puttingStyle) {
    updateStatus('running', `옵션 선택: Putting Style - ${options.puttingStyle}`, 'options', progressFor());
    const result = await selectPillOption(page, options.puttingStyle);
    results.push({ option: 'Putting Style', value: options.puttingStyle, success: result.success });
    await page.waitForTimeout(300);
    currentOption++;
  }

  // 3. Head Weight
  if (options.headWeight) {
    updateStatus('running', `옵션 선택: Head Weight - ${options.headWeight}`, 'options', progressFor());
    const result = await selectPillOption(page, options.headWeight);
    results.push({ option: 'Head Weight', value: options.headWeight, success: result.success });
    await page.waitForTimeout(300);
    currentOption++;
  }

  // 4. Shaft (스와치 드롭다운)
  if (options.shaft) {
    updateStatus('running', `옵션 선택: Shaft - ${options.shaft}`, 'options', progressFor());
    const result = await selectSwatchDropdown(page, 'Shaft', options.shaft);
    results.push({ option: 'Shaft', value: options.shaft, success: result.success });
    await page.waitForTimeout(1000);
    currentOption++;
  }

  // 4-1. Shaft Length (표준 select)
  if (options.shaftLength) {
    updateStatus('running', `옵션 선택: Shaft Length - ${options.shaftLength}`, 'options', progressFor());
    const result = await selectDropdown(page, options.shaftLength);
    results.push({ option: 'Shaft Length', value: options.shaftLength, success: result.success });
    await page.waitForTimeout(500);
    currentOption++;
  }

  // 4-2. Shaft Lean (표준 select — Grip Selection이 나타나려면 필수)
  if (options.shaftLean) {
    updateStatus('running', `옵션 선택: Shaft Lean - ${options.shaftLean}`, 'options', progressFor());
    const result = await selectDropdown(page, options.shaftLean);
    results.push({ option: 'Shaft Lean', value: options.shaftLean, success: result.success });
    await page.waitForTimeout(2000); // Shaft Lean 선택 후 옵션 로딩 대기
    currentOption++;
  }

  // 5. Lie Angle
  if (options.lieAngle) {
    updateStatus('running', `옵션 선택: Lie Angle - ${options.lieAngle}`, 'options', progressFor());
    const result = await selectDropdown(page, options.lieAngle);
    results.push({ option: 'Lie Angle', value: options.lieAngle, success: result.success });
    await page.waitForTimeout(500);
    currentOption++;
  }

  // 7. Putter Color
  if (options.putterColor) {
    updateStatus('running', `옵션 선택: Putter Color - ${options.putterColor}`, 'options', progressFor());
    const result = await selectColorSwatch(page, 'Putter color', options.putterColor);
    results.push({ option: 'Putter Color', value: options.putterColor, success: result.success });
    await page.waitForTimeout(500);
    currentOption++;
  }

  // 8. Alignment Mark (스와치 드롭다운 — Front/Back 분리)
  if (options.alignmentMark) {
    // DF3 등 단일 alignment
    updateStatus('running', `옵션 선택: Alignment Mark - ${options.alignmentMark}`, 'options', progressFor());
    const result = await selectSwatchDropdown(page, 'Alignment', options.alignmentMark);
    results.push({ option: 'Alignment Mark', value: options.alignmentMark, success: result.success });
    await page.waitForTimeout(500);
    currentOption++;
  } else if (options.alignmentFront) {
    // OZ.1i 등 Front/Back 분리 시도
    updateStatus('running', `옵션 선택: Alignment Front - ${options.alignmentFront}`, 'options', progressFor());
    let result = await selectSwatchDropdown(page, 'Alignment Mark Front', options.alignmentFront);
    // Front/Back 드롭다운이 없으면 단일 Alignment mark로 폴백 (DF3 등)
    if (!result.success) {
      result = await selectSwatchDropdown(page, 'Alignment', options.alignmentFront);
    }
    results.push({ option: 'Alignment Front', value: options.alignmentFront, success: result.success });
    await page.waitForTimeout(500);
    currentOption++;

    if (options.alignmentBack && options.alignmentBack !== '-') {
      updateStatus('running', `옵션 선택: Alignment Back - ${options.alignmentBack}`, 'options', progressFor());
      const backResult = await selectSwatchDropdown(page, 'Alignment Mark Back', options.alignmentBack);
      results.push({ option: 'Alignment Back', value: options.alignmentBack, success: backResult.success });
      await page.waitForTimeout(500);
      currentOption++;
    }
  }

  // 9. Grip Selection (스와치 드롭다운)
  if (options.gripSelection) {
    updateStatus('running', `옵션 선택: Grip Selection - ${options.gripSelection}`, 'options', progressFor());
    const result = await selectSwatchDropdown(page, 'Grip selection', options.gripSelection);
    results.push({ option: 'Grip Selection', value: options.gripSelection, success: result.success });
    await page.waitForTimeout(500);
    currentOption++;
  }

  // 10. Headcover
  if (options.headcover) {
    updateStatus('running', `옵션 선택: Headcover - ${options.headcover}`, 'options', progressFor());
    const result = await selectColorSwatch(page, 'Headcover', options.headcover);
    results.push({ option: 'Headcover', value: options.headcover, success: result.success });
    await page.waitForTimeout(500);
    currentOption++;
  }

  // 11. Player Name
  if (options.playerName) {
    updateStatus('running', `옵션 입력: Player Name - ${options.playerName}`, 'options', progressFor());
    const result = await page.evaluate((name) => {
      const inputs = document.querySelectorAll('input[type="text"]');
      for (const input of inputs) {
        const label = input.closest('.avp-option')?.querySelector('.avp-option-title');
        if (label && label.textContent.toLowerCase().includes('player name')) {
          input.value = name;
          input.dispatchEvent(new Event('input', { bubbles: true }));
          input.dispatchEvent(new Event('change', { bubbles: true }));
          return { success: true };
        }
      }
      return { success: false };
    }, options.playerName);
    results.push({ option: 'Player Name', value: options.playerName, success: result.success });
    await page.waitForTimeout(300);
    currentOption++;
  }

  return results;
}

// ===== 메인 실행 함수 =====
async function executeOrder(options) {
  if (isExecuting) {
    console.log('이미 주문이 실행 중입니다. 완료될 때까지 기다려주세요.');
    return { success: false, results: [], message: '이미 주문이 실행 중입니다.' };
  }

  isExecuting = true;
  let page;
  let results = [];

  try {
    updateStatus('running', '브라우저 상태 확인 중...', 'init', 5);

    const browserStatus = await getBrowserStatus();
    if (!browserStatus.connected) {
      throw new Error('브라우저가 연결되지 않았습니다. 먼저 "브라우저 열기"를 클릭하세요.');
    }
    page = getPage();
    if (!page) {
      throw new Error('브라우저 페이지를 가져올 수 없습니다.');
    }

    updateStatus('running', '상품 페이지로 이동 중...', 'navigate', 10);
    const productUrl = getProductUrl(options.product);
    const productType = getProductType(options.product);

    console.log(`제품 타입: ${productType}`);
    console.log(`제품 URL: ${productUrl}`);
    console.log(`파싱된 옵션:`, JSON.stringify(options, null, 2));

    await page.goto(productUrl, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(3000);

    // 1단계: 모든 옵션 선택
    results = await selectAllOptions(page, options);

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

    // Add to Cart (테스트 모드에서는 스킵)
    const TEST_MODE = true;
    let orderSuccess = false;

    if (TEST_MODE) {
      console.log('[테스트 모드] Add to Cart 스킵');
      updateStatus('completed', '[테스트] 옵션 선택 완료 (장바구니 추가 스킵)', 'done', 100);
      orderSuccess = true;
    } else {
      updateStatus('running', '장바구니에 추가 중...', 'addToCart', 90);
      const cartResult = await clickAddToCart(page);
      results.push({ option: 'Add to Cart', value: 'click', success: cartResult.success });
      orderSuccess = cartResult.success;

      await page.waitForTimeout(3000);

      if (orderSuccess) {
        updateStatus('completed', '주문이 장바구니에 추가되었습니다!', 'done', 100);
      } else {
        updateStatus('error', '장바구니 추가 실패', 'error', 100);
      }
    }

    console.log('\n=== 실행 결과 ===');
    results.forEach(r => {
      console.log(`  ${r.success ? '✓' : '✗'} ${r.option}: ${r.value}`);
    });

    return {
      success: orderSuccess,
      results,
      message: orderSuccess ? '장바구니에 추가 완료!' : '장바구니 추가 실패'
    };

  } catch (error) {
    console.error('오류:', error.message);

    if (error instanceof DisabledOptionError) {
      const disabledMsg = `[옵션 선택 불가] "${error.optionTitle}" 항목의 "${error.optionValue}" 옵션이 비활성화되어 있어 선택할 수 없습니다. 다른 옵션을 선택해주세요.`;
      console.log('\n========================================');
      console.log(disabledMsg);
      console.log('브라우저는 열린 상태로 유지됩니다.');
      console.log('========================================\n');
      updateStatus('error', disabledMsg, 'disabled_option', 0);
      return { success: false, results, message: disabledMsg, disabledOption: true };
    }

    updateStatus('error', `오류 발생: ${error.message}`, 'error', 0);
    await closeBrowser();
    return { success: false, results, message: error.message };
  } finally {
    isExecuting = false;
  }
}

module.exports = {
  executeOrder,
  getStatus,
  setStatusCallback,
  updateStatus
};
