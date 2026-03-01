import { z } from 'zod';

export const productFormSchema = z
  .object({
    streamKey: z.string().optional(),
    name: z.string().min(1, '상품명을 입력해주세요').max(100, '상품명은 100자 이하로 입력해주세요'),
    price: z
      .string()
      .min(1, '가격을 입력해주세요')
      .refine((v) => !isNaN(parseFloat(v)) && parseFloat(v) > 0, {
        message: '가격은 0보다 큰 숫자여야 합니다',
      }),
    stock: z
      .string()
      .min(1, '재고를 입력해주세요')
      .refine((v) => !isNaN(parseInt(v)) && parseInt(v) >= 0, {
        message: '재고는 0 이상의 정수여야 합니다',
      }),
    colorOptions: z.string().optional(),
    sizeOptions: z.string().optional(),
    timerEnabled: z.boolean(),
    timerDurationHours: z.string().optional(),
    imageUrl: z
      .string()
      .optional()
      .refine((v) => !v || v.startsWith('http') || v.startsWith('/'), {
        message: '유효한 이미지 URL을 입력해주세요',
      }),
    images: z.array(z.string()),
    discountRate: z
      .string()
      .optional()
      .refine((v) => !v || (!isNaN(parseFloat(v)) && parseFloat(v) >= 0 && parseFloat(v) <= 100), {
        message: '할인율은 0~100 사이의 숫자여야 합니다',
      }),
    originalPrice: z
      .string()
      .optional()
      .refine((v) => !v || (!isNaN(parseFloat(v)) && parseFloat(v) > 0), {
        message: '정가는 0보다 큰 숫자여야 합니다',
      }),
    isNew: z.boolean(),
  })
  .refine(
    (data) => {
      if (data.timerEnabled && data.timerDurationHours) {
        const hours = parseInt(data.timerDurationHours);
        return !isNaN(hours) && hours >= 1 && hours <= 120;
      }
      return true;
    },
    {
      message: '타이머 시간은 1~120 사이여야 합니다',
      path: ['timerDurationHours'],
    },
  );

export type ProductFormData = z.infer<typeof productFormSchema>;
export type ProductFormErrors = Partial<Record<keyof ProductFormData, string>>;

export function validateProductForm(data: ProductFormData): ProductFormErrors {
  const result = productFormSchema.safeParse(data);
  if (result.success) return {};

  const errors: ProductFormErrors = {};
  for (const issue of result.error.issues) {
    const key = issue.path[0] as keyof ProductFormData;
    if (key && !errors[key]) {
      errors[key] = issue.message;
    }
  }
  return errors;
}
