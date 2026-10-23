// Plain strings, not in the client module: a server component importing a
// value from a 'use client' file gets a reference, not the value.

/**
 * The record open in the panel: tinted, outlined and marked with a bar down
 * its left edge, so it is plain which row the panel belongs to.
 */
export const SELECTED_ROW =
  'bg-action-subtle hover:bg-action-subtle font-medium outline outline-2 -outline-offset-2 outline-action [&>td:first-child]:shadow-[inset_5px_0_0_var(--color-action)]';

/** The same for a card in a list. */
export const SELECTED_CARD =
  'border-action bg-action-subtle hover:bg-action-subtle ring-2 ring-action shadow-[inset_5px_0_0_var(--color-action)]';
