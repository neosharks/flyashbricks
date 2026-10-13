import { cn } from '@/lib/utils';

const base =
  'w-full rounded-md border border-border-strong bg-surface py-2.5 text-base text-foreground tabular-nums placeholder:text-foreground-subtle disabled:opacity-60 aria-[invalid]:border-danger aria-[invalid]:ring-1 aria-[invalid]:ring-danger min-h-11';

/**
 * Text, not `type="number"`: number inputs reject "1,250", change value on
 * scroll, and render differently on every phone keyboard. `inputMode` still
 * brings up the numeric keypad. The server parses and validates the text.
 */
export function AmountInput({
  className,
  prefix,
  suffix,
  ...props
}: Omit<React.ComponentPropsWithRef<'input'>, 'type' | 'prefix'> & {
  prefix?: string;
  suffix?: string;
}) {
  return (
    <div className="relative">
      {prefix && (
        <span className="text-foreground-muted pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm">
          {prefix}
        </span>
      )}
      <input
        type="text"
        inputMode="decimal"
        autoComplete="off"
        className={cn(base, prefix ? 'pl-7' : 'pl-3', suffix ? 'pr-14' : 'pr-3', className)}
        {...props}
      />
      {suffix && (
        <span className="text-foreground-muted pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm">
          {suffix}
        </span>
      )}
    </div>
  );
}
