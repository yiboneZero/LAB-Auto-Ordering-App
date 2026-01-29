const { initBrowser, closeBrowser } = require('./browser');
const { selectAllOptions } = require('./select-options');
const productOptions = require('./product-options');

async function checkMissing() {
  let page;
  try {
    page = await initBrowser();

    await page.goto(productOptions.productUrl, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(3000);

    // 옵션 선택
    await selectAllOptions(page);

    // 선택되지 않은 필수 옵션 확인
    console.log('\n=== 필수 옵션 상태 확인 ===');

    const unselectedOptions = await page.evaluate(() => {
      const results = [];

      // 모든 옵션 타이틀에서 필수(*) 표시된 것들 확인
      const optionContainers = document.querySelectorAll('.avp-option');

      for (const container of optionContainers) {
        const title = container.querySelector('.avp-option-title');
        if (!title) continue;

        const titleText = title.textContent?.trim() || '';
        if (!titleText.includes('*')) continue; // 필수 아님

        // 현재 선택된 값 확인
        const selectedValue = titleText.split('|')[1]?.trim() || '';

        // 선택되지 않은 경우 (빈 값이거나 "Select..."인 경우)
        if (!selectedValue || selectedValue.startsWith('Select') || selectedValue === '') {
          results.push({
            option: titleText.split('*')[0].trim(),
            selected: selectedValue || '(없음)',
            visible: container.offsetParent !== null
          });
        }
      }

      return results;
    });

    console.log('선택되지 않은 필수 옵션:');
    unselectedOptions.forEach(opt => {
      console.log(`  - ${opt.option}: "${opt.selected}" (visible: ${opt.visible})`);
    });

    // Add to Cart 버튼 상태
    const buttonState = await page.evaluate(() => {
      const btn = document.querySelector('button.avis-new-addcart-button');
      return {
        disabled: btn?.disabled,
        text: btn?.textContent?.trim()
      };
    });
    console.log('\nAdd to Cart 버튼 상태:', buttonState);

    console.log('\n60초 대기 (브라우저에서 직접 확인하세요)...');
    await page.waitForTimeout(60000);

  } finally {
    await closeBrowser();
  }
}

checkMissing();
