const { chromium } = require('playwright');
const config = require('./config');
const path = require('path');
const os = require('os');
const { execSync, spawn } = require('child_process');

let browser = null;
let context = null;
let page = null;
let isRecovering = false; // 동시 재연결 방지 락

// CDP 연결 모드 사용 여부
const USE_CDP_MODE = true;
const CDP_PORT = 9222;

async function initBrowser() {
  console.log('브라우저 시작 중...');

  // 기존 브라우저가 열려있으면 재사용 시도
  if (browser && page) {
    try {
      await page.evaluate(() => true);
      console.log('기존 브라우저 재사용');
      return page;
    } catch (e) {
      console.log('기존 브라우저가 닫혀있어 새로 시작합니다.');
      browser = null;
      context = null;
      page = null;
    }
  }

  if (USE_CDP_MODE) {
    // CDP 모드: 일반 Chrome에 연결
    return await initBrowserCDP();
  } else {
    // 기존 모드: Playwright가 Chrome 실행
    return await initBrowserPlaywright();
  }
}

// CDP 모드: 일반 Chrome을 별도 프로필로 실행하고 연결
async function initBrowserCDP() {
  const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
  // 별도의 프로필 디렉토리 사용 (기존 Chrome과 충돌 방지)
  const userDataDir = path.join(os.homedir(), 'LabGolfAutoOrder_CDP_Chrome');

  // Chrome이 이미 디버깅 포트로 실행 중인지 확인
  let needToLaunch = true;
  try {
    browser = await chromium.connectOverCDP(`http://localhost:${CDP_PORT}`);
    console.log('기존 Chrome 브라우저에 연결됨');
    needToLaunch = false;
  } catch (e) {
    console.log('Chrome 디버깅 포트에 연결 실패, 새로 시작합니다...');
  }

  if (needToLaunch) {
    // Chrome을 디버깅 모드로 실행
    console.log('Chrome을 디버깅 모드로 시작 중...');
    console.log(`프로필 경로: ${userDataDir}`);

    const chromeProcess = spawn(chromePath, [
      `--remote-debugging-port=${CDP_PORT}`,
      `--user-data-dir=${userDataDir}`,
      '--no-first-run',
      '--no-default-browser-check',
      '--disable-background-networking',
      '--disable-client-side-phishing-detection',
      '--disable-default-apps',
      '--disable-extensions',
      '--disable-hang-monitor',
      '--disable-popup-blocking',
      '--disable-prompt-on-repost',
      '--disable-sync',
      '--disable-translate',
      '--metrics-recording-only',
      '--safebrowsing-disable-auto-update',
    ], {
      detached: true,
      stdio: 'ignore'
    });
    chromeProcess.unref();

    // Chrome이 시작될 때까지 대기 (최대 10초)
    let connected = false;
    for (let i = 0; i < 10; i++) {
      await new Promise(resolve => setTimeout(resolve, 1000));
      try {
        browser = await chromium.connectOverCDP(`http://localhost:${CDP_PORT}`);
        console.log('Chrome 브라우저에 연결 완료');
        connected = true;
        break;
      } catch (e) {
        console.log(`연결 시도 ${i + 1}/10...`);
      }
    }

    if (!connected) {
      throw new Error('Chrome 연결 실패. 포트 9222가 사용 중인지 확인하세요.');
    }
  }

  // 기존 context와 page 가져오기
  const contexts = browser.contexts();
  context = contexts[0] || await browser.newContext();

  const pages = context.pages();
  page = pages[0] || await context.newPage();

  console.log('브라우저 시작 완료 (CDP 연결 - 일반 Chrome)');
  return page;
}

// 기존 Playwright 모드
async function initBrowserPlaywright() {
  const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
  const userDataDir = path.join(os.homedir(), 'LabGolfAutoOrder_ChromeData');

  context = await chromium.launchPersistentContext(userDataDir, {
    headless: false,
    executablePath: chromePath,
    channel: 'chrome',
    args: [
      '--disable-blink-features=AutomationControlled',
      '--no-sandbox',
      '--disable-infobars',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--no-first-run',
      '--no-zygote',
      '--disable-gpu',
    ],
    ignoreDefaultArgs: ['--enable-automation', '--enable-blink-features=AutomationControlled'],
    viewport: { width: 1280, height: 720 },
  });

  const pages = context.pages();
  for (const p of pages) {
    await p.addInitScript(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => false });
    });
  }

  page = context.pages()[0] || await context.newPage();
  console.log('브라우저 시작 완료 (Playwright 모드)');
  return page;
}

async function closeBrowser() {
  if (USE_CDP_MODE) {
    // CDP 모드: 브라우저를 닫지 않고 연결만 해제
    if (browser) {
      try {
        await browser.close(); // CDP에서는 disconnect 역할
        console.log('Chrome 연결 해제 (브라우저는 유지됨)');
      } catch (e) {
        // 이미 연결이 끊긴 경우 무시
      }
    }
  } else {
    // Playwright 모드: context 종료
    if (context) {
      try {
        await context.close();
        console.log('브라우저 종료');
      } catch (e) {
        // 이미 닫힌 경우 무시
      }
    }
  }
  // 전역 변수 초기화 - 다음 주문 시 새 연결 가능하도록
  browser = null;
  context = null;
  page = null;
}

function getPage() {
  return page;
}

// 브라우저 연결 상태 확인
function isBrowserConnected() {
  return browser !== null && page !== null;
}

// 브라우저 상태 확인 (연결 유효성 포함)
async function getBrowserStatus() {
  // browser 자체가 없으면 연결 안됨
  if (!browser) {
    return { connected: false, loggedIn: false };
  }

  // page가 없거나 유효하지 않으면 다시 잡기 시도
  if (!page || !(await isPageValid())) {
    const recovered = await tryRecoverPage();
    if (!recovered) {
      return { connected: false, loggedIn: false };
    }
  }

  try {
    const loggedIn = await checkLoginStatus();
    return { connected: true, loggedIn };
  } catch (e) {
    console.error('로그인 상태 확인 오류:', e.message);
    return { connected: true, loggedIn: false };
  }
}

// 페이지가 유효한지 확인
async function isPageValid() {
  try {
    await page.evaluate(() => true);
    return true;
  } catch (e) {
    // 페이지 이동 중에 발생하는 오류는 페이지가 유효한 것으로 간주
    const msg = e.message || '';
    if (msg.includes('navigat') || msg.includes('Execution context was destroyed')) {
      return true;
    }
    return false;
  }
}

// 기존 browser/context에서 페이지 다시 잡기
async function tryRecoverPage() {
  // 동시 재연결 방지: 이미 복구 중이면 완료될 때까지 대기
  if (isRecovering) {
    let waited = 0;
    while (isRecovering && waited < 3000) {
      await new Promise(r => setTimeout(r, 100));
      waited += 100;
    }
    return page !== null;
  }
  isRecovering = true;
  try {
    // 1단계: 현재 context의 모든 페이지 중 유효한 것 찾기
    if (context) {
      for (const p of context.pages()) {
        try {
          await p.evaluate(() => true);
          page = p;
          console.log('기존 context에서 페이지 복구 성공');
          return true;
        } catch (_) {}
      }
    }

    // 2단계: browser의 모든 context/페이지 순회
    if (browser) {
      try {
        for (const ctx of browser.contexts()) {
          for (const p of ctx.pages()) {
            try {
              await p.evaluate(() => true);
              context = ctx;
              page = p;
              console.log('browser context에서 페이지 복구 성공');
              return true;
            } catch (_) {}
          }
        }
      } catch (_) {}
    }

    // 3단계: CDP 재연결 시도 (연결이 stale해진 경우 복구)
    if (USE_CDP_MODE) {
      console.log('CDP 재연결 시도...');
      try {
        const newBrowser = await chromium.connectOverCDP(`http://localhost:${CDP_PORT}`);
        const ctxs = newBrowser.contexts();
        const newCtx = ctxs[0] || await newBrowser.newContext();
        const newPages = newCtx.pages();
        const newPage = newPages[0] || await newCtx.newPage();

        browser = newBrowser;
        context = newCtx;
        page = newPage;
        console.log('CDP 재연결 성공');
        return true;
      } catch (cdpErr) {
        console.log('CDP 재연결 실패 (Chrome이 꺼진 것으로 판단):', cdpErr.message);
        // Chrome 자체가 종료된 경우에만 browser를 null로
        browser = null;
      }
    }

    // 복구 최종 실패 — context/page 초기화
    console.log('페이지 복구 최종 실패, 상태 초기화');
    context = null;
    page = null;
    return false;
  } catch (e) {
    console.error('페이지 복구 중 오류:', e.message);
    browser = null;
    context = null;
    page = null;
    return false;
  } finally {
    isRecovering = false;
  }
}

// 로그인 상태 확인 (LabGolf 사이트)
async function checkLoginStatus() {
  if (!page) return false;

  try {
    const currentUrl = page.url();

    // 이미 LabGolf 사이트에 있는 경우 로그인 상태 확인
    if (currentUrl.includes('labgolf.com')) {
      // 로그인 버튼 또는 계정 메뉴 확인
      const isLoggedIn = await page.evaluate(() => {
        // 로그인 상태일 때 나타나는 요소 확인
        const accountLink = document.querySelector('a[href="/account"]');
        const logoutLink = document.querySelector('a[href="/account/logout"]');
        const loginLink = document.querySelector('a[href="/account/login"]');

        // 로그인 링크가 없거나 계정 링크가 있으면 로그인된 상태
        return (accountLink || logoutLink) && !loginLink;
      });
      return isLoggedIn;
    }

    return false;
  } catch (e) {
    return false;
  }
}

// 브라우저 열기 (로그인 페이지로 이동)
async function openBrowserForLogin() {
  console.log('openBrowserForLogin 시작...');

  try {
    const p = await initBrowser();
    console.log('브라우저 초기화 완료, 로그인 페이지로 이동 중...');

    // LabGolf wholesale 페이지로 이동
    await p.goto('https://wholesale.labgolf.com', { waitUntil: 'domcontentloaded' });
    console.log('wholesale 페이지 로딩 완료');

    return p;
  } catch (error) {
    console.error('openBrowserForLogin 오류:', error.message);
    throw error;
  }
}

module.exports = {
  initBrowser,
  closeBrowser,
  getPage,
  isBrowserConnected,
  getBrowserStatus,
  checkLoginStatus,
  openBrowserForLogin,
};
