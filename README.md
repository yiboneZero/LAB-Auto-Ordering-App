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

## 지원 제품

| 제품명 | 제품 타입 | URL |
|--------|----------|-----|
| OZ.1i - CUSTOM | oz1i | oz1i-custom |
| OZ.1i HS - CUSTOM | oz1i-hs | oz1i-hs-custom |
| OZ.1 - CUSTOM | oz1 | oz-1-custom |
| MEZZ.1 MAX - CUSTOM | mezz1-max | mezz-1-max-custom |
| LINK.1 - CUSTOM | link1 | link-1-custom |

## 기술 스택

- Node.js
- Express
- Playwright
- dotenv

## 변경 이력

### v1.1.0 (2025-01-29)
- OZ.1i (일반)와 OZ.1i HS 제품 타입 분리
- OZ.1i 일반 제품 URL 매핑 수정 (`oz1i-custom`)
- OZ.1i 일반 제품은 OZ.1과 동일한 옵션 구조 사용 (Grip Selection이 Step 3)

### v1.0.0 (2025-01-22)
- 초기 버전
- OZ.1i HS, OZ.1, MEZZ.1 MAX, LINK.1 지원
