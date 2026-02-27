#!/usr/bin/env node
/**
 * LAB Golf 자동주문 런처
 * 이 파일은 exe로 컴파일되어 서버를 시작하고 브라우저를 엽니다.
 *
 * 서버를 같은 프로세스 내에서 직접 시작합니다 (spawn 방식 제거).
 */

const path = require('path');
const { exec } = require('child_process');
const http = require('http');

// dotenv를 가장 먼저 로드 (pkg 가상 파일시스템 경로 사용)
try {
  require('dotenv').config({ path: path.join(__dirname, '.env') });
} catch (e) {
  // dotenv 로드 실패해도 계속 진행 (기본값 사용)
}

const PORT = parseInt(process.env.PORT, 10) || 54112;
const SERVER_URL = `http://localhost:${PORT}`;

console.log('==========================================');
console.log('  LAB Golf 자동주문 시스템');
console.log('==========================================');
console.log('');

// 서버가 이미 실행 중인지 확인
function checkServerRunning() {
  return new Promise((resolve) => {
    const req = http.get(SERVER_URL, () => {
      resolve(true);
    });
    req.on('error', () => resolve(false));
    req.setTimeout(1000, () => {
      req.destroy();
      resolve(false);
    });
  });
}

// 브라우저 열기
function openBrowser() {
  switch (process.platform) {
    case 'win32':
      exec(`start "" "${SERVER_URL}"`);
      break;
    case 'darwin':
      exec(`open "${SERVER_URL}"`);
      break;
    default:
      exec(`xdg-open "${SERVER_URL}"`);
  }
}

async function main() {
  const isRunning = await checkServerRunning();

  if (isRunning) {
    console.log('서버가 이미 실행 중입니다.');
    console.log(`브라우저에서 ${SERVER_URL} 로 접속합니다...`);
    openBrowser();
    return;
  }

  console.log('서버를 시작합니다...');

  // 서버를 같은 프로세스 내에서 직접 시작
  // (pkg exe에서 spawn 방식은 불안정하므로 인-프로세스로 실행)
  try {
    require('./src/server');
  } catch (err) {
    console.error('서버 모듈 로드 실패:', err.message);
    console.error(err.stack);
    process.exit(1);
  }

  // 서버 시작 대기 (최대 20초)
  console.log('서버 시작 대기 중...');
  let serverStarted = false;
  for (let i = 0; i < 20; i++) {
    await new Promise(resolve => setTimeout(resolve, 1000));
    if (await checkServerRunning()) {
      serverStarted = true;
      break;
    }
    process.stdout.write('.');
  }
  console.log('');

  if (serverStarted) {
    console.log(`서버가 시작되었습니다: ${SERVER_URL}`);
    console.log('브라우저를 엽니다...');
    openBrowser();
  } else {
    console.error('서버 시작 실패. 위 오류 메시지를 확인하세요.');
    process.exit(1);
  }

  console.log('');
  console.log('==========================================');
  console.log('  이 창을 닫으면 서버가 종료됩니다.');
  console.log('==========================================');
}

main().catch((err) => {
  console.error('실행 오류:', err.message);
  console.error(err.stack);
  process.exit(1);
});
