import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { Spinner } from './spinner';
import { cn } from '@/lib/utils';

const buttonVariants = cva(
  // min-h-11 keeps every button at or above the 44px touch target.
  'relative inline-flex min-h-11 items-center justify-center gap-2 rounded-md text-sm font-medium transition-colors duration-150 disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-4 [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        primary: 'bg-action text-action-foreground hover:bg-action-hover',
        secondary: 'bg-surface-muted text-foreground hover:bg-border',
        outline: 'border border-border-strong bg-surface text-foreground hover:bg-surface-muted',
        ghost: 'text-foreground hover:bg-surface-muted',
        danger: 'bg-danger text-action-foreground hover:bg-danger-hover',
        // Clearly red without shouting: sign out, remove.
        'danger-soft':
          'border border-danger/30 bg-danger-subtle text-danger hover:bg-danger hover:text-action-foreground',
        link: 'min-h-0 text-action underline-offset-4 hover:underline',
      },
      size: {
        sm: 'px-3 text-sm sm:h-9 sm:min-h-9',
        md: 'px-4 py-2',
        lg: 'px-6 py-3 text-base',
        icon: 'size-11 px-0',
      },
      full: { true: 'w-full', false: '' },
    },
    defaultVariants: { variant: 'primary', size: 'md', full: false },
  },
);

export type ButtonProps = React.ComponentPropsWithRef<'button'> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
    /**
     * Shows a spinner, blocks further clicks and sets `aria-busy`. Use it for
     * any action that reaches the network — an unacknowledged click reads as a
     * broken button within about a second.
     */
    loading?: boolean;
  };

export function Button({
  className,
  variant,
  size,
  full,
  asChild = false,
  loading = false,
  disabled,
  children,
  ...props
}: ButtonProps) {
  const Component = asChild ? Slot : 'button';

  // `asChild` renders someone else's element, which must receive a single child.
  if (asChild) {
    return (
      <Component className={cn(buttonVariants({ variant, size, full }), className)} {...props}>
        {children}
      </Component>
    );
  }

  return (
    <Component
      className={cn(buttonVariants({ variant, size, full }), className)}
      disabled={disabled ?? loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading && <Spinner label={null} />}
      {children}
    </Component>
  );
}

export { buttonVariants };
