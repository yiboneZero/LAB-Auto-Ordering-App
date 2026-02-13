// 현재 열려있는 페이지의 옵션 UI 구조 분석
const { chromium } = require('playwright');

const CDP_PORT = 9222;

async function analyze() {
  const browser = await chromium.connectOverCDP(`http://localhost:${CDP_PORT}`);
  const contexts = browser.contexts();
  const context = contexts[0];
  const pages = context.pages();
  const page = pages[0];

  console.log('현재 URL:', page.url());
  console.log('');

  // 모든 옵션 영역 분석
  const result = await page.evaluate(() => {
    const options = [];

    // 1. 표준 <select> 태그들
    const selects = document.querySelectorAll('select');
    for (const select of selects) {
      if (select.offsetParent === null) continue;
      const label = select.closest('.avp-option')?.querySelector('.avp-option-title')?.textContent?.trim();
      const opts = Array.from(select.options).map(o => o.textContent?.trim()).filter(t => t);
      options.push({
        type: 'select',
        label: label || select.name || '(unknown)',
        optionCount: opts.length,
        options: opts.slice(0, 10), // 최대 10개만
        visible: true
      });
    }

    // 2. Pill 버튼들
    const pillLabels = document.querySelectorAll('label.avp-pilloptioncheckwrapper');
    const pillGroups = {};
    for (const label of pillLabels) {
      if (label.offsetParent === null) continue;
      const container = label.closest('.avp-option');
      const title = container?.querySelector('.avp-option-title')?.textContent?.trim() || '(unknown)';
      if (!pillGroups[title]) pillGroups[title] = [];
      pillGroups[title].push(label.textContent?.trim());
    }
    for (const [title, vals] of Object.entries(pillGroups)) {
      options.push({ type: 'pill', label: title, options: vals });
    }

    // 3. 스와치 드롭다운 (커스텀 드롭다운)
    const swatchLabels = document.querySelectorAll('label.option-avis-swatch-value-label');
    const swatchGroups = {};
    for (const label of swatchLabels) {
      const container = label.closest('.avp-option');
      const title = container?.querySelector('.avp-option-title')?.textContent?.trim() || '(unknown)';
      if (!swatchGroups[title]) swatchGroups[title] = [];
      const text = label.textContent?.trim();
      const input = label.querySelector('input');
      const disabled = input?.disabled || false;
      swatchGroups[title].push({ text: text?.substring(0, 60), disabled });
    }
    for (const [title, vals] of Object.entries(swatchGroups)) {
      options.push({ type: 'swatchDropdown', label: title, optionCount: vals.length, options: vals.slice(0, 10) });
    }

    // 4. 색상 스와치
    const colorSwatches = document.querySelectorAll('label.avp-productoptionswatchwrapper');
    const colorGroups = {};
    for (const label of colorSwatches) {
      if (label.offsetParent === null) continue;
      const container = label.closest('.avp-option');
      const title = container?.querySelector('.avp-option-title')?.textContent?.trim() || '(unknown)';
      if (!colorGroups[title]) colorGroups[title] = [];
      colorGroups[title].push(label.textContent?.trim()?.substring(0, 40));
    }
    for (const [title, vals] of Object.entries(colorGroups)) {
      options.push({ type: 'colorSwatch', label: title, options: vals });
    }

    return options;
  });

  console.log('=== 페이지 옵션 UI 구조 ===');
  for (const opt of result) {
    console.log(`\n[${opt.type}] ${opt.label}`);
    if (opt.options) {
      opt.options.forEach((o, i) => {
        const text = typeof o === 'string' ? o : `${o.text}${o.disabled ? ' (disabled)' : ''}`;
        console.log(`  ${i + 1}. ${text}`);
      });
    }
  }

  await browser.close();
}

analyze().catch(console.error);
