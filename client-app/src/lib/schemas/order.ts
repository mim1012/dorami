import { z } from 'zod';

export const orderStatusSchema = z.object({
  status: z.enum(['PENDING_PAYMENT', 'PAYMENT_CONFIRMED', 'SHIPPED', 'DELIVERED', 'CANCELLED'], {
    errorMap: () => ({ message: '유효한 주문 상태를 선택해주세요' }),
  }),
  notes: z.string().max(500, '메모는 500자 이하로 입력해주세요').optional(),
});

export type OrderStatusFormData = z.infer<typeof orderStatusSchema>;
export type OrderStatusFormErrors = Partial<Record<keyof OrderStatusFormData, string>>;

export function validateOrderStatusForm(data: OrderStatusFormData): OrderStatusFormErrors {
  const result = orderStatusSchema.safeParse(data);
  if (result.success) return {};

  const errors: OrderStatusFormErrors = {};
  for (const issue of result.error.issues) {
    const key = issue.path[0] as keyof OrderStatusFormData;
    if (key && !errors[key]) {
      errors[key] = issue.message;
    }
  }
  return errors;
}
