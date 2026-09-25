import { PALETTE, vocabularyInputSchema } from '@schematic/schema';
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

/** The whole vocabulary, with the version it was read at. */
export const replaceVocabularySchema = vocabularyInputSchema;
export type ReplaceVocabularyInput = z.infer<typeof replaceVocabularySchema>;

/** One tag, made where it was typed. */
export const addTagSchema = z.object({
  name: z.string().trim().min(1).max(40),
  color: z.enum(PALETTE).optional(),
});
export type AddTagInput = z.infer<typeof addTagSchema>;
