import { planOpsSchema, planSpecSchema } from '@schematic/schema';
import { z } from 'zod';

export const createPlanSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(2000).default(''),
  /** Optional initial structure, as an agent would submit it. */
  spec: planSpecSchema.optional(),
});
export type CreatePlanInput = z.infer<typeof createPlanSchema>;

export const updatePlanSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).optional(),
});
export type UpdatePlanInput = z.infer<typeof updatePlanSchema>;

export const applyOpsSchema = z.object({ ops: planOpsSchema });
export type ApplyOpsInput = z.infer<typeof applyOpsSchema>;

export const layoutSchema = z.object({
  direction: z.enum(['RIGHT', 'DOWN']).default('RIGHT'),
  scope: z.enum(['all', 'unpinned']).default('unpinned'),
});
export type LayoutInput = z.infer<typeof layoutSchema>;

export const shareSchema = z.object({
  expiresInDays: z.coerce.number().int().min(1).max(365).optional(),
});
export type ShareInput = z.infer<typeof shareSchema>;
