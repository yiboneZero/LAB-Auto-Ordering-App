# LAB Auto Ordering App

LabGolf 자동주문 프로그램입니다. Playwright를 사용하여 브라우저를 자동화합니다.

## 기능

- LabGolf 사이트 자동 접속
- 상품 자동 장바구니 추가
- 체크아웃 페이지 자동 이동
- 여러 상품 동시 주문 지원

## 설치

```bash
npm install
```

## 설정

1. `.env.example` 파일을 복사하여 `.env` 파일 생성:

```bash
cp .env.example .env
```

2. `.env` 파일 수정:

```env
# LabGolf 로그인 정보
LABGOLF_ID=your_id_here
LABGOLF_PASSWORD=your_password_here

# 주문할 상품 URL (쉼표로 구분하여 여러 개 입력 가능)
PRODUCT_URLS=https://labgolf.com/product/example-product

# 주문 수량
ORDER_QUANTITY=1

# 브라우저 헤드리스 모드 (true: 브라우저 숨김, false: 브라우저 표시)
HEADLESS=false
```

## 실행

```bash
npm start
```

## 사용 방법

1. 프로그램 실행 후 브라우저가 열립니다
2. LabGolf 사이트에서 수동으로 로그인합니다
3. 프로그램이 자동으로 상품을 장바구니에 추가합니다
4. 체크아웃 페이지에서 결제 정보를 확인하고 수동으로 주문을 완료합니다

## 기술 스택

- Node.js
- Express
- Playwright
- dotenv
