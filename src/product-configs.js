// 제품별 옵션 구조 정의

const PRODUCT_CONFIGS = {
  // OZ.1i HS Custom
  'oz1i-hs': {
    name: 'OZ.1i HS Custom',
    url: 'https://labgolf.com/products/oz1i-hs-custom',
    steps: {
      step1: {
        name: 'FOUNDATION',
        options: ['hand', 'puttingStyle', 'headWeight']
      },
      step2: {
        name: 'FUNCTION',
        options: ['shaft', 'shaftLength', 'shaftLean', 'gripSelection'],
        conditional: true  // 순차 선택 필요
      },
      step3: {
        name: 'FORM',
        options: ['riser', 'lieAngle', 'putterColor', 'insert', 'alignmentFront', 'alignmentBack', 'headcover', 'buildTime']
      }
    },
    optionTypes: {
      hand: 'pill',
      puttingStyle: 'pill',
      headWeight: 'pill',
      shaft: 'swatchDropdown',
      shaftLength: 'select',
      shaftLean: 'select',
      gripSelection: 'swatchDropdown',
      riser: 'select',
      lieAngle: 'select',
      putterColor: 'colorSwatch',
      insert: 'select',
      alignmentFront: 'swatchDropdown',
      alignmentBack: 'swatchDropdown',
      headcover: 'swatchDropdown',
      buildTime: 'pill'
    }
  },

  // MEZZ.1 MAX Custom
  'mezz1-max': {
    name: 'MEZZ.1 MAX Custom',
    url: 'https://labgolf.com/products/mezz-1-max-custom',
    steps: {
      step1: {
        name: 'FOUNDATION',
        options: ['hand', 'puttingStyle', 'headWeight']
      },
      step2: {
        name: 'FUNCTION',
        options: ['shaft', 'shaftLength', 'lieAngle'],
        conditional: true
      },
      step3: {
        name: 'FORM',
        options: ['putterColor', 'alignmentMark', 'gripSelection', 'headcover', 'buildTime']
      }
    },
    optionTypes: {
      hand: 'pill',
      puttingStyle: 'pill',
      headWeight: 'pill',
      shaft: 'swatchDropdown',
      shaftLength: 'select',
      lieAngle: 'select',
      putterColor: 'colorSwatch',
      alignmentMark: 'swatchDropdown',  // Front/Back 합쳐진 형태
      gripSelection: 'swatchDropdown',
      headcover: 'colorSwatch',
      buildTime: 'pill'
    }
  }
};

/**
 * 제품명으로 설정 가져오기
 */
function getProductConfig(productName) {
  const nameLower = productName.toLowerCase();

  if (nameLower.includes('oz.1i') || nameLower.includes('oz1i')) {
    return PRODUCT_CONFIGS['oz1i-hs'];
  }

  if (nameLower.includes('mezz') && nameLower.includes('max')) {
    return PRODUCT_CONFIGS['mezz1-max'];
  }

  // 기본값: OZ.1i
  return PRODUCT_CONFIGS['oz1i-hs'];
}

/**
 * 제품 타입 식별
 */
function getProductType(productName) {
  if (!productName) return 'oz1i-hs';
  const nameLower = productName.toLowerCase();

  // OZ.1i HS 먼저 체크 (더 구체적인 것 먼저)
  if ((nameLower.includes('oz.1i') || nameLower.includes('oz1i')) && nameLower.includes('hs')) {
    return 'oz1i-hs';
  }

  // OZ.1i (HS 없는 일반 버전)
  if (nameLower.includes('oz.1i') || nameLower.includes('oz1i')) {
    return 'oz1i';
  }

  // OZ.1 (OZ.1i가 아닌 경우)
  if ((nameLower.includes('oz.1') || nameLower.includes('oz1')) && !nameLower.includes('oz.1i') && !nameLower.includes('oz1i')) {
    return 'oz1';
  }

  if (nameLower.includes('mezz') && nameLower.includes('max')) {
    return 'mezz1-max';
  }

  if (nameLower.includes('link')) {
    return 'link1';
  }

  return 'oz1i-hs';
}

module.exports = {
  PRODUCT_CONFIGS,
  getProductConfig,
  getProductType
};
