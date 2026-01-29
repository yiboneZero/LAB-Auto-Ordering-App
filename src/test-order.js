const { initBrowser, closeBrowser } = require('./browser');
const { waitForManualLogin } = require('./login');
const { selectAllOptions, clickAddToCart } = require('./select-options');
const productOptions = require('./product-options');

async function testOrder() {
  console.log('='.repeat(50));
  console.log('LabGolf 자동주문 테스트');
  console.log('='.repeat(50));

  let page;

  try {
    page = await initBrowser();

    // 수동 로그인 대기
    const loginSuccess = await waitForManualLogin(page);
    if (!loginSuccess) {
      console.error('로그인에 실패했습니다.');
      return;
    }

    // 상품 페이지로 이동
    console.log(`\n상품 페이지로 이동: ${productOptions.productUrl}`);
    await page.goto(productOptions.productUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });

    // 옵션 선택
    await selectAllOptions(page);

    // Add to Cart
    const cartSuccess = await clickAddToCart(page);

    if (cartSuccess) {
      console.log('\n='.repeat(50));
      console.log('장바구니 담기 완료!');
      console.log('브라우저에서 결과를 확인하세요.');
      console.log('='.repeat(50));
    }

    // 결과 확인을 위해 60초 대기
    console.log('\n60초 후 브라우저가 종료됩니다...');
    await page.waitForTimeout(60000);

  } catch (error) {
    console.error('오류 발생:', error.message);
    if (page) {
      console.log('30초 후 브라우저가 종료됩니다...');
      await page.waitForTimeout(30000);
    }
  } finally {
    await closeBrowser();
  }
}

testOrder().catch(console.error);
