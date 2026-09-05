import { z } from 'zod';

import { ROLES } from './roles.js';

export const createWorkspaceSchema = z.object({
  name: z.string().min(1).max(80),
});
export type CreateWorkspaceInput = z.infer<typeof createWorkspaceSchema>;

export const createInviteSchema = z.object({
  role: z.enum(ROLES).default('EDITOR'),
  email: z.string().email().max(320).optional(),
  /** Days the link stays usable. */
  expiresInDays: z.coerce.number().int().min(1).max(90).default(14),
});
export type CreateInviteInput = z.infer<typeof createInviteSchema>;

export const createApiKeySchema = z.object({
  name: z.string().min(1).max(80),
});
export type CreateApiKeyInput = z.infer<typeof createApiKeySchema>;

export const updateMemberSchema = z.object({
  role: z.enum(ROLES),
});
export type UpdateMemberInput = z.infer<typeof updateMemberSchema>;
