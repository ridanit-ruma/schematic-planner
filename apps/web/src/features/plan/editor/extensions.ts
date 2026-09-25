import { markdownToDoc } from '@schematic/body';
import { Extension } from '@tiptap/core';
import { Slice } from '@tiptap/pm/model';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import Suggestion, { type SuggestionKeyDownProps, type SuggestionProps } from '@tiptap/suggestion';

import type { Block } from './blocks';

export interface SlashMenuBridge {
  /** Called with the open menu's state, or null once it closes. */
  readonly onChange: (props: SuggestionProps<Block, Block> | null) => void;
  /** The open menu's keyboard handling; true when it used the key. */
  readonly onKeyDown: (event: KeyboardEvent) => boolean;
  readonly items: (query: string) => Block[];
}

/**
 * `/` opens a menu of blocks. The menu itself is React, drawn by the editor
 * component; this only reports what was typed and where.
 */
export const SlashCommand = Extension.create<{ bridge: SlashMenuBridge | null }>({
  name: 'slashCommand',

  addOptions() {
    return { bridge: null };
  },

  addProseMirrorPlugins() {
    const bridge = this.options.bridge;
    if (bridge === null) return [];
    return [
      Suggestion<Block, Block>({
        editor: this.editor,
        pluginKey: new PluginKey('slashCommand'),
        char: '/',
        // Not in code: a path typed there is a path.
        allow: ({ state, range }) => !state.doc.resolve(range.from).parent.type.spec.code,
        items: ({ query }) => bridge.items(query),
        command: ({ editor, range, props }) => props.run(editor, range),
        render: () => ({
          onStart: (props) => bridge.onChange(props),
          onUpdate: (props) => bridge.onChange(props),
          onExit: () => bridge.onChange(null),
          onKeyDown: ({ event }: SuggestionKeyDownProps) => bridge.onKeyDown(event),
        }),
      }),
    ];
  },
});

/** Block syntax at the start of a line, or inline syntax anywhere. */
const MARKDOWN =
  /(^|\n)\s{0,3}(#{1,6}\s|[-*+]\s|\d+[.)]\s|>\s?|```|~~~|\|.+\||<details)|\*\*[^*]+\*\*|~~[^~]+~~|`[^`]+`|\[[^\]]+\]\([^)]+\)/;

/**
 * Pasted Markdown arrives as blocks, the way the same text written by an agent
 * would. Plain text with no Markdown in it, and anything that came with HTML,
 * is left to the editor's own paste.
 */
export const MarkdownPaste = Extension.create({
  name: 'markdownPaste',

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey('markdownPaste'),
        props: {
          handlePaste: (view, event) => {
            const data = event.clipboardData;
            if (data === null || data.types.includes('text/html')) return false;
            const text = data.getData('text/plain');
            if (text === '' || !MARKDOWN.test(text)) return false;
            if (view.state.selection.$from.parent.type.spec.code === true) return false;
            const doc = markdownToDoc(text, view.state.schema);
            view.dispatch(
              view.state.tr.replaceSelection(Slice.maxOpen(doc.content)).scrollIntoView(),
            );
            return true;
          },
        },
      }),
    ];
  },
});
