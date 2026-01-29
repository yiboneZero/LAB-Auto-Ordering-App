const { initBrowser, closeBrowser } = require('./browser');

async function analyzeAllOptions() {
  console.log('='.repeat(50));
  console.log('모든 옵션 요소 상세 분석');
  console.log('='.repeat(50));

  let page;

  try {
    page = await initBrowser();

    const productUrl = 'https://labgolf.com/products/oz1i-hs-custom';
    console.log(`페이지 로딩: ${productUrl}`);
    await page.goto(productUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(5000);

    // 모든 라디오 버튼 (name과 value)
    console.log('\n=== 모든 RADIO 버튼 ===');
    const radios = await page.$$eval('input[type="radio"]', elements =>
      elements.map(el => ({
        name: el.name,
        value: el.value,
        id: el.id,
        checked: el.checked,
        visible: el.offsetParent !== null
      }))
    );
    radios.forEach(r => {
      if (r.name) console.log(`[${r.checked ? 'X' : ' '}] name="${r.name}" value="${r.value}"`);
    });

    // 모든 SELECT 요소
    console.log('\n=== 모든 SELECT 요소 ===');
    const selects = await page.$$eval('select', elements =>
      elements.map(el => {
        const label = el.closest('.avp-option')?.querySelector('.avp-option-title')?.textContent?.trim() || el.name || el.id;
        return {
          id: el.id,
          name: el.name,
          label: label,
          options: Array.from(el.options).map(o => o.value).filter(v => v)
        };
      })
    );
    selects.forEach(s => {
      console.log(`\n[${s.label || s.name || s.id}]`);
      console.log(`  id: ${s.id}`);
      console.log(`  options: ${s.options.join(', ')}`);
    });

    // 옵션 타이틀들 (avp-option-title 클래스)
    console.log('\n=== 옵션 타이틀 목록 ===');
    const titles = await page.$$eval('.avp-option-title', elements =>
      elements.map(el => el.textContent.trim())
    );
    titles.forEach(t => console.log(`- ${t}`));

    // Grip 관련 요소 찾기
    console.log('\n=== Grip 관련 요소 ===');
    const gripElements = await page.$$eval('[class*="grip"], [id*="grip"], label:has-text("Grip"), [data-option*="grip"]', elements =>
      elements.map(el => ({
        tag: el.tagName,
        class: el.className,
        id: el.id,
        text: el.textContent?.trim().substring(0, 100)
      }))
    );
    gripElements.forEach(g => console.log(g));

    // Alignment 관련 요소
    console.log('\n=== Alignment 관련 요소 ===');
    const alignElements = await page.$$eval('*', elements =>
      elements.filter(el =>
        el.textContent?.toLowerCase().includes('alignment') ||
        el.className?.toLowerCase().includes('alignment')
      ).slice(0, 10).map(el => ({
        tag: el.tagName,
        class: el.className?.substring(0, 50),
        text: el.textContent?.trim().substring(0, 80)
      }))
    );
    alignElements.forEach(a => console.log(a));

    console.log('\n\n60초 후 브라우저 종료...');
    await page.waitForTimeout(60000);

  } catch (error) {
    console.error('오류:', error.message);
  } finally {
    await closeBrowser();
  }
}

analyzeAllOptions().catch(console.error);
