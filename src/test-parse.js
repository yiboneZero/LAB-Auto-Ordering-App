const { parseOrderText, validateOptions, getProductUrl } = require('./parser');

const orderText = `MEZZ.1 MAX - CUSTOM
Hand: Right
Putting style: Standard
Head weight: Standard
Shaft: GEARS x L.A.B. (Black)
Shaft length: 35
Shaft lean: Std
Lie angle: 69°
Putter color: Purple
Alignment Front: Thick Line
Alignment Back: -
Grip selection: Press II 1.5º Smooth`;

console.log('=== 주문 문자열 파싱 테스트 ===\n');
console.log('입력:');
console.log(orderText);
console.log('\n' + '='.repeat(50) + '\n');

const options = parseOrderText(orderText);
console.log('파싱 결과:');
console.log(JSON.stringify(options, null, 2));

console.log('\n' + '='.repeat(50) + '\n');

const validation = validateOptions(options);
console.log('검증 결과:');
console.log('유효:', validation.valid);
console.log('누락된 필드:', validation.missing);

console.log('\n' + '='.repeat(50) + '\n');

const productUrl = getProductUrl(options.product);
console.log('제품 URL:', productUrl);
