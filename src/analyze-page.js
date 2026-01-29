const { initBrowser, closeBrowser } = require('./browser');

async function analyzePage() {
  console.log('='.repeat(50));
  console.log('상품 페이지 구조 분석');
  console.log('='.repeat(50));

  let page;

  try {
    page = await initBrowser();

    // 상품 페이지로 이동
    const productUrl = 'https://labgolf.com/products/oz1i-hs-custom';
    console.log(`페이지 로딩: ${productUrl}`);
    await page.goto(productUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });

    // 페이지 로딩 대기
    await page.waitForTimeout(3000);

    // 옵션 관련 요소 분석
    console.log('\n=== 옵션 선택 요소 분석 ===\n');

    // select 요소들
    const selects = await page.$$eval('select', elements =>
      elements.map(el => ({
        id: el.id,
        name: el.name,
        class: el.className,
        options: Array.from(el.options).map(o => ({ value: o.value, text: o.text }))
      }))
    );
    console.log('SELECT 요소:', JSON.stringify(selects, null, 2));

    // label 요소들 (옵션명)
    const labels = await page.$$eval('label', elements =>
      elements.slice(0, 20).map(el => ({
        for: el.htmlFor,
        text: el.textContent.trim().substring(0, 50),
        class: el.className
      }))
    );
    console.log('\nLABEL 요소 (상위 20개):', JSON.stringify(labels, null, 2));

    // Add to Cart 버튼
    const addToCartButtons = await page.$$eval('button', elements =>
      elements.filter(el =>
        el.textContent.toLowerCase().includes('add') ||
        el.textContent.toLowerCase().includes('cart') ||
        el.className.toLowerCase().includes('cart')
      ).map(el => ({
        text: el.textContent.trim().substring(0, 50),
        class: el.className,
        id: el.id,
        type: el.type,
        name: el.name
      }))
    );
    console.log('\nAdd to Cart 버튼:', JSON.stringify(addToCartButtons, null, 2));

    // 라디오 버튼들 (옵션 선택용)
    const radios = await page.$$eval('input[type="radio"]', elements =>
      elements.slice(0, 30).map(el => ({
        name: el.name,
        value: el.value,
        id: el.id,
        checked: el.checked
      }))
    );
    console.log('\nRADIO 버튼 (상위 30개):', JSON.stringify(radios, null, 2));

    // 드롭다운/커스텀 셀렉트 요소 확인
    const customSelects = await page.$$eval('[class*="option"], [class*="select"], [class*="dropdown"]', elements =>
      elements.slice(0, 20).map(el => ({
        tag: el.tagName,
        class: el.className,
        id: el.id,
        text: el.textContent.trim().substring(0, 100)
      }))
    );
    console.log('\n커스텀 셀렉트 요소 (상위 20개):', JSON.stringify(customSelects, null, 2));

    console.log('\n분석 완료. 60초 후 브라우저가 종료됩니다...');
    console.log('브라우저에서 직접 요소를 확인해보세요.');
    await page.waitForTimeout(60000);

  } catch (error) {
    console.error('오류 발생:', error.message);
  } finally {
    await closeBrowser();
  }
}

analyzePage().catch(console.error);
