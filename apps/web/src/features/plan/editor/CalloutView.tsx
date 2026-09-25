import { CALLOUT_VARIANTS, type CalloutVariant } from '@schematic/body';
import { NodeViewContent, NodeViewWrapper, type NodeViewProps } from '@tiptap/react';
import {
  AlertCircle,
  AlertTriangle,
  ChevronDown,
  Info,
  Lightbulb,
  type LucideIcon,
} from 'lucide-react';

import { DropdownItem, DropdownMenu } from '@/components/ui/dropdown-menu';
import { useT } from '@/i18n';

export const CALLOUT_ICON: Record<CalloutVariant, LucideIcon> = {
  note: Info,
  tip: Lightbulb,
  warning: AlertTriangle,
  danger: AlertCircle,
};

/** A type written by hand (`[!info]`) is drawn as a note and kept as written. */
export function calloutVariant(value: unknown): CalloutVariant {
  const lower = String(value ?? '').toLowerCase();
  return (CALLOUT_VARIANTS as readonly string[]).includes(lower)
    ? (lower as CalloutVariant)
    : 'note';
}

/**
 * A callout in the editor: its type chosen from a menu, its title typed in the
 * header, its body ordinary blocks.
 */
export function CalloutView({ node, updateAttributes, editor, getPos }: NodeViewProps) {
  const t = useT();
  const written = String(node.attrs['variant'] ?? 'note');
  const variant = calloutVariant(written);
  const known = variant === written.toLowerCase();
  const Icon = CALLOUT_ICON[variant];
  const editable = editor.isEditable;

  return (
    <NodeViewWrapper className="body-callout" data-callout={variant}>
      <div className="body-callout-head" contentEditable={false}>
        {editable ? (
          <DropdownMenu
            trigger={
              <button
                type="button"
                className="body-callout-type"
                aria-label={t.editor.callout.type}
              >
                <Icon className="size-3.5" />
                <span>{known ? t.editor.callout.variants[variant] : written}</span>
                <ChevronDown className="size-3" />
              </button>
            }
          >
            {CALLOUT_VARIANTS.map((choice) => {
              const ChoiceIcon = CALLOUT_ICON[choice];
              return (
                <DropdownItem
                  key={choice}
                  selected={known && choice === variant}
                  onSelect={() => updateAttributes({ variant: choice })}
                >
                  <ChoiceIcon className="size-3.5" />
                  {t.editor.callout.variants[choice]}
                </DropdownItem>
              );
            })}
          </DropdownMenu>
        ) : (
          <span className="body-callout-type">
            <Icon className="size-3.5" />
          </span>
        )}
        <input
          className="body-callout-title"
          value={String(node.attrs['title'] ?? '')}
          placeholder={known ? t.editor.callout.variants[variant] : written}
          aria-label={t.editor.callout.title}
          readOnly={!editable}
          onChange={(event) => updateAttributes({ title: event.target.value.replace(/\n/g, ' ') })}
          onKeyDown={(event) => {
            // Into the body, as Enter leaves a heading.
            if (event.key === 'Enter') {
              event.preventDefault();
              const at = getPos();
              if (typeof at !== 'number') return;
              editor
                .chain()
                .focus()
                .setTextSelection(at + 2)
                .run();
            }
          }}
        />
      </div>
      <NodeViewContent className="body-callout-body" />
    </NodeViewWrapper>
  );
}
