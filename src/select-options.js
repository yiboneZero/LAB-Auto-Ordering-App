const productOptions = require('./product-options');

// 라디오 버튼 선택 - label 클릭 방식
async function selectRadioByLabel(page, name, value) {
  try {
    // 해당 옵션의 라벨을 찾아서 클릭
    const clicked = await page.evaluate((args) => {
      const { name, value } = args;

      // input 찾기
      const input = document.querySelector(`input[type="radio"][name="${name}"][value="${value}"]`);
      if (!input) return false;

      // 부모 label 찾기
      let label = input.closest('label');
      if (!label) {
        // label이 input을 감싸고 있지 않으면, 같은 레벨의 label 찾기
        const parent = input.parentElement;
        if (parent) {
          label = parent.querySelector('label') || parent;
        }
      }

      if (label) {
        // 스크롤하여 보이게 함
        label.scrollIntoView({ behavior: 'instant', block: 'center' });
        return { found: true, labelText: label.textContent?.trim().substring(0, 30) };
      }

      return { found: true, labelText: null };
    }, { name, value });

    if (clicked && clicked.found) {
      // Playwright로 실제 클릭 (좌표 기반)
      const selector = `input[type="radio"][name="${name}"][value="${value}"]`;
      const input = await page.$(selector);
      if (input) {
        // input의 부모 label이나 wrapper 클릭
        const box = await input.boundingBox();
        if (box) {
          await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
          return true;
        }
        // boundingBox가 없으면 force click
        await input.evaluate(el => el.click());
        return true;
      }
    }
    return false;
  } catch (error) {
    return false;
  }
}

// 스와치 옵션 선택 - label 텍스트로 찾아서 클릭
async function selectSwatchByText(page, searchText) {
  try {
    const labels = await page.$$('label.option-avis-swatch-value-label');
    for (const label of labels) {
      const text = await label.textContent();
      if (text && text.includes(searchText)) {
        const isVisible = await label.isVisible();
        if (isVisible) {
          await label.click();
          return true;
        }
      }
    }

    // label로 못 찾으면 input value로 시도
    const inputs = await page.$$('input[type="radio"]');
    for (const input of inputs) {
      const value = await input.getAttribute('value');
      if (value && value.includes(searchText)) {
        await input.evaluate(el => {
          el.click();
          el.checked = true;
          el.dispatchEvent(new Event('change', { bubbles: true }));
        });
        return true;
      }
    }
    return false;
  } catch (error) {
    return false;
  }
}

// 드롭다운 선택
async function selectDropdown(page, value) {
  try {
    const selected = await page.evaluate((val) => {
      const selects = document.querySelectorAll('select');
      let found = false;
      for (const select of selects) {
        // 보이는 select만
        if (select.offsetParent === null) continue;

        const hasOption = Array.from(select.options).some(opt => opt.value === val);
        if (hasOption) {
          select.value = val;
          select.dispatchEvent(new Event('change', { bubbles: true }));
          found = true;
          break; // 첫 번째 visible select만
        }
      }
      return found;
    }, value);
    return selected;
  } catch (error) {
    return false;
  }
}

async function selectAllOptions(page) {
  console.log('옵션 선택 시작...');
  await page.waitForTimeout(3000);

  // 1. Hand 선택
  console.log('\n[1. Hand 선택]');
  const handValue = productOptions.radioOptions['Hand'];
  const handClicked = await page.evaluate((value) => {
    const labels = document.querySelectorAll('label.avp-pilloptioncheckwrapper');
    for (const label of labels) {
      if (label.textContent?.trim() === value) {
        label.click();
        return true;
      }
    }
    return false;
  }, handValue);
  console.log(handClicked ? `  ✓ Hand: ${handValue}` : `  ✗ Hand: ${handValue}`);
  await page.waitForTimeout(800);

  // 2. Putting style 선택
  console.log('\n[2. Putting style 선택]');
  const puttingValue = productOptions.radioOptions['Putting style'];
  const puttingClicked = await page.evaluate((value) => {
    const labels = document.querySelectorAll('label.avp-pilloptioncheckwrapper');
    for (const label of labels) {
      if (label.textContent?.trim() === value) {
        label.click();
        return true;
      }
    }
    return false;
  }, puttingValue);
  console.log(puttingClicked ? `  ✓ Putting style: ${puttingValue}` : `  ✗ Putting style: ${puttingValue}`);
  await page.waitForTimeout(800);

  // 3. Head weight 선택
  console.log('\n[3. Head weight 선택]');
  const headWeightValue = productOptions.radioOptions['Head weight'];
  const headWeightClicked = await page.evaluate((value) => {
    const labels = document.querySelectorAll('label.avp-pilloptioncheckwrapper');
    for (const label of labels) {
      if (label.textContent?.trim() === value) {
        label.click();
        return true;
      }
    }
    return false;
  }, headWeightValue);
  console.log(headWeightClicked ? `  ✓ Head weight: ${headWeightValue}` : `  ✗ Head weight: ${headWeightValue}`);
  await page.waitForTimeout(800);

  // 4. Riser 선택 (드롭다운)
  console.log('\n[4. Riser 선택]');
  const riserValue = productOptions.selectOptions['Riser'];
  const riserSelected = await selectDropdown(page, riserValue);
  console.log(riserSelected ? `  ✓ Riser: ${riserValue}` : `  ✗ Riser: ${riserValue}`);
  await page.waitForTimeout(500);

  // 5. Lie angle 선택 (드롭다운)
  console.log('\n[5. Lie angle 선택]');
  const lieValue = productOptions.selectOptions['Lie angle'];
  const lieSelected = await selectDropdown(page, lieValue);
  console.log(lieSelected ? `  ✓ Lie angle: ${lieValue}` : `  ✗ Lie angle: ${lieValue}`);
  await page.waitForTimeout(500);

  // 6. Shaft 선택 (스와치)
  console.log('\n[6. Shaft 선택]');
  const shaftValue = productOptions.radioOptions['Shaft'];
  const shaftSelected = await selectSwatchByText(page, shaftValue);
  console.log(shaftSelected ? `  ✓ Shaft: ${shaftValue}` : `  ✗ Shaft: ${shaftValue}`);
  await page.waitForTimeout(800);

  // 7. Shaft length 선택 (드롭다운)
  console.log('\n[7. Shaft length 선택]');
  const shaftLengthValue = productOptions.selectOptions['Shaft length'];
  const shaftLengthSelected = await selectDropdown(page, shaftLengthValue);
  console.log(shaftLengthSelected ? `  ✓ Shaft length: ${shaftLengthValue}` : `  ✗ Shaft length: ${shaftLengthValue}`);
  await page.waitForTimeout(500);

  // 8. Shaft lean 선택 (드롭다운)
  console.log('\n[8. Shaft lean 선택]');
  const shaftLeanValue = productOptions.selectOptions['Shaft lean'];
  const shaftLeanSelected = await selectDropdown(page, shaftLeanValue);
  console.log(shaftLeanSelected ? `  ✓ Shaft lean: ${shaftLeanValue}` : `  ✗ Shaft lean: ${shaftLeanValue}`);
  await page.waitForTimeout(500);

  // 9. Putter color 선택 (스와치/라벨 클릭)
  console.log('\n[9. Putter color 선택]');
  const putterColorValue = productOptions.putterColor;
  const colorClicked = await page.evaluate((value) => {
    // 색상 이름만 추출 (OZ.1i HS - Red -> Red)
    const colorName = value.split(' - ')[1] || value;

    // 스와치 라벨 찾기
    const labels = document.querySelectorAll('label');
    for (const label of labels) {
      const input = label.querySelector('input[type="radio"]');
      if (input && input.value === value) {
        label.click();
        return true;
      }
    }

    // input 직접 클릭
    const inputs = document.querySelectorAll(`input[type="radio"][value="${value}"]`);
    for (const input of inputs) {
      if (input.offsetParent !== null || input.closest('label')) {
        input.click();
        input.checked = true;
        input.dispatchEvent(new Event('change', { bubbles: true }));
        return true;
      }
    }
    return false;
  }, putterColorValue);
  console.log(colorClicked ? `  ✓ Putter color: ${putterColorValue}` : `  ✗ Putter color: ${putterColorValue}`);
  await page.waitForTimeout(500);

  // 10. Insert 선택 (드롭다운)
  console.log('\n[10. Insert 선택]');
  const insertValue = productOptions.selectOptions['Insert'];
  const insertSelected = await selectDropdown(page, insertValue);
  console.log(insertSelected ? `  ✓ Insert: ${insertValue}` : `  ✗ Insert: ${insertValue}`);
  await page.waitForTimeout(500);

  // 11. Alignment Mark Front 선택 (스와치)
  console.log('\n[11. Alignment Mark Front 선택]');
  const alignFrontValue = productOptions.radioOptions['Alignment Mark Front'];
  const alignFrontSelected = await selectSwatchByText(page, alignFrontValue);
  console.log(alignFrontSelected ? `  ✓ Alignment Front: ${alignFrontValue}` : `  ✗ Alignment Front: ${alignFrontValue}`);
  await page.waitForTimeout(500);

  // 12. Alignment Mark Back 선택 (스와치)
  console.log('\n[12. Alignment Mark Back 선택]');
  const alignBackValue = productOptions.radioOptions['Alignment Mark Back'];
  const alignBackSelected = await selectSwatchByText(page, alignBackValue);
  console.log(alignBackSelected ? `  ✓ Alignment Back: ${alignBackValue}` : `  ✗ Alignment Back: ${alignBackValue}`);
  await page.waitForTimeout(500);

  // 13. Grip Selection (스와치)
  console.log('\n[13. Grip 선택]');
  const gripValue = productOptions.gripSelection;
  const gripSelected = await selectSwatchByText(page, gripValue);
  console.log(gripSelected ? `  ✓ Grip: ${gripValue}` : `  ✗ Grip: ${gripValue}`);
  await page.waitForTimeout(500);

  // 14. Headcover selection
  console.log('\n[14. Headcover 선택]');
  const headcoverValue = productOptions.radioOptions['Headcover selection'];
  const headcoverClicked = await page.evaluate((value) => {
    const inputs = document.querySelectorAll(`input[type="radio"][value="${value}"]`);
    for (const input of inputs) {
      const label = input.closest('label');
      if (label) {
        label.click();
        return true;
      }
      input.click();
      return true;
    }
    return false;
  }, headcoverValue);
  console.log(headcoverClicked ? `  ✓ Headcover: ${headcoverValue}` : `  ✗ Headcover: ${headcoverValue}`);
  await page.waitForTimeout(500);

  // 15. Putter build time
  console.log('\n[15. Build time 선택]');
  const buildTimeValue = productOptions.radioOptions['Putter build time'];
  const buildTimeClicked = await page.evaluate((value) => {
    const labels = document.querySelectorAll('label.avp-pilloptioncheckwrapper');
    for (const label of labels) {
      if (label.textContent?.trim() === value) {
        label.click();
        return true;
      }
    }
    return false;
  }, buildTimeValue);
  console.log(buildTimeClicked ? `  ✓ Build time: ${buildTimeValue}` : `  ✗ Build time: ${buildTimeValue}`);
  await page.waitForTimeout(500);

  console.log('\n옵션 선택 완료');
  await page.waitForTimeout(1000);
}

async function clickAddToCart(page) {
  console.log('\n[Add to Cart 클릭]');

  try {
    const clicked = await page.evaluate(() => {
      const button = document.querySelector('button.avis-new-addcart-button, button[name="add"]');
      if (button && !button.disabled) {
        button.click();
        return true;
      }
      if (button) {
        return 'disabled';
      }
      return false;
    });

    if (clicked === true) {
      console.log('  ✓ Add to Cart 버튼 클릭 완료');
      await page.waitForTimeout(3000);
      return true;
    } else if (clicked === 'disabled') {
      console.log('  ⚠ Add to Cart 버튼이 비활성화 상태입니다.');
      return false;
    } else {
      console.log('  ✗ Add to Cart 버튼을 찾을 수 없음');
      return false;
    }
  } catch (error) {
    console.log(`  ✗ Add to Cart 실패: ${error.message}`);
    return false;
  }
}

module.exports = {
  selectAllOptions,
  clickAddToCart,
};
