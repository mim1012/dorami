import { test, expect, APIResponse } from '@playwright/test';
import { ensureAuth, gotoWithRetry } from './helpers/auth-helper';

type AdminOrderListResponse = {
  orders?: Array<{
    id: string;
    status?: string;
  }>;
};

const TABLE_HEADERS = [
  '주문번호',
  '상품명',
  '색상',
  '사이즈',
  '인스타 ID',
  '주문일시',
  '결제일시',
  '상태',
];
const ORDER_STATUS_LABELS = ['입금 대기', '입금 완료', '배송중', '배송 완료', '취소'];
const ORDER_SEARCH_PLACEHOLDER = '주문번호, 이메일, 입금자명, 인스타그램 ID로 검색...';

const extractData = async (response: APIResponse): Promise<AdminOrderListResponse> => {
  const body = await response
    .json()
    .catch(() => ({ data: null, orders: [], total: 0, page: 1, limit: 20, totalPages: 0 }));

  if (body?.data && typeof body.data === 'object' && !Array.isArray(body.data)) {
    return body.data as AdminOrderListResponse;
  }

  return body as AdminOrderListResponse;
};

const parseOrderList = (responseBody: AdminOrderListResponse) => {
  const orders = responseBody?.orders ?? [];
  return {
    orders,
    total: orders.length,
  };
};

const resolveAdminOrders = async (page: any, params: Record<string, string> = {}) => {
  const query = {
    page: '1',
    limit: '10',
    sortBy: 'createdAt',
    sortOrder: 'desc',
    ...params,
  };

  const response = await page.request.get('/api/admin/orders', { params: query });
  return {
    response,
    payload: await extractData(response),
  };
};

test.describe('Smoke - Admin Orders Management', () => {
  test.setTimeout(180000);

  test.beforeEach(async ({ page }) => {
    await ensureAuth(page, 'ADMIN');
  });

  test('SMOKE-ADMIN-ORD-01: 주문 관리 페이지 핵심 UI가 노출되는지 검증', async ({ page }) => {
    await gotoWithRetry(page, '/admin/orders', {
      waitForSelector: 'table',
      role: 'ADMIN',
    });

    await expect(page.getByRole('heading', { name: '주문 관리' })).toBeVisible({ timeout: 15000 });
    await expect(page.getByText('모든 고객 주문을 조회하고 관리합니다')).toBeVisible();
    await expect(page.getByPlaceholder(ORDER_SEARCH_PLACEHOLDER)).toBeVisible();
    await expect(page.getByRole('button', { name: '필터 보기' })).toBeVisible();
    await expect(page.getByRole('button', { name: '엑셀 내보내기' })).toBeVisible();

    for (const header of TABLE_HEADERS) {
      await expect(page.getByRole('columnheader', { name: header })).toBeVisible({ timeout: 5000 });
    }

    const noDataMessage = await page
      .locator('td', { hasText: '필터 조건에 맞는 주문이 없습니다' })
      .isVisible({ timeout: 5000 })
      .catch(() => false);

    if (!noDataMessage) {
      const firstRow = page.locator('tbody tr').first();
      await expect(firstRow).toBeVisible({ timeout: 5000 });

      const orderId = (await firstRow.locator('td').first().textContent())?.trim() ?? '';
      expect(orderId, '주문번호가 비어 있음').toBeTruthy();

      const hasStatusAction = await Promise.all(
        ORDER_STATUS_LABELS.map((label) =>
          firstRow
            .locator('td')
            .last()
            .getByRole('button', { name: label })
            .isVisible()
            .catch(() => false),
        ),
      );
      expect(hasStatusAction.some(Boolean), '상태 변경 버튼이 노출되어야 함').toBeTruthy();
      console.log(`주문 행 샘플: ${orderId}`);
    } else {
      await expect(page.getByRole('table')).toBeVisible();
      await expect(page.getByText('필터 조건에 맞는 주문이 없습니다')).toBeVisible();
      console.log('주문 데이터가 없거나 필터/조건 미충족 상태로 빈 상태 화면 표시');
    }
  });

  test('SMOKE-ADMIN-ORD-02: 검색/필터 파라미터가 URL과 연동되는지 검증', async ({ page }) => {
    await gotoWithRetry(page, '/admin/orders', {
      waitForSelector: 'table',
      role: 'ADMIN',
    });

    const searchInput = page.getByPlaceholder(ORDER_SEARCH_PLACEHOLDER);
    const uniqueKeyword = `smoke-admin-${Date.now()}`;

    await searchInput.fill(uniqueKeyword);
    await expect(page).toHaveURL(/search=/, { timeout: 5000 });
    await expect(searchInput).toHaveValue(uniqueKeyword);

    await searchInput.fill('');
    await expect(page).toHaveURL(/\/admin\/orders/, { timeout: 5000 });

    await page.getByRole('button', { name: '필터 보기' }).click();
    await expect(page.getByText('주문 상태')).toBeVisible({ timeout: 5000 });
    await page.getByRole('button', { name: '입금 대기' }).click();

    await expect(page).toHaveURL(/orderStatus=/, { timeout: 5000 });

    await page.getByRole('button', { name: '필터 숨기기' }).click();
    await expect(page.getByText('주문 상태')).not.toBeVisible({ timeout: 3000 });
  });

  test('SMOKE-ADMIN-ORD-03: 관리자 주문 API 응답 스키마가 정상인지 확인', async ({ page }) => {
    await gotoWithRetry(page, '/admin/orders', {
      waitForSelector: 'table',
      role: 'ADMIN',
    });

    const { response, payload } = await resolveAdminOrders(page, {
      orderStatus: 'PENDING_PAYMENT',
    });

    expect(response.ok(), `admin/orders API 요청 실패 status=${response.status()}`).toBeTruthy();

    const { orders } = parseOrderList(payload);
    expect(Array.isArray(orders), 'orders가 배열이어야 함').toBeTruthy();

    if (orders.length > 0) {
      const invalidIds = orders.some((order) => {
        const id = order?.id || '';
        return !/^[A-Z]{3}-\d{8}-\d{5}$/.test(id);
      });
      expect(invalidIds, '주문 ID 포맷이 ORD-YYYYMMDD-XXXXX 여야 함').toBeFalsy();

      const invalidStatus = orders.some((order) => {
        const status = order?.status || '';
        return ![
          'PENDING_PAYMENT',
          'PAYMENT_CONFIRMED',
          'SHIPPED',
          'DELIVERED',
          'CANCELLED',
        ].includes(status);
      });
      expect(invalidStatus, '주문 상태 값이 정의된 값이어야 함').toBeFalsy();
    }

    console.log(`admin/orders 응답 주문 수: ${orders.length}`);
  });
});
