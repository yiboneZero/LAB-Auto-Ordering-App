// 배치 주문 실행 모듈
const { executeOrder, updateStatus, setBatchContext, clearBatchContext } = require('./order-executor-v2');

let isBatchRunning = false;
let batchResults = null;
let activeBatchId = null;
let stoppedState = null; // 중지된 배치 상태 (이어하기용)

/**
 * 여러 주문을 순차적으로 실행
 * @param {object[]} ordersList - csvRowToOptions 결과 배열
 * @param {number} startIndex - 시작 인덱스 (이어하기 시)
 * @param {object[]} prevResults - 이전 결과 (이어하기 시)
 * @returns {object} 배치 실행 결과
 */
async function executeBatch(ordersList, startIndex = 0, prevResults = []) {
  if (isBatchRunning) {
    return { success: false, message: '이미 배치가 실행 중입니다.' };
  }

  const batchId = Date.now();
  activeBatchId = batchId;
  isBatchRunning = true;
  stoppedState = null; // 새 배치 시작 시 이전 중지 상태 제거
  const total = ordersList.length;
  const results = [...prevResults];
  console.log(`[BATCH] 시작 batchId=${batchId}, orders=${total}, startIndex=${startIndex}, prevResults=${prevResults.length}`);

  try {
    for (let i = startIndex; i < ordersList.length; i++) {
      if (activeBatchId !== batchId) {
        console.log(`\n배치 중지됨 (${results.length}/${total} 완료)`);
        // 이어하기를 위해 상태 저장
        stoppedState = { ordersList, startIndex: i, results: [...results] };
        console.log(`[BATCH] 중지 상태 저장: startIndex=${i}, results=${results.length}`);
        break;
      }

      const order = ordersList[i];
      const current = i + 1;
      const label = `[${current}/${total}] ${order.orderId || ''} ${order.options.product}`;

      const batchCtx = { current, total, orderId: order.orderId, product: order.options.product, results: [...results] };
      setBatchContext(batchCtx);

      updateStatus('running', `${label} - 주문 실행 중...`, 'batch', Math.round((i / total) * 100), batchCtx);

      console.log(`\n${'='.repeat(50)}`);
      console.log(`배치 ${current}/${total}: ${order.orderId} - ${order.options.product}`);
      console.log(`${'='.repeat(50)}`);

      try {
        const result = await executeOrder(order.options, order.quantity || 1);
        results.push({
          index: current,
          orderId: order.orderId,
          store: order.store,
          product: order.options.product,
          success: result.success,
          message: result.message,
          failedOptions: result.failedOptions || [],
        });

        if (result.success) {
          console.log(`  => 성공`);
        } else {
          console.log(`  => 실패: ${result.message}`);
        }
      } catch (error) {
        console.log(`  => 오류: ${error.message}`);
        results.push({
          index: current,
          orderId: order.orderId,
          store: order.store,
          product: order.options.product,
          success: false,
          message: error.message,
          failedOptions: [],
        });
      }

      // 다음 주문 전 대기 (마지막 주문 제외)
      if (i < ordersList.length - 1) {
        updateStatus('running', `${label} - 완료. 다음 주문 준비 중...`, 'batch_wait', Math.round(((i + 1) / total) * 100), {
          current, total, orderId: order.orderId, product: order.options.product, results: [...results],
        });
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    const successCount = results.filter(r => r.success).length;
    const failedCount = results.filter(r => !r.success).length;
    const skippedCount = total - results.length;
    const wasCancelled = activeBatchId !== batchId;
    const summary = wasCancelled
      ? `배치 중지: ${total}건 중 ${results.length}건 실행 (${successCount}건 성공, ${failedCount}건 실패, ${skippedCount}건 미실행)`
      : `배치 완료: ${total}건 중 ${successCount}건 성공, ${failedCount}건 실패`;

    console.log(`\n${'='.repeat(50)}`);
    console.log(summary);
    results.forEach(r => {
      console.log(`  ${r.success ? '✓' : '✗'} ${r.orderId} ${r.product}: ${r.success ? '성공' : r.message}`);
    });
    console.log(`${'='.repeat(50)}\n`);

    const doneStep = wasCancelled ? 'batch_stopped' : 'batch_done';
    updateStatus(wasCancelled ? 'stopped' : 'completed', summary, doneStep, wasCancelled ? Math.round((results.length / total) * 100) : 100, {
      current: results.length, total, results,
    });

    batchResults = { success: true, total, successCount, failedCount, results };
    return batchResults;

  } catch (error) {
    updateStatus('error', `배치 오류: ${error.message}`, 'batch_error', 0);
    batchResults = { success: false, message: error.message, results };
    return batchResults;
  } finally {
    if (activeBatchId === batchId) {
      clearBatchContext();
      isBatchRunning = false;
      activeBatchId = null;
      console.log(`[BATCH] 정상 종료 batchId=${batchId}`);
    } else {
      console.log(`[BATCH] 무효화된 배치 종료 batchId=${batchId}, activeBatchId=${activeBatchId}`);
    }
  }
}

function getBatchStatus() {
  return { isBatchRunning, batchResults, canResume: !!stoppedState };
}

function stopBatch() {
  console.log(`[BATCH] stopBatch 호출: isBatchRunning=${isBatchRunning}, activeBatchId=${activeBatchId}`);
  if (!isBatchRunning) return false;
  activeBatchId = null;
  isBatchRunning = false;
  clearBatchContext();
  console.log(`[BATCH] stopBatch 완료: isBatchRunning=${isBatchRunning}`);
  return true;
}

function resumeBatch() {
  if (isBatchRunning) {
    return { success: false, message: '이미 배치가 실행 중입니다.' };
  }
  if (!stoppedState) {
    return { success: false, message: '이어할 배치가 없습니다.' };
  }
  const { ordersList, startIndex, results } = stoppedState;
  const remaining = ordersList.length - startIndex;
  console.log(`[BATCH] 이어하기: startIndex=${startIndex}, remaining=${remaining}, prevResults=${results.length}`);
  // stoppedState는 executeBatch 내부에서 null로 초기화됨
  executeBatch(ordersList, startIndex, results);
  return { success: true, message: `${remaining}건 이어하기 시작`, remaining };
}

function clearStoppedState() {
  stoppedState = null;
}

module.exports = {
  executeBatch,
  getBatchStatus,
  stopBatch,
  resumeBatch,
  clearStoppedState,
};
