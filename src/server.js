require('dotenv').config();
const express = require('express');
const path = require('path');
const { parseOrderText, validateOptions } = require('./parser');
const { executeOrder, getStatus, setStatusCallback } = require('./order-executor-v2');

const app = express();
const PORT = process.env.PORT || 3000;

// 미들웨어
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

// SSE 클라이언트 관리
let sseClients = [];

// SSE 엔드포인트
app.get('/api/status/stream', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  sseClients.push(res);

  req.on('close', () => {
    sseClients = sseClients.filter(client => client !== res);
  });
});

// 상태 콜백 설정
setStatusCallback((status) => {
  const data = JSON.stringify(status);
  sseClients.forEach(client => {
    client.write(`data: ${data}\n\n`);
  });
});

// 주문 문자열 파싱 API
app.post('/api/parse', (req, res) => {
  try {
    const { orderText } = req.body;

    if (!orderText) {
      return res.status(400).json({ error: '주문 문자열이 필요합니다.' });
    }

    const options = parseOrderText(orderText);
    const validation = validateOptions(options);

    res.json({
      success: true,
      options,
      validation
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 주문 실행 API
app.post('/api/order', async (req, res) => {
  try {
    const { orderText } = req.body;

    if (!orderText) {
      return res.status(400).json({ error: '주문 문자열이 필요합니다.' });
    }

    const options = parseOrderText(orderText);
    const validation = validateOptions(options);

    if (!validation.valid) {
      return res.status(400).json({
        error: '필수 옵션이 누락되었습니다.',
        missing: validation.missing
      });
    }

    // 비동기로 주문 실행 (응답은 먼저 보냄)
    res.json({
      success: true,
      message: '주문 실행이 시작되었습니다.',
      options
    });

    // 주문 실행
    executeOrder(options);

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 현재 상태 조회 API
app.get('/api/status', (req, res) => {
  res.json(getStatus());
});

// 메인 페이지
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

// 서버 시작
app.listen(PORT, () => {
  console.log('='.repeat(50));
  console.log('LAB Golf 자동주문 시스템');
  console.log('='.repeat(50));
  console.log(`서버 실행 중: http://localhost:${PORT}`);
  console.log('브라우저에서 위 주소로 접속하세요.');
  console.log('='.repeat(50));
});
