const { initBrowser, closeBrowser } = require('./browser');
const { waitForManualLogin } = require('./login');

async function testStep1() {
  console.log('='.repeat(50));
  console.log('Step 1 (FOUNDATION) 테스트');
  console.log('='.repeat(50));

  let page;

  try {
    page = await initBrowser();

    // 수동 로그인 대기
    await waitForManualLogin(page);

    // 상품 페이지로 이동
    console.log('\n상품 페이지로 이동...');
    await page.goto('https://labgolf.com/products/oz1i-hs-custom', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(3000);

    // Step 1 옵션들
    const step1Options = {
      'Hand': 'LEFT',
      'Putting style': 'STANDARD',
      'Head weight': 'LIGHTER'
    };

    console.log('\n=== Step 1 옵션 선택 ===\n');

    for (const [optionName, value] of Object.entries(step1Options)) {
      console.log(`${optionName}: ${value} 선택 시도...`);

      // 이미 선택되어 있는지 확인 후 클릭
      const result = await page.evaluate((val) => {
        const labels = document.querySelectorAll('label.avp-pilloptioncheckwrapper');
        for (const label of labels) {
          const text = label.textContent?.trim();
          if (text === val) {
            // 내부 input의 checked 상태 확인
            const input = label.querySelector('input[type="radio"]');
            const isAlreadySelected = input?.checked || false;

            if (isAlreadySelected) {
              return { success: true, alreadySelected: true };
            } else {
              label.click();
              return { success: true, alreadySelected: false };
            }
          }
        }
        return { success: false };
      }, value);

      if (result.success) {
        if (result.alreadySelected) {
          console.log(`  ✓ ${optionName}: ${value} (이미 선택됨 - 클릭 안함)`);
        } else {
          console.log(`  ✓ ${optionName}: ${value} 선택 완료`);
        }
      } else {
        console.log(`  ✗ ${optionName}: ${value} 선택 실패`);
      }

      await page.waitForTimeout(500);
    }

    // NEXT STEP 버튼 확인
    console.log('\n=== NEXT STEP 버튼 확인 ===');
    const nextButtonText = await page.evaluate(() => {
      const buttons = document.querySelectorAll('button, a');
      for (const btn of buttons) {
        const text = btn.textContent?.trim();
        if (text && text.includes('NEXT STEP')) {
          return { found: true, text: text, enabled: !btn.disabled };
        }
      }
      return { found: false };
    });

    if (nextButtonText.found) {
      console.log(`  버튼 발견: "${nextButtonText.text}" (enabled: ${nextButtonText.enabled})`);
    } else {
      console.log('  NEXT STEP 버튼을 찾을 수 없음');
    }

    console.log('\n60초 대기 - 브라우저에서 결과를 확인하세요...');
    await page.waitForTimeout(60000);

  } catch (error) {
    console.error('오류:', error.message);
  } finally {
    await closeBrowser();
  }
}

testStep1();
