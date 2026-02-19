// 제품별 옵션 구조 정의 (1단계 구조 - wholesale)

const PRODUCT_CONFIGS = {
  // OZ.1i HS Custom
  'oz1i-hs': {
    name: 'OZ.1i HS Custom',
    options: ['hand', 'puttingStyle', 'headWeight', 'shaft', 'lieAngle', 'putterColor', 'alignmentMark', 'gripSelection', 'headcover', 'buildTime'],
    optionTypes: {
      hand: 'pill',
      puttingStyle: 'pill',
      headWeight: 'pill',
      shaft: 'select',
      lieAngle: 'select',
      putterColor: 'colorSwatch',
      alignmentMark: 'select',
      gripSelection: 'select',
      headcover: 'swatch',
      buildTime: 'radio'
    }
  },

  // OZ.1i Custom
  'oz1i': {
    name: 'OZ.1i Custom',
    options: ['hand', 'puttingStyle', 'headWeight', 'shaft', 'lieAngle', 'putterColor', 'alignmentMark', 'gripSelection', 'headcover', 'buildTime'],
    optionTypes: {
      hand: 'pill',
      puttingStyle: 'pill',
      headWeight: 'pill',
      shaft: 'select',
      lieAngle: 'select',
      putterColor: 'colorSwatch',
      alignmentMark: 'select',
      gripSelection: 'select',
      headcover: 'swatch',
      buildTime: 'radio'
    }
  },

  // OZ.1 Custom
  'oz1': {
    name: 'OZ.1 Custom',
    options: ['hand', 'puttingStyle', 'headWeight', 'shaft', 'lieAngle', 'putterColor', 'alignmentMark', 'gripSelection', 'headcover', 'buildTime'],
    optionTypes: {
      hand: 'pill',
      puttingStyle: 'pill',
      headWeight: 'pill',
      shaft: 'select',
      lieAngle: 'select',
      putterColor: 'colorSwatch',
      alignmentMark: 'select',
      gripSelection: 'select',
      headcover: 'swatch',
      buildTime: 'radio'
    }
  },

  // DF3 Custom
  'df3': {
    name: 'DF3 Custom',
    options: ['hand', 'puttingStyle', 'headWeight', 'shaft', 'lieAngle', 'putterColor', 'alignmentMark', 'gripSelection', 'headcover', 'buildTime'],
    optionTypes: {
      hand: 'pill',
      puttingStyle: 'pill',
      headWeight: 'pill',
      shaft: 'select',
      lieAngle: 'select',
      putterColor: 'colorSwatch',
      alignmentMark: 'select',
      gripSelection: 'select',
      headcover: 'swatch',
      buildTime: 'radio'
    }
  },

  // DF 2.1 Custom
  'df21': {
    name: 'DF 2.1 Custom',
    options: ['hand', 'puttingStyle', 'headWeight', 'shaft', 'lieAngle', 'putterColor', 'alignmentMark', 'gripSelection', 'headcover', 'buildTime'],
    optionTypes: {
      hand: 'pill',
      puttingStyle: 'pill',
      headWeight: 'pill',
      shaft: 'select',
      lieAngle: 'select',
      putterColor: 'colorSwatch',
      alignmentMark: 'select',
      gripSelection: 'select',
      headcover: 'swatch',
      buildTime: 'radio'
    }
  },

  // MEZZ.1 MAX Custom
  'mezz1-max': {
    name: 'MEZZ.1 MAX Custom',
    options: ['hand', 'puttingStyle', 'headWeight', 'shaft', 'lieAngle', 'putterColor', 'alignmentMark', 'gripSelection', 'headcover', 'buildTime'],
    optionTypes: {
      hand: 'pill',
      puttingStyle: 'pill',
      headWeight: 'pill',
      shaft: 'select',
      lieAngle: 'select',
      putterColor: 'colorSwatch',
      alignmentMark: 'select',
      gripSelection: 'select',
      headcover: 'swatch',
      buildTime: 'radio'
    }
  },

  // LINK.1 Custom
  'link1': {
    name: 'LINK.1 Custom',
    options: ['hand', 'puttingStyle', 'shaft', 'lieAngle', 'putterColor', 'alignmentMark', 'gripSelection', 'headcover', 'buildTime'],
    optionTypes: {
      hand: 'pill',
      puttingStyle: 'pill',
      shaft: 'select',
      lieAngle: 'select',
      putterColor: 'colorSwatch',
      alignmentMark: 'select',
      gripSelection: 'select',
      headcover: 'swatch',
      buildTime: 'radio'
    }
  }
};

/**
 * 제품명으로 설정 가져오기
 */
function getProductConfig(productName) {
  const type = getProductType(productName);
  return PRODUCT_CONFIGS[type] || PRODUCT_CONFIGS['oz1i-hs'];
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

  if (nameLower.includes('df3')) {
    return 'df3';
  }

  // DF 2.1 체크 (df2.1, df 2.1, df21 등)
  if (nameLower.includes('df2.1') || nameLower.includes('df 2.1') || nameLower.includes('df21')) {
    return 'df21';
  }

  return 'oz1i-hs';
}

module.exports = {
  PRODUCT_CONFIGS,
  getProductConfig,
  getProductType
};
