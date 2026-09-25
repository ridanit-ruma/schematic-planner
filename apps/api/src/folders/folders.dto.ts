import { z } from 'zod';

/** Null, or left out, is the project's own top level. */
const parentId = z.string().min(1).nullish();

/** Trimmed, because two names that differ only in outer spaces are one name. */
const name = z.string().trim().min(1).max(80);

export const createFolderSchema = z.object({
  name,
  parentId,
});
export type CreateFolderInput = z.infer<typeof createFolderSchema>;

/** A rename, a move, or both. `parentId: null` moves it to the top level. */
export const updateFolderSchema = z
  .object({
    name: name.optional(),
    parentId,
  })
  .refine((input) => input.name !== undefined || input.parentId !== undefined, {
    message: 'Give a name, a parentId, or both',
  });
export type UpdateFolderInput = z.infer<typeof updateFolderSchema>;
