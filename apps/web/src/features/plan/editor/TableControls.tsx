import { useEditorState, type Editor } from '@tiptap/react';
import { Columns2, Rows2, Trash2, type LucideIcon } from 'lucide-react';

import { Tooltip } from '@/components/ui/tooltip';
import { useT } from '@/i18n';
import { cn } from '@/lib/utils';

/**
 * Row and column controls, shown while the cursor is in a table.
 *
 * A strip under the editor rather than handles on the grid: the panel is 320px
 * wide, and a table in it already has little room to spare.
 */
export function TableControls({ editor }: { editor: Editor }) {
  const t = useT();
  const inTable = useEditorState({
    editor,
    selector: ({ editor: current }) => current.isActive('table'),
  });
  if (!inTable) return null;

  const actions: { label: string; icon: LucideIcon; run: () => boolean; danger?: boolean }[] = [
    {
      label: t.editor.table.addRow,
      icon: Rows2,
      run: () => editor.chain().focus().addRowAfter().run(),
    },
    {
      label: t.editor.table.addColumn,
      icon: Columns2,
      run: () => editor.chain().focus().addColumnAfter().run(),
    },
    {
      label: t.editor.table.deleteRow,
      icon: Rows2,
      run: () => editor.chain().focus().deleteRow().run(),
      danger: true,
    },
    {
      label: t.editor.table.deleteColumn,
      icon: Columns2,
      run: () => editor.chain().focus().deleteColumn().run(),
      danger: true,
    },
    {
      label: t.editor.table.deleteTable,
      icon: Trash2,
      run: () => editor.chain().focus().deleteTable().run(),
      danger: true,
    },
  ];

  return (
    <div className="mt-1.5 flex flex-wrap gap-1" onMouseDown={(event) => event.preventDefault()}>
      {actions.map(({ label, icon: Icon, run, danger }) => (
        <Tooltip key={label} content={label}>
          <button
            type="button"
            aria-label={label}
            onClick={() => run()}
            className={cn(
              'relative grid size-6 place-items-center rounded-md text-ink-muted hover:bg-surface-3 hover:text-ink',
              danger === true && 'hover:text-danger',
            )}
          >
            <Icon className="size-3.5" />
            {danger === true ? null : (
              <span aria-hidden className="absolute right-0.5 bottom-0 text-[9px] leading-none">
                +
              </span>
            )}
            {danger === true && Icon !== Trash2 ? (
              <span aria-hidden className="absolute right-0.5 bottom-0 text-[9px] leading-none">
                −
              </span>
            ) : null}
          </button>
        </Tooltip>
      ))}
    </div>
  );
}
