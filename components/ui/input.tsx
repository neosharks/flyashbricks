import { cn } from '@/lib/utils';

const base =
  'w-full rounded-md border border-border-strong bg-surface px-3 py-2.5 text-base text-foreground placeholder:text-foreground-muted disabled:cursor-not-allowed disabled:opacity-60 aria-[invalid]:border-danger';

export function Input({ className, ...props }: React.ComponentPropsWithRef<'input'>) {
  return <input className={cn(base, 'min-h-11', className)} {...props} />;
}

export function Textarea({ className, ...props }: React.ComponentPropsWithRef<'textarea'>) {
  return <textarea className={cn(base, 'min-h-28 resize-y', className)} {...props} />;
}

export function Select({ className, children, ...props }: React.ComponentPropsWithRef<'select'>) {
  return (
    <select className={cn(base, 'min-h-11 pr-8', className)} {...props}>
      {children}
    </select>
  );
}

export function Checkbox({ className, ...props }: React.ComponentPropsWithRef<'input'>) {
  return (
    <input
      type="checkbox"
      className={cn('border-border-strong text-action accent-action size-5 rounded', className)}
      {...props}
    />
  );
}
