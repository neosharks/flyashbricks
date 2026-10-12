import { cn } from '@/lib/utils';

export function Card({ className, ...props }: React.ComponentPropsWithRef<'div'>) {
  return (
    <div
      className={cn('border-border bg-surface-raised rounded-lg border shadow-xs', className)}
      {...props}
    />
  );
}

export function CardHeader({ className, ...props }: React.ComponentPropsWithRef<'div'>) {
  return (
    <div
      className={cn('border-border flex flex-col gap-1 border-b p-4 sm:p-5', className)}
      {...props}
    />
  );
}

export function CardTitle({ className, children, ...props }: React.ComponentPropsWithRef<'h2'>) {
  return (
    <h2 className={cn('text-base font-semibold', className)} {...props}>
      {children}
    </h2>
  );
}

export function CardBody({ className, ...props }: React.ComponentPropsWithRef<'div'>) {
  return <div className={cn('p-4 sm:p-5', className)} {...props} />;
}

export function CardFooter({ className, ...props }: React.ComponentPropsWithRef<'div'>) {
  return <div className={cn('border-border border-t p-4 sm:p-5', className)} {...props} />;
}
