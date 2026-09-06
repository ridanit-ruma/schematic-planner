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
        'inline-flex size-5 shrink-0 overflow-hidden rounded-full bg-surface-2 select-none',
        className,
      )}
    >
      {src == null || src === '' ? null : (
        <Primitive.Image src={src} alt="" className="size-full object-cover" />
      )}
      <Primitive.Fallback
        delayMs={src == null || src === '' ? 0 : 400}
        className="grid size-full place-items-center text-2xs font-medium text-ink-muted"
      >
        {(name.trim()[0] ?? '?').toUpperCase()}
      </Primitive.Fallback>
    </Primitive.Root>
  );
}
