'use client';

import { Printer } from 'lucide-react';
import { Button } from '@/components/ui/button';

/** The browser's print dialog also offers "Save as PDF" on every platform. */
export function PrintButton({ label }: { label: string }) {
  return (
    <Button size="lg" onClick={() => window.print()} className="w-full sm:w-auto print:hidden">
      <Printer aria-hidden />
      {label}
    </Button>
  );
}
