const { initBrowser, closeBrowser } = require('./browser');
const { waitForManualLogin } = require('./login');
const { addToCart, goToCheckout } = require('./order');
const config = require('./config');

async function main() {
  console.log('='.repeat(50));
  console.log('LabGolf 자동주문 프로그램 시작');
  console.log('='.repeat(50));

  // 설정 확인
  if (config.productUrls.length === 0) {
    console.error('오류: .env 파일에 주문할 상품 URL을 설정해주세요.');
    process.exit(1);
  }

  let page;

  try {
    // 브라우저 초기화
    page = await initBrowser();

    // 수동 로그인 대기
    const loginSuccess = await waitForManualLogin(page);
    if (!loginSuccess) {
      console.error('로그인에 실패했습니다.');
      return;
    }

    // 각 상품을 장바구니에 추가
    for (const productUrl of config.productUrls) {
      try {
        await addToCart(page, productUrl);
      } catch (error) {
        console.error(`상품 추가 실패 (${productUrl}):`, error.message);
      }
    }

    // 체크아웃 진행
    await goToCheckout(page);

    console.log('='.repeat(50));
    console.log('체크아웃 페이지에 도착했습니다.');
    console.log('결제 정보를 확인하고 수동으로 주문을 완료해주세요.');
    console.log('='.repeat(50));

    // 사용자가 수동으로 결제할 수 있도록 30초 대기
    console.log('30초 후 브라우저가 종료됩니다...');
    await page.waitForTimeout(30000);

  } catch (error) {
    console.error('오류 발생:', error.message);
  } finally {
    await closeBrowser();
  }
}

// 프로그램 실행
main().catch(console.error);
