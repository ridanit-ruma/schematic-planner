export {
  bodyExtensions,
  bodySchema,
  Callout,
  RawMarkdown,
  CALLOUT_VARIANTS,
  type CalloutVariant,
} from './schema.js';
export { markdownToJSON, markdownToDoc, parseMarkdown } from './parse.js';
export { jsonToMarkdown, docToMarkdown } from './serialize.js';
export { fragmentToJSON, fragmentToMarkdown, applyMarkdown } from './fragment.js';
export { shapeForDisplay } from './display.js';

/*
 * The option types of the extensions that make up the schema. Re-exported so
 * that a package importing this one also sees the editor commands those
 * extensions declare (`toggleTaskList`, `insertTable`, `setDetails`, …).
 */
export type { StarterKitOptions } from '@tiptap/starter-kit';
export type { TableOptions } from '@tiptap/extension-table';
export type { TaskListOptions } from '@tiptap/extension-list';
export type { DetailsOptions } from '@tiptap/extension-details';
