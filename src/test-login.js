const { initBrowser, closeBrowser } = require('./browser');
const { waitForManualLogin } = require('./login');

async function testLogin() {
  console.log('='.repeat(50));
  console.log('LabGolf 로그인 테스트 (수동 로그인)');
  console.log('='.repeat(50));

  let page;

  try {
    page = await initBrowser();

    const loginSuccess = await waitForManualLogin(page);

    if (loginSuccess) {
      console.log('='.repeat(50));
      console.log('로그인 테스트 성공!');
      console.log('='.repeat(50));
    } else {
      console.log('='.repeat(50));
      console.log('로그인 테스트 실패');
      console.log('='.repeat(50));
    }

    // 결과 확인을 위해 10초 대기
    console.log('10초 후 브라우저가 종료됩니다...');
    await page.waitForTimeout(10000);

  } catch (error) {
    console.error('오류 발생:', error.message);
  } finally {
    await closeBrowser();
  }
}

testLogin().catch(console.error);
