# LAB Golf Auto Ordering App

LAB Golf wholesale 사이트 자동주문 시스템입니다. Playwright CDP 모드로 일반 Chrome 브라우저에 연결하여 주문 옵션을 자동 선택합니다.

## 아키텍처 (v2)

```
[Web UI (index.html)]  ←SSE→  [Express Server]  ←CDP→  [Chrome Browser]
     ↓                           ↓                         ↓
  주문텍스트 입력            파싱 + 옵션 선택           wholesale.labgolf.com
  파싱 미리보기              브라우저 관리              제품 옵션 자동 선택
  실행 상태 모니터링          상태 스트리밍
```

### 핵심 파일

| 파일 | 역할 |
|------|------|
| `src/server.js` | Express API 서버 (포트 54112) |
| `src/browser.js` | Chrome CDP 연결/관리, 페이지 복구 |
| `src/order-executor-v2.js` | 옵션 자동 선택 엔진 (v2) |
| `src/parser.js` | 주문 텍스트 → 옵션 객체 파싱 |
| `src/csv-parser.js` | CSV 파일 파싱 + 옵션 변환 (EUC-KR/UTF-8) |
| `src/batch-executor.js` | CSV 배치 순차 실행, 중지/이어하기 |
| `src/product-configs.js` | 제품별 옵션 설정 |
| `public/index.html` | 웹 UI (단일 페이지) |

### 유틸리티

| 파일 | 역할 |
|------|------|
| `src/analyze-page-options.js` | 현재 페이지의 옵션 UI 구조 분석 |
| `src/analyze-df3.js` | DF3 제품 페이지 분석 |

## 설치 및 실행

```bash
npm install
npm start        # 서버 실행 (localhost:54112)
```

## 사용 방법

### 단건 주문

1. `npm start`로 서버 실행
2. 브라우저에서 `http://localhost:54112` 접속
3. **"브라우저 열기"** 클릭 → Chrome이 wholesale 사이트로 열림
4. Chrome에서 **수동 로그인**
5. 주문 텍스트를 붙여넣고 **"파싱 미리보기"** 클릭
6. 파싱 결과 확인 후 **"자동주문 실행"** 클릭
7. 옵션이 자동 선택되고 장바구니에 추가됨

### CSV 일괄 주문

1. 서버 실행 및 브라우저 로그인 (위 1~4단계와 동일)
2. **"CSV 일괄주문"** 섹션에서 CSV 파일 업로드 (드래그 앤 드롭 또는 파일 선택)
3. **미리보기 테이블**에서 파싱 결과 확인 (검증 실패 행은 빨간색 표시)
4. **"일괄주문 실행"** 클릭 → 각 주문을 순차적으로 자동 실행
5. 진행 중 **"배치 중지"** 버튼으로 중지 가능
6. 중지 후 **"이어하기"** 버튼으로 남은 주문 계속 실행
7. 실패한 주문은 상태에 FAIL 표시, 마우스 오버 시 실패 원인 확인

#### CSV 파일 형식

- **인코딩**: EUC-KR (Excel 내보내기) 또는 UTF-8 자동 감지
- **컬럼 순서**: 주문번호, 매장명, 모델명, 퍼팅스타일, 색상, 손잡이, 헤드무게타입, 샤프트길이, 샤프트린, 라이각, 라이저, 샤프트명, 그립명, 조준선1, 조준선2, 퍼터갯수, ...

#### 배치 실행 흐름

```
CSV 업로드 → 서버 파싱 (EUC-KR 디코딩) → 미리보기 테이블
    → 일괄 실행 → 주문별 순차 처리 (3초 간격)
    → SSE로 실시간 진행상황 전송 → 결과 테이블 업데이트
    → 중지 시 상태 저장 → 이어하기로 재개 가능
```

## 주문 텍스트 형식

아래와 같은 형식의 주문 텍스트를 입력합니다:

```
OZ.1i - CUSTOM
Hand: RIGHT
Putting style: STANDARD
Head Weight: STANDARD
Shaft: GEARS x L.A.B. (Black)
Shaft Length: 34"
Shaft Lean: 0°
Lie angle: 69°
Putter color: Charcoal
Alignment Mark Front: C
Alignment Mark Back: 1
Grip selection: SuperStroke Flatso 2.0
Riser: Black
Build Time: Standard
```

## 옵션 UI 타입 매핑

wholesale 사이트(Shopify + AVIS 앱)의 옵션 UI 타입별로 다른 선택 방식을 사용합니다:

| UI 타입 | 선택 함수 | 해당 옵션 |
|---------|----------|----------|
| Pill 버튼 | `selectPillOption()` | Hand, Putting Style, Head Weight |
| 스와치 드롭다운 | `selectSwatchDropdown()` | Shaft, Alignment Front/Back, Grip Selection |
| 표준 Select | `selectDropdown()` | Shaft Length, Shaft Lean, Lie Angle |
| 색상 스와치 | `selectColorSwatch()` | Putter Color, Headcover |

### 옵션 매칭 전략 (3-pass)

1. **정확한 매칭**: `opt.value === val` 또는 `opt.textContent === val`
   - 1b. 따옴표/도 기호 정규화 후 정확 매칭 (`º` → `°`, 각종 유니코드 따옴표 제거)
2. **부분 매칭**: `text.startsWith(val)` (includes는 오매칭 위험으로 제외)
3. **키워드 매칭**: 정규화 후 키워드 분리, 2개 이상 키워드 모두 포함 여부 확인
   - 예: `"GEARS x L.A.B. (Black)"` → `"GEARS x L.A.B. Golf - Black (+$125.00)"` 매칭
   - 예: `"Press II 1.5º Smooth"` → `"Press II 1.5° Smooth"` 매칭 (도 기호 정규화)

> **참고**: Grip Selection은 스와치 드롭다운 선택 실패 시 표준 `<select>` 폴백을 지원합니다 (COUNTERBALANCED 등 일부 제품).

## 지원 제품

| 제품명 | 타입 | URL 경로 |
|--------|------|----------|
| OZ.1i - CUSTOM | oz1i | oz1i-custom |
| OZ.1i HS - CUSTOM | oz1i-hs | oz1i-hs-custom |
| OZ.1 - CUSTOM | oz1 | oz-1-custom |
| MEZZ.1 - CUSTOM | mezz1 | mezz-1-custom |
| MEZZ.1 MAX - CUSTOM | mezz1-max | mezz-1-max-custom |
| LINK.1 - CUSTOM | link1 | link-1-custom |
| DF3 - CUSTOM | df3 | df3-custom |
| DF 2.1 - CUSTOM | df21 | custom-df21 |

## 옵션 선택 순서

```
1. Hand (pill)
2. Putting Style (pill)
3. Head Weight (pill)
4. Shaft (swatch dropdown)
4-1. Shaft Length (select)
4-2. Shaft Lean (select) ← Grip Selection 표시 조건
5. Lie Angle (select)
7. Putter Color (color swatch)
8. Alignment Mark Front/Back (swatch dropdown)
9. Grip Selection (swatch dropdown)
10. Headcover (color swatch)
11. Player Name (text input)
```

> **참고**: Shaft Lean을 선택해야 Grip Selection 옵션이 나타납니다. 일부 퍼터에는 Shaft Lean이 없을 수 있습니다.

## API 엔드포인트

### 단건 주문
| Method | 경로 | 설명 |
|--------|------|------|
| POST | `/api/order/parse` | 주문 텍스트 파싱 미리보기 |
| POST | `/api/order/execute` | 단건 주문 실행 |
| GET | `/api/status` | 현재 실행 상태 조회 |
| GET | `/api/status/stream` | SSE 실시간 상태 스트림 |

### CSV 배치 주문
| Method | 경로 | 설명 |
|--------|------|------|
| POST | `/api/csv/parse` | CSV 파싱 미리보기 (base64 입력) |
| POST | `/api/order/batch` | 배치 주문 실행 시작 |
| GET | `/api/batch/status` | 배치 실행 상태 조회 |
| POST | `/api/batch/stop` | 실행 중 배치 중지 |
| POST | `/api/batch/resume` | 중지된 배치 이어하기 |

### 브라우저 관리
| Method | 경로 | 설명 |
|--------|------|------|
| POST | `/api/browser/open` | Chrome 브라우저 열기 |
| GET | `/api/browser/status` | 브라우저 연결 상태 |
| POST | `/api/browser/close` | 브라우저 닫기 |

## 기술 스택

- **런타임**: Node.js
- **서버**: Express
- **브라우저 자동화**: Playwright (CDP 모드)
- **환경변수**: dotenv
- **실시간 통신**: Server-Sent Events (SSE)
- **CSV 디코딩**: iconv-lite (EUC-KR 지원)

## 변경 이력

### v2.1.0 (2025-02-20)
- CSV 일괄 주문 기능 추가 (EUC-KR/UTF-8 자동 감지)
- CSV 파싱 미리보기 테이블 (전체 옵션 컬럼 표시, 검증 실패 행 강조)
- 배치 순차 실행 엔진 (주문 간 3초 대기, 실패 시 스킵 후 계속)
- 배치 중지/이어하기 기능 (중지 시 상태 저장, 남은 주문부터 재개)
- SSE 기반 배치 실시간 진행상황 (전체 진행률 + 개별 주문 상태)
- 실패 주문 원인 표시 (FAIL 셀 툴팁)
- batchId 기반 동시성 제어 (race condition 방지)

### v2.0.1 (2025-02-19)
- selectDropdown 3-pass 매칭 리팩토링 (정확→부분→키워드, includes 제거)
- 유니코드 정규화 강화: 따옴표 + 도 기호(`º` U+00BA → `°` U+00B0) 통합 처리
- Grip Selection 표준 `<select>` 폴백 추가 (COUNTERBALANCED 제품 대응)
- selectSwatchDropdown 매칭 개선: stripQuotes 적용, 키워드 최소 길이 2로 완화
- Playwright 네이티브 `selectOption()` 사용, jQuery 이벤트 폴백 추가

### v2.0.0 (2025-02-11)
- 옵션 자동 선택 완전 구현 (모든 UI 타입 지원)
- 스와치 드롭다운 선택 지원 (Shaft, Alignment, Grip)
- Shaft Length, Shaft Lean 선택 추가
- 키워드 매칭으로 옵션 텍스트 불일치 해결
- 브라우저 페이지 복구 로직 (연결 안정성 개선)
- 수동 로그인 워크플로우 (로그인 체크 제거)
- 테스트 모드 지원 (Add to Cart 스킵)
- 페이지 옵션 분석 유틸리티 추가
- MEZZ.1 제품 지원 추가

### v1.2.1 (2025-02-02)
- DF 2.1 제품 지원 추가
- 가격 접미사가 있는 옵션 매칭 수정

### v1.2.0 (2025-02-02)
- CDP 모드 추가: 일반 Chrome에 연결하여 봇 감지 우회
- DF3 제품 지원 추가
- 옵션 선택 실패 시 상세 에러 메시지 표시

### v1.1.0 (2025-01-29)
- OZ.1i (일반)와 OZ.1i HS 제품 타입 분리

### v1.0.0 (2025-01-22)
- 초기 버전
