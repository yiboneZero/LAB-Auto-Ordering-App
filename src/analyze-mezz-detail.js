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

async function analyzeMezzDetail() {
  console.log('='.repeat(50));
  console.log('MEZZ.1 MAX 상세 분석 (Step by Step)');
  console.log('='.repeat(50));

  let page;

  try {
    page = await initBrowser();
    await waitForManualLogin(page);

    console.log('\n상품 페이지로 이동...');
    await page.goto('https://labgolf.com/products/mezz-1-max-custom', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(3000);

    // Step 1 선택
    console.log('\n=== Step 1 선택 ===');
    await selectPillOption(page, 'RIGHT');
    await selectPillOption(page, 'STANDARD');
    await selectPillOption(page, 'STANDARD');
    console.log('  Step 1 완료');

    // Step 2로 이동
    await page.locator('text=NEXT STEP').first().click();
    await page.waitForTimeout(2000);
    console.log('  Step 2로 이동');

    // Step 2 전체 옵션 구조 분석
    console.log('\n=== Step 2 전체 옵션 구조 ===\n');
    const step2AllOptions = await page.evaluate(() => {
      const results = [];
      const optionTitles = document.querySelectorAll('.avp-option-title');
      for (const title of optionTitles) {
        const container = title.closest('.avp-option');
        const isVisible = container?.offsetParent !== null;

        // 모든 자식 요소 타입 확인
        const childInfo = {
          swatchDropdown: container?.querySelectorAll('label.option-avis-swatch-value-label').length || 0,
          colorSwatch: container?.querySelectorAll('label.avp-productoptionswatchwrapper').length || 0,
          select: container?.querySelectorAll('select').length || 0,
          pill: container?.querySelectorAll('label.avp-pilloptioncheckwrapper').length || 0,
        };

        results.push({
          title: title.textContent?.trim().substring(0, 50),
          visible: isVisible,
          ...childInfo
        });
      }
      return results;
    });

    console.log('모든 옵션 타이틀:');
    step2AllOptions.forEach(opt => {
      const types = [];
      if (opt.swatchDropdown > 0) types.push(`스와치드롭다운(${opt.swatchDropdown})`);
      if (opt.colorSwatch > 0) types.push(`컬러스와치(${opt.colorSwatch})`);
      if (opt.select > 0) types.push(`셀렉트(${opt.select})`);
      if (opt.pill > 0) types.push(`필(${opt.pill})`);

      console.log(`  ${opt.visible ? '✓' : '✗'} ${opt.title} : ${types.join(', ') || '없음'}`);
    });

    // Shaft 드롭다운 열어보기
    console.log('\n=== Shaft 드롭다운 열기 ===');
    const shaftOpen = await page.evaluate(() => {
      const titles = document.querySelectorAll('.avp-option-title');
      for (const title of titles) {
        if (title.textContent?.includes('Shaft') && !title.textContent?.includes('length') && !title.textContent?.includes('lean')) {
          const container = title.closest('.avp-option');
          if (container?.offsetParent !== null) {
            const label = container.querySelector('label.option-avis-swatch-value-label');
            if (label) {
              label.click();
              return { clicked: true, text: label.textContent?.trim() };
            }
          }
        }
      }
      return { clicked: false };
    });
    console.log(shaftOpen.clicked ? `  클릭: "${shaftOpen.text}"` : '  클릭 실패');

    await page.waitForTimeout(1000);

    // Shaft 옵션들 확인
    const shaftOptions = await page.evaluate(() => {
      const labels = document.querySelectorAll('label.option-avis-swatch-value-label');
      const results = [];
      for (const label of labels) {
        if (label.offsetParent !== null) {
          results.push(label.textContent?.trim().substring(0, 50));
        }
      }
      return results;
    });
    console.log('Shaft 옵션들:');
    shaftOptions.forEach(o => console.log(`  - ${o}`));

    // GEARS 선택
    console.log('\n=== GEARS 샤프트 선택 ===');
    const gearsSelect = await page.evaluate(() => {
      const labels = document.querySelectorAll('label.option-avis-swatch-value-label');
      for (const label of labels) {
        if (label.offsetParent !== null && label.textContent?.includes('GEARS')) {
          label.click();
          return { success: true, text: label.textContent?.trim() };
        }
      }
      return { success: false };
    });
    console.log(gearsSelect.success ? `  선택: "${gearsSelect.text}"` : '  선택 실패');

    await page.waitForTimeout(1000);

    // Shaft 선택 후 나타나는 옵션들 확인
    console.log('\n=== Shaft 선택 후 보이는 옵션들 ===\n');
    const afterShaftOptions = await page.evaluate(() => {
      const results = [];
      const optionTitles = document.querySelectorAll('.avp-option-title');
      for (const title of optionTitles) {
        const container = title.closest('.avp-option');
        if (container?.offsetParent !== null) {
          results.push(title.textContent?.trim().substring(0, 50));
        }
      }
      return results;
    });
    afterShaftOptions.forEach(o => console.log(`  - ${o}`));

    // Step 3로 이동
    console.log('\n=== Step 3로 이동 ===');
    await page.locator('text=NEXT STEP').first().click();
    await page.waitForTimeout(2000);

    // Step 3 옵션들
    console.log('\n=== Step 3 보이는 옵션들 ===\n');
    const step3Options = await page.evaluate(() => {
      const results = [];
      const optionTitles = document.querySelectorAll('.avp-option-title');
      for (const title of optionTitles) {
        const container = title.closest('.avp-option');
        if (container?.offsetParent !== null) {
          const childInfo = {
            swatchDropdown: container.querySelectorAll('label.option-avis-swatch-value-label').length,
            colorSwatch: container.querySelectorAll('label.avp-productoptionswatchwrapper').length,
            select: container.querySelectorAll('select').length,
            pill: container.querySelectorAll('label.avp-pilloptioncheckwrapper').length,
          };
          results.push({
            title: title.textContent?.trim().substring(0, 50),
            ...childInfo
          });
        }
      }
      return results;
    });
    step3Options.forEach(opt => {
      const types = [];
      if (opt.swatchDropdown > 0) types.push(`스와치드롭다운(${opt.swatchDropdown})`);
      if (opt.colorSwatch > 0) types.push(`컬러스와치(${opt.colorSwatch})`);
      if (opt.select > 0) types.push(`셀렉트(${opt.select})`);
      if (opt.pill > 0) types.push(`필(${opt.pill})`);
      console.log(`  ${opt.title} : ${types.join(', ') || '없음'}`);
    });

    console.log('\n30초 대기...');
    await page.waitForTimeout(30000);

  } catch (error) {
    console.error('오류:', error.message);
  } finally {
    await closeBrowser();
  }
}

analyzeMezzDetail();
