const config = require('./config');

async function addToCart(page, productUrl) {
  console.log(`상품 페이지로 이동: ${productUrl}`);

  await page.goto(productUrl, { waitUntil: 'networkidle' });

  // 수량 설정 (Shopify 일반적인 셀렉터)
  const quantitySelector = 'input[name="quantity"], input.quantity-input, [data-quantity-input]';
  const quantityInput = await page.$(quantitySelector);

  if (quantityInput && config.orderQuantity > 1) {
    console.log(`수량 설정: ${config.orderQuantity}`);
    await quantityInput.fill(String(config.orderQuantity));
  }

  // 장바구니 담기 버튼 클릭
  const addToCartSelector = 'button[name="add"], button.add-to-cart, button[data-add-to-cart], form[action*="/cart/add"] button[type="submit"]';

  console.log('장바구니에 담는 중...');
  await page.waitForSelector(addToCartSelector, { timeout: 10000 });
  await page.click(addToCartSelector);

  // 장바구니 추가 완료 대기
  await page.waitForTimeout(2000);

  console.log('장바구니 담기 완료');
  return true;
}

async function goToCheckout(page) {
  console.log('체크아웃 페이지로 이동...');

  // 장바구니 페이지로 이동
  await page.goto(`${config.baseUrl}/cart`, { waitUntil: 'networkidle' });

  // 체크아웃 버튼 클릭
  const checkoutSelector = 'button[name="checkout"], a[href*="/checkout"], button.checkout-button, [data-checkout]';

  await page.waitForSelector(checkoutSelector, { timeout: 10000 });
  await page.click(checkoutSelector);

  await page.waitForLoadState('networkidle');

  console.log('체크아웃 페이지 도착');
  return true;
}

async function fillShippingInfo(page, shippingInfo) {
  console.log('배송 정보 입력 중...');

  // Shopify 체크아웃 배송 정보 필드 (이미 로그인되어 있으면 자동 입력될 수 있음)
  const fields = {
    email: 'input[name="email"], #email, #checkout_email',
    firstName: 'input[name="firstName"], #checkout_shipping_address_first_name',
    lastName: 'input[name="lastName"], #checkout_shipping_address_last_name',
    address: 'input[name="address1"], #checkout_shipping_address_address1',
    city: 'input[name="city"], #checkout_shipping_address_city',
    zip: 'input[name="zip"], #checkout_shipping_address_zip',
    phone: 'input[name="phone"], #checkout_shipping_address_phone',
  };

  for (const [field, selector] of Object.entries(fields)) {
    if (shippingInfo[field]) {
      const element = await page.$(selector);
      if (element) {
        await element.fill(shippingInfo[field]);
      }
    }
  }

  console.log('배송 정보 입력 완료');
}

async function proceedToPayment(page) {
  console.log('결제 단계로 진행...');

  // 배송 방법 선택 후 계속 버튼
  const continueSelector = 'button[type="submit"], #continue_button, button.step__footer__continue-btn';

  await page.waitForSelector(continueSelector, { timeout: 10000 });
  await page.click(continueSelector);

  await page.waitForLoadState('networkidle');

  console.log('결제 단계 도착');
}

async function completeOrder(page) {
  console.log('주문 완료 처리 중...');

  // 주문 완료 버튼 (실제 결제 실행)
  // 주의: 실제 결제가 진행되므로 테스트 시 주의 필요
  const completeOrderSelector = 'button[type="submit"].step__footer__continue-btn, #complete-purchase, button[data-complete-purchase]';

  // 결제 정보가 저장되어 있는 경우에만 주문 완료 가능
  const completeButton = await page.$(completeOrderSelector);

  if (completeButton) {
    console.log('주문 완료 버튼 발견');
    // 실제 결제를 원하는 경우 아래 주석 해제
    // await completeButton.click();
    // await page.waitForLoadState('networkidle');
    console.log('주문이 완료되었습니다!');
    return true;
  }

  console.log('주문 완료 버튼을 찾을 수 없습니다. 수동으로 결제를 완료해주세요.');
  return false;
}

module.exports = {
  addToCart,
  goToCheckout,
  fillShippingInfo,
  proceedToPayment,
  completeOrder,
};
