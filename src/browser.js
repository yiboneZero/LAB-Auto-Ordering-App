const { chromium } = require('playwright');
const config = require('./config');
const path = require('path');
const os = require('os');

let browser = null;
let context = null;
let page = null;

async function initBrowser() {
  console.log('브라우저 시작 중...');

  // 기존 브라우저가 열려있으면 재사용 시도
  if (context && page) {
    try {
      // 페이지가 아직 유효한지 확인
      await page.evaluate(() => true);
      console.log('기존 브라우저 재사용');
      return page;
    } catch (e) {
      // 브라우저가 닫혔으면 전역 변수 초기화
      console.log('기존 브라우저가 닫혀있어 새로 시작합니다.');
      browser = null;
      context = null;
      page = null;
    }
  }

  // 실제 Chrome 브라우저 경로
  const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

  // 사용자 데이터 디렉토리 (로그인 세션 유지용)
  const userDataDir = path.join(os.homedir(), 'LabGolfAutoOrder_ChromeData');

  // 실제 Chrome을 persistent context로 실행 (봇 감지 우회)
  context = await chromium.launchPersistentContext(userDataDir, {
    headless: false, // 반드시 보이게
    executablePath: chromePath,
    channel: 'chrome', // 시스템에 설치된 Chrome 사용
    args: [
      '--disable-blink-features=AutomationControlled',
      '--no-sandbox',
      '--disable-web-security',
      '--disable-features=IsolateOrigins,site-per-process',
    ],
    ignoreDefaultArgs: ['--enable-automation'],
    viewport: { width: 1280, height: 720 },
  });

  page = context.pages()[0] || await context.newPage();

  console.log('브라우저 시작 완료 (실제 Chrome 사용)');
  return page;
}

async function closeBrowser() {
  if (context) {
    try {
      await context.close();
      console.log('브라우저 종료');
    } catch (e) {
      // 이미 닫힌 경우 무시
    }
  }
  // 전역 변수 초기화 - 다음 주문 시 새 브라우저 시작 가능하도록
  browser = null;
  context = null;
  page = null;
}

function getPage() {
  return page;
}

module.exports = {
  initBrowser,
  closeBrowser,
  getPage,
};
