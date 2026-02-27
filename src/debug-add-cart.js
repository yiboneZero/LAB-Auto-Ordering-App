/**
 * Add to Cart 클릭 후 DOM 변화 분석 스크립트
 *
 * 사용법:
 *   1. Chrome에서 wholesale.labgolf.com 상품 페이지를 열고 옵션 선택까지 완료
 *   2. node src/debug-add-cart.js
 *
 * 분석 항목:
 *   - 클릭 전 카트 수량/상태
 *   - URL 변화 여부
 *   - 팝업/알림 요소 출현
 *   - 카트 아이콘 배지 변화
 *   - 성공/에러 메시지 요소
 */

const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.connectOverCDP('http://localhost:9222');
  const page = browser.contexts()[0].pages()[0];

  const currentUrl = page.url();
  console.log('현재 URL:', currentUrl);
  console.log('');

  // ── 클릭 전 스냅샷 ──────────────────────────────
  const before = await page.evaluate(() => {
    // 카트 배지/수량 가능한 셀렉터들
    const cartCountSelectors = [
      '.cart-count', '.cart-item-count', '[data-cart-count]',
      '.CartCount', '.cart__count', '#CartCount',
      '.icon-cart-count', '.header__cart-count',
      'a[href="/cart"] .count', 'a[href*="cart"] span',
    ];

    let cartCount = null;
    let cartCountEl = null;
    for (const sel of cartCountSelectors) {
      const el = document.querySelector(sel);
      if (el) {
        cartCount = el.textContent?.trim();
        cartCountEl = sel;
        break;
      }
    }

    // Add to Cart 버튼 상태
    const btn = document.querySelector('button.avis-new-addcart-button, button[name="add"]');

    // 현재 보이는 팝업/알림 요소 확인
    const popupSelectors = [
      '.cart-notification', '.cart-popup', '.cart-drawer',
      '.added-to-cart', '.cart-success', '[data-cart-notification]',
      '.fancybox-container', '.modal', '[aria-live]',
    ];
    const visiblePopups = popupSelectors
      .map(sel => ({ sel, el: document.querySelector(sel) }))
      .filter(({ el }) => el && el.offsetParent !== null)
      .map(({ sel, el }) => ({ sel, text: el.textContent?.trim().slice(0, 80) }));

    return {
      url: location.href,
      cartCount,
      cartCountEl,
      btnText: btn?.textContent?.trim(),
      btnDisabled: btn?.disabled,
      btnExists: !!btn,
      visiblePopups,
    };
  });

  console.log('=== [클릭 전] 상태 ===');
  console.log('카트 수량 셀렉터:', before.cartCountEl || '없음');
  console.log('카트 수량 텍스트:', before.cartCount ?? '(없음)');
  console.log('버튼 텍스트:', before.btnText);
  console.log('버튼 disabled:', before.btnDisabled);
  console.log('기존 팝업:', before.visiblePopups.length > 0 ? JSON.stringify(before.visiblePopups) : '없음');
  console.log('');

  if (!before.btnExists) {
    console.log('❌ Add to Cart 버튼을 찾지 못했습니다. 상품 페이지에서 옵션 선택 후 실행하세요.');
    await browser.close();
    return;
  }

  // ── 클릭 직전 URL 기록 ──────────────────────────
  const urlBefore = page.url();

  // ── URL 변화 감지 리스너 ─────────────────────────
  let urlChanged = false;
  let newUrl = null;
  const urlListener = (url) => {
    urlChanged = true;
    newUrl = url.toString();
  };
  page.on('framenavigated', urlListener);

  // ── 클릭 ─────────────────────────────────────────
  console.log('🖱️  Add to Cart 클릭...');
  const clickTime = Date.now();

  await page.evaluate(() => {
    const btn = document.querySelector('button.avis-new-addcart-button, button[name="add"]');
    if (btn) btn.click();
  });

  // ── 변화 폴링 (최대 8초) ──────────────────────────
  const signals = [];
  let elapsed = 0;
  const interval = 200;

  while (elapsed < 8000) {
    await new Promise(r => setTimeout(r, interval));
    elapsed += interval;

    const snapshot = await page.evaluate((urlBefore) => {
      const cartCountSelectors = [
        '.cart-count', '.cart-item-count', '[data-cart-count]',
        '.CartCount', '.cart__count', '#CartCount',
        '.icon-cart-count', '.header__cart-count',
        'a[href="/cart"] .count', 'a[href*="cart"] span',
      ];
      let cartCount = null;
      let cartCountEl = null;
      for (const sel of cartCountSelectors) {
        const el = document.querySelector(sel);
        if (el) { cartCount = el.textContent?.trim(); cartCountEl = sel; break; }
      }

      // 팝업/알림 요소 탐색 (숨겨진 것 포함)
      const popupSelectors = [
        '.cart-notification', '.cart-popup', '.cart-drawer',
        '.added-to-cart', '.cart-success', '[data-cart-notification]',
        '.fancybox-container', '.fancybox-slide',
        '[aria-live]', '[role="dialog"]', '[role="alert"]',
        '.modal', '.modal-content', '.drawer',
        // Avis Plus 특화
        '.avis-cart-notification', '.avp-cart-popup',
      ];

      const popups = popupSelectors
        .map(sel => {
          const el = document.querySelector(sel);
          if (!el) return null;
          const visible = el.offsetParent !== null || window.getComputedStyle(el).display !== 'none';
          return { sel, visible, text: el.textContent?.trim().slice(0, 100) };
        })
        .filter(Boolean);

      // 성공/에러 텍스트 포함 요소 탐색
      const allText = document.body.innerText;
      const hasSuccessText = /added to cart|장바구니에 추가|successfully added/i.test(allText);

      return {
        url: location.href,
        urlChanged: location.href !== urlBefore,
        cartCount,
        cartCountEl,
        popups,
        hasSuccessText,
      };
    }, urlBefore);

    // 변화 감지 시 기록
    const found = [];
    if (snapshot.urlChanged) found.push(`URL 변경: ${snapshot.url}`);
    if (snapshot.cartCount !== before.cartCount) found.push(`카트 수량 변화: "${before.cartCount}" → "${snapshot.cartCount}" (${snapshot.cartCountEl})`);
    if (snapshot.hasSuccessText) found.push('성공 텍스트 감지');
    const newPopups = snapshot.popups.filter(p => p.visible);
    if (newPopups.length > before.visiblePopups.length) {
      found.push(`팝업 출현: ${JSON.stringify(newPopups.map(p => ({ sel: p.sel, text: p.text })))}`);
    }

    if (found.length > 0) {
      signals.push({ ms: elapsed, found });
      console.log(`[+${elapsed}ms]`, found.join(' | '));

      // URL 이동이 확인되면 더 기다릴 필요 없음
      if (snapshot.urlChanged && snapshot.url.includes('cart')) {
        console.log('✅ 카트 페이지로 이동 확인');
        break;
      }
    }
  }

  page.off('framenavigated', urlListener);

  // ── 클릭 후 최종 스냅샷 ─────────────────────────
  console.log('');
  const after = await page.evaluate(() => {
    // 현재 DOM에서 가능한 성공 확인 셀렉터 전수조사
    const candidates = [
      // 일반 카트 알림
      '.cart-notification', '.cart-notification__heading', '.cart-notification__links',
      '.cart-popup', '.cart-drawer', '.cart-success',
      // Shopify 기본
      '[data-cart-notification]', '.shopify-section-cart-notification',
      // Avis 테마
      '.avis-cart-notification', '[class*="cart-notification"]',
      '[class*="cart-popup"]', '[class*="cart-drawer"]',
      // 모달
      '[role="dialog"]', '[role="alert"]', '[aria-live]',
      // 기타 팝업
      '.fancybox-container', '.fancybox-slide', '.fancybox-content',
    ];

    const results = [];
    for (const sel of candidates) {
      const els = document.querySelectorAll(sel);
      for (const el of els) {
        const visible = el.offsetParent !== null;
        const text = el.textContent?.trim().slice(0, 120);
        if (el.children.length > 0 || text) {
          results.push({ sel, visible, text, class: el.className });
        }
      }
    }

    // 카트 관련 data attribute 전수조사
    const cartDataEls = document.querySelectorAll('[data-cart], [data-cart-count], [data-item-count]');
    const cartData = Array.from(cartDataEls).map(el => ({
      tag: el.tagName,
      attrs: {
        'data-cart': el.getAttribute('data-cart'),
        'data-cart-count': el.getAttribute('data-cart-count'),
        'data-item-count': el.getAttribute('data-item-count'),
      },
      text: el.textContent?.trim().slice(0, 50),
    }));

    return { candidates: results, cartData };
  });

  console.log('=== [클릭 후] DOM 분석 ===');
  if (after.candidates.length === 0) {
    console.log('  관련 요소 없음');
  } else {
    after.candidates.forEach(c => {
      console.log(`  [${c.visible ? '보임' : '숨김'}] ${c.sel}`);
      if (c.text) console.log(`    텍스트: "${c.text}"`);
      if (c.class) console.log(`    class: "${c.class.slice(0, 80)}"`);
    });
  }

  console.log('');
  console.log('=== 카트 data 속성 ===');
  if (after.cartData.length === 0) {
    console.log('  없음');
  } else {
    after.cartData.forEach(d => console.log('  ', JSON.stringify(d)));
  }

  console.log('');
  console.log('=== 결론 ===');
  if (signals.length === 0) {
    console.log('⚠️  8초 내 확인 가능한 신호 없음 → 사이트가 AJAX 추가 후 아무 피드백도 없는 방식일 수 있음');
    console.log('   → 카트 API(/cart.js)를 폴링하는 방법 고려 필요');
  } else {
    console.log('감지된 신호:');
    signals.forEach(s => console.log(`  +${s.ms}ms:`, s.found.join(', ')));
  }

  await browser.close();
})().catch(console.error);
