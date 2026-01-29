require('dotenv').config();

module.exports = {
  // 로그인 정보
  credentials: {
    id: process.env.LABGOLF_ID,
    password: process.env.LABGOLF_PASSWORD,
  },

  // 주문할 상품 URL 목록
  productUrls: process.env.PRODUCT_URLS
    ? process.env.PRODUCT_URLS.split(',').map(url => url.trim())
    : [],

  // 주문 수량
  orderQuantity: parseInt(process.env.ORDER_QUANTITY, 10) || 1,

  // 브라우저 설정
  headless: process.env.HEADLESS === 'true',

  // 사이트 URL
  baseUrl: 'https://labgolf.com',
  loginUrl: 'https://labgolf.com/account/login',
  accountUrl: 'https://labgolf.com/account',
};
