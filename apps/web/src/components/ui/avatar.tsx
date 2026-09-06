import { Avatar as Primitive } from 'radix-ui';

import { cn } from '@/lib/utils';

/**
 * A picture with a letter behind it. The fallback appears only once the image
 * has actually failed or is missing, rather than flashing before every load,
 * which is the part that is tedious to get right by hand — and it was written
 * by hand in three places before this existed.
 */
export function Avatar({
  src,
  name,
  className,
}: {
  src?: string | null;
  name: string;
  className?: string;
}) {
  return (
    <Primitive.Root
      className={cn(
        // Square with a 4px curve rather than a circle: the whole interface is
        // built from modules on a grid, and a lone disc in a row of them reads
        // as borrowed from somewhere else. The inner rim keeps a dark picture
        // from bleeding into a dark surface.
        'inline-flex size-5 shrink-0 overflow-hidden rounded-sm bg-surface-3 text-2xs select-none',
        'shadow-[inset_0_0_0_1px_rgb(255_255_255/0.08)]',
        className,
      )}
    >
      {src == null || src === '' ? null : (
        <Primitive.Image src={src} alt="" className="size-full object-cover" />
      )}
      <Primitive.Fallback
        delayMs={src == null || src === '' ? 0 : 400}
        // Size comes from the box, so a 64px avatar does not draw an 11px letter.
        className="grid size-full place-items-center font-medium text-ink-muted"
      >
        {(name.trim()[0] ?? '?').toUpperCase()}
      </Primitive.Fallback>
    </Primitive.Root>
  );
}
