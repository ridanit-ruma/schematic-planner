import { z } from 'zod';

export const createFolderSchema = z.object({
  name: z.string().min(1).max(80),
});
export type CreateFolderInput = z.infer<typeof createFolderSchema>;

export const updateFolderSchema = z.object({
  name: z.string().min(1).max(80),
});
export type UpdateFolderInput = z.infer<typeof updateFolderSchema>;
