import { z } from 'zod';

export const createProjectSchema = z.object({
  name: z.string().min(1).max(80),
  description: z.string().max(2000).default(''),
});
export type CreateProjectInput = z.infer<typeof createProjectSchema>;

export const updateProjectSchema = z.object({
  name: z.string().min(1).max(80).optional(),
  description: z.string().max(2000).optional(),
});
export type UpdateProjectInput = z.infer<typeof updateProjectSchema>;
