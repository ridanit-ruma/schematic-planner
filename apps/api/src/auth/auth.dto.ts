import { z } from 'zod';

export const registerSchema = z.object({
  email: z.string().email().max(320),
  name: z.string().min(1).max(80),
  password: z.string().min(10).max(200),
});
export type RegisterInput = z.infer<typeof registerSchema>;

export const loginSchema = z.object({
  email: z.string().email().max(320),
  password: z.string().min(1).max(200),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const updateProfileSchema = z.object({
  name: z.string().min(1).max(80),
});
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1).max(200),
  newPassword: z.string().min(10).max(200),
});
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;

export const deleteAccountSchema = z.object({
  password: z.string().min(1).max(200),
  /** Typed confirmation, because this cannot be undone. */
  confirm: z.literal('delete my account'),
});
export type DeleteAccountInput = z.infer<typeof deleteAccountSchema>;
