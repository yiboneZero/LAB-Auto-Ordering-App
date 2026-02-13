// 주문 문자열 파싱 모듈

/**
 * 주문 문자열을 파싱하여 옵션 객체로 변환
 * @param {string} orderText - 주문 문자열
 * @returns {object} 파싱된 옵션 객체
 */
function parseOrderText(orderText) {
  // 앞쪽 빈 줄 제거: 내용이 있는 첫 줄부터 시작하도록
  const lines = orderText.trim().split('\n').filter((line, index, arr) => {
    // 첫 번째 내용 있는 줄을 찾을 때까지 빈 줄 제거
    if (line.trim() === '') {
      // 이전에 내용 있는 줄이 있었으면 유지 (중간 빈 줄)
      for (let i = 0; i < index; i++) {
        if (arr[i].trim() !== '') return true;
      }
      return false; // 앞쪽 빈 줄은 제거
    }
    return true;
  });
  const options = {
    product: null,
    hand: null,
    puttingStyle: null,
    headWeight: null,
    shaft: null,
    shaftLength: null,
    shaftLean: null,
    lieAngle: null,
    putterColor: null,
    alignmentFront: null,
    alignmentBack: null,
    alignmentMark: null,  // DF3용
    gripSelection: null,
    riser: 'Black', // 기본값
    insert: 'Medium Fly Mill - Stainless Steel', // 기본값
    headcover: null, // null이면 기본 선택 유지
    buildTime: 'Standard', // 기본값
  };

  for (const line of lines) {
    const trimmedLine = line.trim();
    if (!trimmedLine) continue;

    // 제품명 (콜론 없는 줄 중 첫 번째 - 빈 첫줄 허용)
    if (!trimmedLine.includes(':') && !options.product) {
      options.product = trimmedLine;
      continue;
    }

    const [key, ...valueParts] = trimmedLine.split(':');
    const keyLower = key.trim().toLowerCase();
    const value = valueParts.join(':').trim();

    // 키 매핑
    if (keyLower === 'hand') {
      options.hand = value.toUpperCase();
    } else if (keyLower === 'putting style') {
      options.puttingStyle = value.toUpperCase();
    } else if (keyLower === 'head weight') {
      options.headWeight = value.toUpperCase();
    } else if (keyLower === 'shaft') {
      options.shaft = value;
    } else if (keyLower === 'shaft length') {
      // 숫자만 추출하고 " 추가
      const length = value.replace(/[^\d.]/g, '');
      options.shaftLength = length + '"';
    } else if (keyLower === 'shaft lean') {
      // "Std" 또는 "Standard"면 null (선택 불필요)
      const valueLower = value.toLowerCase();
      if (valueLower === 'std' || valueLower === 'standard') {
        options.shaftLean = null; // 선택 불필요
      } else {
        const lean = value.replace(/[^\d.]/g, '');
        options.shaftLean = lean ? lean + '°' : null;
      }
    } else if (keyLower === 'lie angle') {
      // 숫자와 소수점 추출하고 ° 추가
      const angle = value.replace(/[^\d.]/g, '');
      options.lieAngle = angle + '°';
    } else if (keyLower === 'putter color') {
      options.putterColor = value;
    } else if (keyLower === 'alignment front') {
      // A, B, C 등 단일 문자는 대문자로 변환
      options.alignmentFront = value.length === 1 ? value.toUpperCase() : value;
    } else if (keyLower === 'alignment back') {
      // 0, 1, 2, 3 등 숫자는 그대로 유지
      options.alignmentBack = value;
    } else if (keyLower === 'alignment mark' || keyLower === 'alignment') {
      // DF3용 단일 alignment mark
      options.alignmentMark = value;
    } else if (keyLower === 'grip selection' || keyLower === 'grip') {
      options.gripSelection = value;
    } else if (keyLower === 'riser') {
      // 첫 글자만 대문자로 (PLATINUM -> Platinum)
      options.riser = value.charAt(0).toUpperCase() + value.slice(1).toLowerCase();
    } else if (keyLower === 'insert') {
      options.insert = value;
    } else if (keyLower === 'headcover') {
      options.headcover = value;
    } else if (keyLower === 'build time') {
      options.buildTime = value;
    }
  }

  return options;
}

/**
 * 제품명에서 URL 생성
 * @param {string} productName - 제품명
 * @returns {string} 제품 URL
 */
function getProductUrl(productName) {
  const productUrls = {
    'OZ.1i - CUSTOM': 'https://wholesale.labgolf.com/products/oz1i-custom',
    'OZ.1i Custom': 'https://wholesale.labgolf.com/products/oz1i-custom',
    'OZ.1i HS - CUSTOM': 'https://wholesale.labgolf.com/products/oz1i-hs-custom',
    'OZ.1i HS Custom': 'https://wholesale.labgolf.com/products/oz1i-hs-custom',
    'OZ.1 - CUSTOM': 'https://wholesale.labgolf.com/products/oz1-custom',
    'OZ.1 Custom': 'https://wholesale.labgolf.com/products/oz1-custom',
    'MEZZ.1 MAX - CUSTOM': 'https://wholesale.labgolf.com/products/mezz-1-max-custom',
    'MEZZ.1 MAX Custom': 'https://wholesale.labgolf.com/products/mezz-1-max-custom',
    'MEZZ.1 - CUSTOM': 'https://wholesale.labgolf.com/products/mezz1',
    'MEZZ.1 Custom': 'https://wholesale.labgolf.com/products/mezz1',
    'LINK.1 - CUSTOM': 'https://wholesale.labgolf.com/products/link-1-custom',
    'LINK. 1 - CUSTOM': 'https://wholesale.labgolf.com/products/link-1-custom',
    'DF3 - CUSTOM': 'https://wholesale.labgolf.com/products/df3-custom',
    'DF3 Custom': 'https://wholesale.labgolf.com/products/df3-custom',
    'DF 2.1 - CUSTOM': 'https://wholesale.labgolf.com/products/custom-df21',
    'DF 2.1 Custom': 'https://wholesale.labgolf.com/products/custom-df21',
    'DF2.1 - CUSTOM': 'https://wholesale.labgolf.com/products/custom-df21',
    'DF3i CUSTOM': 'https://wholesale.labgolf.com/products/df3i-custom',
    'DF3i - CUSTOM': 'https://wholesale.labgolf.com/products/df3i-custom',
  };

  // 정확한 매칭 시도
  if (productUrls[productName]) {
    return productUrls[productName];
  }

  // 부분 매칭 시도
  for (const [key, url] of Object.entries(productUrls)) {
    if (productName.toLowerCase().includes(key.toLowerCase().replace(' - custom', '').replace(' custom', ''))) {
      return url;
    }
  }

  // 기본값
  return 'https://wholesale.labgolf.com/products/oz1i-hs-custom';
}

/**
 * 파싱 결과 검증
 * @param {object} options - 파싱된 옵션
 * @returns {object} 검증 결과
 */
function validateOptions(options) {
  // shaftLean은 제품에 따라 없을 수 있으므로 필수에서 제외
  const required = ['hand', 'puttingStyle', 'headWeight', 'shaft', 'shaftLength', 'putterColor'];
  const missing = [];

  for (const field of required) {
    if (!options[field]) {
      missing.push(field);
    }
  }

  return {
    valid: missing.length === 0,
    missing,
    options
  };
}

module.exports = {
  parseOrderText,
  getProductUrl,
  validateOptions
};
