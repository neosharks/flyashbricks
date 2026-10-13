'use client';

import Link from 'next/link';
import { useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { ChevronDown, LogOut, UserRound } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { signOutAction } from '@/features/auth/actions';
import { Avatar } from '@/components/ui/avatar';
import type { Gender } from '@/models/constants';

export function UserMenu({
  name,
  roleLabel,
  imageId,
  gender,
  variant,
}: {
  name: string;
  roleLabel: string;
  imageId: string | null;
  gender: Gender;
  variant: number;
}) {
  const t = useTranslations('nav');
  const [pending, startTransition] = useTransition();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={t('accountMenu', { name })}
        className="hover:bg-surface-muted flex min-h-10 items-center gap-2 rounded-md px-1.5 text-sm"
      >
        <Avatar name={name} imageId={imageId} gender={gender} variant={variant} size="sm" />
        <span className="hidden flex-col items-start leading-tight sm:flex">
          <span className="font-medium">{name}</span>
          <span className="text-foreground-muted text-xs">{roleLabel}</span>
        </span>
        <ChevronDown aria-hidden className="text-foreground-muted size-4" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem asChild>
          <Link href="/account">
            <UserRound aria-hidden className="size-4" />
            {t('account')}
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          className="text-danger focus:bg-danger-subtle"
          disabled={pending}
          onSelect={() =>
            startTransition(async () => {
              await signOutAction();
            })
          }
        >
          <LogOut aria-hidden className="size-4" />
          {pending ? t('signingOut') : t('signOut')}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
