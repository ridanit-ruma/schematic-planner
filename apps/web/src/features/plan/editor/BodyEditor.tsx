import type { HocuspocusProvider } from '@hocuspocus/provider';
import { bodyExtensions, Callout, RawMarkdown } from '@schematic/body';
import type { Presence } from '@schematic/ydoc';
import { Collaboration } from '@tiptap/extension-collaboration';
import { CollaborationCaret } from '@tiptap/extension-collaboration-caret';
import { DragHandle } from '@tiptap/extension-drag-handle-react';
import { Placeholder } from '@tiptap/extensions';
import { EditorContent, ReactNodeViewRenderer, useEditor, type Editor } from '@tiptap/react';
import type { SuggestionProps } from '@tiptap/suggestion';
import { GripVertical } from 'lucide-react';
import { useEffect, useMemo, useRef, useState, type MouseEvent } from 'react';
import { createPortal } from 'react-dom';
import type * as Y from 'yjs';

import { useT } from '@/i18n';
import { cn } from '@/lib/utils';

import { matchBlocks, type Block } from './blocks';
import { CalloutView } from './CalloutView';
import { MarkdownPaste, SlashCommand, type SlashMenuBridge } from './extensions';
import { TableControls } from './TableControls';
import './editor.css';

export type Awareness = NonNullable<HocuspocusProvider['awareness']>;

type MenuState = SuggestionProps<Block, Block>;

/**
 * A node's body as blocks, bound to its Y.XmlFragment.
 *
 * Every keystroke is a change to the shared fragment, merged with whatever
 * anybody else — a person in another tab, an agent over MCP — is doing to the
 * same body. Other people's carets are drawn from the plan's awareness, under
 * the name and colour the canvas already shows for them.
 */
export function BodyEditor({
  fragment,
  awareness,
  editable,
  className,
}: {
  fragment: Y.XmlFragment;
  awareness?: Awareness | null;
  editable: boolean;
  className?: string;
}) {
  const t = useT();
  const [menu, setMenu] = useState<MenuState | null>(null);
  const [active, setActive] = useState(0);
  const keys = useRef<(event: KeyboardEvent) => boolean>(() => false);

  const bridge = useMemo<SlashMenuBridge>(
    () => ({
      onChange: (props) => {
        setMenu(props);
        setActive(0);
      },
      onKeyDown: (event) => keys.current(event),
      items: (query) => matchBlocks(query, t.editor.blocks),
    }),
    [t],
  );

  const editor = useEditor(
    {
      editable,
      // Made after the first render, not during it: binding the carets
      // publishes to the plan's awareness, and the canvas re-renders on that.
      immediatelyRender: false,
      shouldRerenderOnTransaction: false,
      extensions: [
        ...bodyExtensions({
          callout: Callout.extend({
            addNodeView() {
              return ReactNodeViewRenderer(CalloutView);
            },
          }),
          rawMarkdown: RawMarkdown.configure({
            HTMLAttributes: { 'data-label': t.editor.raw, title: t.editor.rawHint },
          }),
        }),
        Collaboration.configure({ fragment }),
        ...(awareness != null
          ? [CollaborationCaret.configure({ provider: { awareness }, user: identity(awareness) })]
          : []),
        Placeholder.configure({
          includeChildren: true,
          placeholder: ({ node }) =>
            node.type.name === 'detailsSummary'
              ? t.editor.summaryPlaceholder
              : t.editor.placeholder,
        }),
        SlashCommand.configure({ bridge }),
        MarkdownPaste,
      ],
      editorProps: {
        attributes: {
          class: 'body-editor-content',
          'aria-label': t.editor.label,
          'aria-multiline': 'true',
          role: 'textbox',
        },
      },
    },
    [fragment, awareness, bridge],
  );

  useEffect(() => {
    if (editor !== null && editor.isEditable !== editable) editor.setEditable(editable);
  }, [editor, editable]);

  useEffect(() => {
    const items = menu?.items ?? [];
    keys.current = (event) => {
      if (menu === null) return false;
      if (event.key === 'ArrowDown') {
        setActive((index) => (items.length === 0 ? 0 : (index + 1) % items.length));
        return true;
      }
      if (event.key === 'ArrowUp') {
        setActive((index) => (items.length === 0 ? 0 : (index - 1 + items.length) % items.length));
        return true;
      }
      if (event.key === 'Enter' || event.key === 'Tab') {
        const chosen = items[active];
        if (chosen === undefined) return false;
        menu.command(chosen);
        return true;
      }
      return event.key === 'Escape';
    };
  }, [menu, active]);

  return (
    <div
      className={cn('body-editor', className)}
      // Below the last block is somewhere to keep writing, as it is on paper.
      onMouseDown={(event) => editor !== null && appendOnEmptyClick(event, editor)}
    >
      {editable && editor !== null ? (
        <DragHandle editor={editor} className="body-drag-handle">
          <span aria-label={t.editor.drag} title={t.editor.drag}>
            <GripVertical className="size-3.5" />
          </span>
        </DragHandle>
      ) : null}
      <EditorContent editor={editor} />
      {editable && editor !== null ? <TableControls editor={editor} /> : null}
      {menu !== null ? <SlashMenu menu={menu} active={active} onHover={setActive} /> : null}
    </div>
  );
}

function identity(awareness: Awareness): { name: string; color: string } {
  const presence = awareness.getLocalState()?.['presence'] as Presence | undefined;
  return { name: presence?.name ?? '', color: presence?.color ?? '#5e6ad2' };
}

function appendOnEmptyClick(event: MouseEvent<HTMLDivElement>, editor: Editor): void {
  if (!editor.isEditable || event.target !== event.currentTarget) return;
  event.preventDefault();
  const { doc } = editor.state;
  const last = doc.lastChild;
  if (last !== null && last.type.name === 'paragraph' && last.content.size === 0) {
    editor.commands.focus('end');
    return;
  }
  editor.chain().insertContentAt(doc.content.size, { type: 'paragraph' }).focus('end').run();
}

function SlashMenu({
  menu,
  active,
  onHover,
}: {
  menu: MenuState;
  active: number;
  onHover: (index: number) => void;
}) {
  const t = useT();
  const rect = menu.clientRect?.() ?? null;
  const list = useRef<HTMLDivElement>(null);

  useEffect(() => {
    list.current?.querySelector('[data-active="true"]')?.scrollIntoView({ block: 'nearest' });
  }, [active]);

  if (rect === null) return null;
  // Below the `/`, or above it when the screen has no room left underneath.
  const below = window.innerHeight - rect.bottom > 280;
  const style = {
    left: Math.min(rect.left, window.innerWidth - 232),
    ...(below ? { top: rect.bottom + 6 } : { bottom: window.innerHeight - rect.top + 6 }),
  };

  return createPortal(
    <div
      ref={list}
      role="listbox"
      aria-label={t.editor.slash.label}
      className="fixed z-50 max-h-64 w-56 overflow-y-auto rounded-lg bg-surface-3 p-1 elevated"
      style={style}
      // Keep the editor's selection where the `/` is.
      onMouseDown={(event) => event.preventDefault()}
    >
      {menu.items.length === 0 ? (
        <p className="px-2 py-1.5 text-sm text-ink-faint">{t.editor.slash.noMatch}</p>
      ) : (
        menu.items.map((block, index) => {
          const Icon = block.icon;
          return (
            <button
              key={block.id}
              type="button"
              role="option"
              aria-selected={index === active}
              data-active={index === active}
              onMouseEnter={() => onHover(index)}
              onClick={() => menu.command(block)}
              className={cn(
                'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm text-ink',
                index === active && 'bg-surface-2',
              )}
            >
              <Icon className="size-3.5 text-ink-muted" />
              {t.editor.blocks[block.id]}
            </button>
          );
        })
      )}
    </div>,
    document.body,
  );
}
