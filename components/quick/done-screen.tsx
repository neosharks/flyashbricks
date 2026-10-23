import Link from 'next/link';
import { CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

/** After saving: a clear "done", what was saved, and the two likely next taps. */
export function DoneScreen({
  title,
  detail,
  again,
  onAgain,
  home,
  extra,
}: {
  title: string;
  detail?: React.ReactNode;
  again: string;
  onAgain: () => void;
  home: string;
  extra?: React.ReactNode;
}) {
  return (
    <div className="flex min-h-[calc(100dvh-3.5rem-env(safe-area-inset-top))] flex-col items-center justify-center gap-6 py-8 text-center">
      <CheckCircle2 aria-hidden className="text-success size-20" strokeWidth={1.5} />
      <div role="status">
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {detail && <div className="text-foreground-muted mt-2 text-base">{detail}</div>}
      </div>
      <div className="flex w-full flex-col gap-3">
        {extra}
        <Button type="button" size="lg" full onClick={onAgain}>
          {again}
        </Button>
        <Button asChild size="lg" variant="outline" full>
          <Link href="/quick">{home}</Link>
        </Button>
      </div>
    </div>
  );
}
