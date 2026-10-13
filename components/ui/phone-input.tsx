import { cn } from '@/lib/utils';

/**
 * An Indian mobile number field: a fixed "+91" in front, the phone keypad on
 * mobiles, and room for the spaces people type. The server normalises it.
 */
export function PhoneInput({
  className,
  ...props
}: Omit<React.ComponentPropsWithRef<'input'>, 'type' | 'inputMode'>) {
  return (
    <div className="relative">
      <span className="text-foreground-muted pointer-events-none absolute inset-y-0 left-3 flex items-center text-base tabular-nums">
        +91
      </span>
      <input
        type="tel"
        inputMode="tel"
        autoComplete="tel-national"
        maxLength={16}
        className={cn(
          'border-border-strong bg-surface text-foreground placeholder:text-foreground-subtle aria-[invalid]:border-danger aria-[invalid]:ring-danger min-h-11 w-full rounded-md border py-2.5 pr-3 pl-12 text-base tabular-nums aria-[invalid]:ring-1',
          className,
        )}
        {...props}
      />
    </div>
  );
}
