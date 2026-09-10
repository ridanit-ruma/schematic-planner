import { z } from 'zod';

export const createInviteSchema = z.object({
  /** What it is for, in the issuer's own words. Shown only to the issuer. */
  label: z.string().max(120).default(''),
  /** How many accounts it may make. Null is no limit. */
  maxUses: z.coerce.number().int().min(1).max(1000).nullable().default(1),
  /** How long it lasts, in days. Null is forever. */
  expiresInDays: z.coerce.number().int().min(1).max(365).nullable().default(14),
});
export type CreateInviteInput = z.infer<typeof createInviteSchema>;

export const updateAccountSchema = z.object({
  instanceRole: z.enum(['OWNER', 'MEMBER']).optional(),
  suspended: z.boolean().optional(),
});
export type UpdateAccountInput = z.infer<typeof updateAccountSchema>;
