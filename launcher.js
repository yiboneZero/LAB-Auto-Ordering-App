#!/usr/bin/env node
/**
 * LAB Golf 자동주문 런처
 * 이 파일은 exe로 컴파일되어 서버를 시작하고 브라우저를 엽니다.
 */

const { spawn, exec } = require('child_process');
const path = require('path');
const http = require('http');

const PORT = 54112;
const SERVER_URL = `http://localhost:${PORT}`;

console.log('==========================================');
console.log('  LAB Golf 자동주문 시스템');
console.log('==========================================');
console.log('');

// 서버가 이미 실행 중인지 확인
function checkServerRunning() {
  return new Promise((resolve) => {
    const req = http.get(SERVER_URL, (res) => {
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
  const url = SERVER_URL;
  switch (process.platform) {
    case 'win32':
      exec(`start "" "${url}"`);
      break;
    case 'darwin':
      exec(`open "${url}"`);
      break;
    default:
      exec(`xdg-open "${url}"`);
  }
}

// 서버 시작
async function startServer() {
  const isRunning = await checkServerRunning();

  if (isRunning) {
    console.log('서버가 이미 실행 중입니다.');
    console.log(`브라우저에서 ${SERVER_URL} 로 접속합니다...`);
    openBrowser();
    return;
  }

  console.log('서버를 시작합니다...');

  // 실행 파일 위치 기준으로 서버 스크립트 경로 찾기
  let serverPath;
  if (process.pkg) {
    // exe로 실행된 경우
    serverPath = path.join(path.dirname(process.execPath), 'src', 'server.js');
  } else {
    // 일반 node로 실행된 경우
    serverPath = path.join(__dirname, 'src', 'server.js');
  }

  const serverProcess = spawn('node', [serverPath], {
    cwd: process.pkg ? path.dirname(process.execPath) : __dirname,
    stdio: ['ignore', 'pipe', 'pipe'],
    detached: false,
    shell: true
  });

  serverProcess.stdout.on('data', (data) => {
    process.stdout.write(data);
  });

  serverProcess.stderr.on('data', (data) => {
    process.stderr.write(data);
  });

  serverProcess.on('error', (err) => {
    console.error('서버 시작 실패:', err.message);
  });

  // 서버 시작 대기
  console.log('서버 시작 대기 중...');
  await new Promise(resolve => setTimeout(resolve, 2000));

  // 서버 확인
  const serverStarted = await checkServerRunning();
  if (serverStarted) {
    console.log('');
    console.log(`서버가 시작되었습니다: ${SERVER_URL}`);
    console.log('브라우저를 엽니다...');
    openBrowser();
  } else {
    console.log('서버 시작을 확인할 수 없습니다. 수동으로 확인해주세요.');
  }

  console.log('');
  console.log('==========================================');
  console.log('  이 창을 닫으면 서버가 종료됩니다.');
  console.log('==========================================');

  // 프로세스 종료 시 서버도 종료
  process.on('SIGINT', () => {
    console.log('\n서버를 종료합니다...');
    serverProcess.kill();
    process.exit(0);
  });

  process.on('SIGTERM', () => {
    serverProcess.kill();
    process.exit(0);
  });

  // Windows에서 창 닫기 이벤트 처리
  if (process.platform === 'win32') {
    const readline = require('readline');
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
    rl.on('close', () => {
      serverProcess.kill();
      process.exit(0);
    });
  }
}

startServer().catch(console.error);
