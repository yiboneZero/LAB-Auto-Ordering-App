const config = require('./config');

async function waitForManualLogin(page) {
  console.log('로그인 페이지로 이동 중...');

  await page.goto(config.loginUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });

  console.log('');
  console.log('========================================');
  console.log('브라우저에서 직접 로그인해주세요.');
  console.log('로그인 완료 후 자동으로 진행됩니다.');
  console.log('(최대 3분 대기)');
  console.log('========================================');
  console.log('');

  // 로그인 성공 (account 페이지로 이동) 대기 - 최대 3분
  await page.waitForURL('**/account**', { timeout: 180000 });

  console.log('로그인 확인됨! 자동 주문을 시작합니다.');
  return true;
}

async function isLoggedIn(page) {
  await page.goto(config.accountUrl, { waitUntil: 'networkidle' });
  const currentUrl = page.url();
  return !currentUrl.includes('/login');
}

module.exports = {
  waitForManualLogin,
  isLoggedIn,
};
