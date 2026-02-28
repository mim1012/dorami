import { z } from 'zod';

export const userStatusSchema = z.object({
  status: z.enum(['ACTIVE', 'INACTIVE', 'SUSPENDED'], {
    errorMap: () => ({ message: '유효한 상태를 선택해주세요' }),
  }),
});

export type UserStatusFormData = z.infer<typeof userStatusSchema>;
export type UserStatusFormErrors = Partial<Record<keyof UserStatusFormData, string>>;

export function validateUserStatusForm(data: UserStatusFormData): UserStatusFormErrors {
  const result = userStatusSchema.safeParse(data);
  if (result.success) return {};

  const errors: UserStatusFormErrors = {};
  for (const issue of result.error.issues) {
    const key = issue.path[0] as keyof UserStatusFormData;
    if (key && !errors[key]) {
      errors[key] = issue.message;
    }
  }
  return errors;
}
