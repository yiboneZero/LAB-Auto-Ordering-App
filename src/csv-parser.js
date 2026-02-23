// CSV 파싱 + 옵션 변환 모듈
const iconv = require('iconv-lite');
const { validateOptions } = require('./parser');

/**
 * CSV 텍스트를 파싱하여 행 배열로 변환 (RFC 4180 호환)
 * @param {string} text - CSV 텍스트
 * @returns {string[][]} 2차원 배열
 */
function parseCsvText(text) {
  const rows = [];
  let current = '';
  let inQuotes = false;
  let row = [];

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];

    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          current += '"';
          i++; // 이스케이프된 따옴표
        } else {
          inQuotes = false;
        }
      } else {
        current += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ',') {
        row.push(current.trim());
        current = '';
      } else if (ch === '\n' || (ch === '\r' && text[i + 1] === '\n')) {
        if (ch === '\r') i++; // CRLF
        row.push(current.trim());
        if (row.length > 1 || row[0] !== '') rows.push(row);
        row = [];
        current = '';
      } else {
        current += ch;
      }
    }
  }

  // 마지막 행 처리
  if (current || row.length > 0) {
    row.push(current.trim());
    if (row.length > 1 || row[0] !== '') rows.push(row);
  }

  return rows;
}

/**
 * Base64로 인코딩된 CSV 바이너리를 디코딩
 * BOM이 있으면 UTF-8, 없으면 EUC-KR로 디코딩
 * @param {string} base64Data - base64 인코딩된 CSV 데이터
 * @returns {string} 디코딩된 CSV 텍스트
 */
function decodeCsvBuffer(base64Data) {
  const buffer = Buffer.from(base64Data, 'base64');

  // UTF-8 BOM 체크 (EF BB BF)
  if (buffer[0] === 0xEF && buffer[1] === 0xBB && buffer[2] === 0xBF) {
    return buffer.toString('utf-8').substring(1); // BOM 제거
  }

  // UTF-8 유효성 체크 (한글이 정상적으로 디코딩되는지)
  const utf8Text = buffer.toString('utf-8');
  // 대체 문자(�)가 없으면 UTF-8
  if (!utf8Text.includes('\uFFFD')) {
    return utf8Text;
  }

  // EUC-KR로 디코딩
  return iconv.decode(buffer, 'euc-kr');
}

// 헤더명 → 필드 매핑 (헤더에 포함된 키워드로 매칭)
// CSV 구조 (sample2 기준):
// 주문번호, 구분, 매장명, 피터닉네임, 모델명, 퍼팅스타일, 색상, 손잡이,
// 헤드무게타입, 샤프트 길이, 샤프트 린, 라이각, 라이저, 샤프트명, 그립명,
// 조준선1, 조준선2, 퍼터 갯수, 전체금액, 고객명, 전화번호, 이메일,
// 배송방법, 배송주소, 결제방식, 등록일, 결제상태, 배송상태, 비고
const HEADER_MAP = {
  '주문번호': 'orderId',
  '구분': 'category',
  '매장명': 'store',
  '피터닉네임': 'putterNickname',
  '모델명': 'model',
  '퍼팅스타일': 'puttingStyle',
  '색상': 'color',
  '손잡이': 'hand',
  '헤드무게': 'headWeight',
  '샤프트 길이': 'shaftLength',
  '샤프트길이': 'shaftLength',
  '샤프트 린': 'shaftLean',
  '샤프트린': 'shaftLean',
  '라이각': 'lieAngle',
  '라이저': 'riser',
  '샤프트명': 'shaft',
  '그립명': 'grip',
  '조준선1': 'align1',
  '조준선2': 'align2',
  '퍼터 갯수': 'quantity',
  '퍼터갯수': 'quantity',
};

/**
 * 헤더 행으로부터 컬럼 인덱스 매핑 생성
 * @param {string[]} header - 헤더 행 배열
 * @returns {object} 필드명 → 컬럼 인덱스 매핑
 */
function buildColumnMap(header) {
  const colMap = {};
  for (let i = 0; i < header.length; i++) {
    const h = header[i].replace(/\s+/g, '').trim();
    for (const [keyword, field] of Object.entries(HEADER_MAP)) {
      const normalizedKeyword = keyword.replace(/\s+/g, '');
      if (h.includes(normalizedKeyword) && !colMap[field]) {
        colMap[field] = i;
        break;
      }
    }
  }
  return colMap;
}

/**
 * CSV 행을 주문 옵션 객체로 변환
 * @param {string[]} row - CSV 행 배열
 * @param {object} col - 컬럼 인덱스 매핑 (buildColumnMap 결과)
 * @returns {object} 파싱된 옵션 객체 + 메타정보
 */
function csvRowToOptions(row, col) {
  const get = (field) => (col[field] !== undefined ? (row[col[field]] || '').trim().replace(/\s+/g, ' ') : '');

  const model = get('model');
  const product = model + ' - CUSTOM';

  // Shaft Lean 처리: "Std"/"Standard" → null (해당 제품에 Shaft Lean 없음), "0" → "0°" (유효한 선택값)
  const shaftLeanRaw = get('shaftLean');
  console.log('[DEBUG csv-parser] shaftLeanRaw:', JSON.stringify(shaftLeanRaw), 'leanLower:', JSON.stringify(shaftLeanRaw.toLowerCase()));
  let shaftLean = null;
  const leanLower = shaftLeanRaw.toLowerCase();
  if (leanLower !== 'std' && leanLower !== 'standard' && leanLower !== '-' && leanLower !== '') {
    const lean = shaftLeanRaw.replace(/[^\d.]/g, '');
    shaftLean = lean ? lean + '°' : null;
  }

  // Riser 처리
  const riserRaw = get('riser') || '-';
  let riser = 'Black'; // 기본값
  if (riserRaw !== '-' && riserRaw !== '') {
    riser = riserRaw.charAt(0).toUpperCase() + riserRaw.slice(1).toLowerCase();
  }

  // Alignment 처리: 조준선2가 "-" 또는 빈값이면 단일 alignmentMark 사용
  const align1 = get('align1');
  const align2 = get('align2') || '-';
  let alignmentFront = null;
  let alignmentBack = null;
  let alignmentMark = null;

  if (align2 === '-' || align2 === '') {
    alignmentMark = align1 || null;
  } else {
    alignmentFront = align1.length === 1 ? align1.toUpperCase() : align1;
    alignmentBack = align2;
  }

  // Shaft Length 처리
  const shaftLengthRaw = get('shaftLength');
  const shaftLength = shaftLengthRaw ? shaftLengthRaw.replace(/[^\d.]/g, '') + '"' : null;

  // Lie Angle 처리
  const lieAngleRaw = get('lieAngle');
  const lieAngle = lieAngleRaw ? lieAngleRaw.replace(/[^\d.]/g, '') + '°' : null;

  const puttingStyle = get('puttingStyle').toUpperCase();
  const isCounterbalanced = puttingStyle === 'COUNTERBALANCED';

  // Shaft 이름 정규화: "Brand (Color-Length)" → "Brand Golf Color Shaft - Length"
  // COUNTERBALANCED일 경우 사이트에서 Length 표기 생략하므로 제거
  const normalizeShaftName = (name) => {
    if (!name) return name;
    const match = name.match(/^(.+?)\s+\((\w+)-(\w+)\)$/);
    if (match) {
      const [, brand, color, length] = match;
      return isCounterbalanced
        ? `${brand} Golf ${color} Shaft`
        : `${brand} Golf ${color} Shaft - ${length}`;
    }
    if (isCounterbalanced) {
      return name.replace(/\s+-\s+(Long|Short|Standard|Std)$/i, '').trim();
    }
    return name;
  };

  const options = {
    product,
    hand: get('hand').toUpperCase() || null,
    puttingStyle,
    headWeight: get('headWeight').toUpperCase() || null,
    shaft: normalizeShaftName(get('shaft')) || null,
    shaftLength,
    shaftLean,
    lieAngle,
    putterColor: get('color') || null,
    alignmentFront,
    alignmentBack,
    alignmentMark,
    gripSelection: get('grip') || null,
    riser,
    headcover: null,
    buildTime: 'Standard',
  };

  return {
    orderId: get('orderId'),
    category: get('category'),
    store: get('store'),
    putterNickname: get('putterNickname'),
    quantity: parseInt(get('quantity')) || 1,
    options,
  };
}

/**
 * Base64 CSV 데이터를 파싱하여 주문 목록 반환
 * @param {string} base64Data - base64 인코딩된 CSV
 * @returns {object} 파싱 결과
 */
function parseCsvData(base64Data) {
  const text = decodeCsvBuffer(base64Data);
  const rows = parseCsvText(text);

  if (rows.length < 2) {
    return { success: false, error: 'CSV에 데이터가 없습니다.', orders: [] };
  }

  const header = rows[0];
  const col = buildColumnMap(header);
  const dataRows = rows.slice(1);

  // 필수 컬럼 검증
  const required = ['model', 'hand', 'puttingStyle', 'shaft'];
  const missingCols = required.filter(f => col[f] === undefined);
  if (missingCols.length > 0) {
    return { success: false, error: `CSV 헤더에 필수 컬럼이 없습니다: ${missingCols.join(', ')}`, orders: [] };
  }

  const minCols = Math.min(...Object.values(col)) + 1;
  const orders = [];
  for (let i = 0; i < dataRows.length; i++) {
    const row = dataRows[i];
    if (row.length < minCols) continue; // 컬럼 수 부족 스킵

    // 모델명이 비어있으면 빈 행으로 간주하고 스킵
    const modelVal = col.model !== undefined ? (row[col.model] || '').trim() : '';
    if (!modelVal) continue;

    const parsed = csvRowToOptions(row, col);
    const validation = validateOptions(parsed.options);

    orders.push({
      index: i + 1,
      orderId: parsed.orderId,
      category: parsed.category,
      store: parsed.store,
      putterNickname: parsed.putterNickname,
      quantity: parsed.quantity,
      options: parsed.options,
      valid: validation.valid,
      missing: validation.missing,
    });
  }

  return {
    success: true,
    total: orders.length,
    valid: orders.filter(o => o.valid).length,
    invalid: orders.filter(o => !o.valid).length,
    orders,
  };
}

module.exports = {
  parseCsvData,
  parseCsvText,
  decodeCsvBuffer,
  csvRowToOptions,
};
