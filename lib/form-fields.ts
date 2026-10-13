/**
 * Finds the control behind a field error key, its label, and brings it into
 * view. Keys are the schema paths the server reports (`name`, `lines.0.qty`);
 * a control whose `name` cannot match its key (repeated or folded fields)
 * says which key it answers to with `data-error-key`.
 */

export function findControl(form: HTMLFormElement, key: string): HTMLElement | null {
  const marked = form.querySelector<HTMLElement>(`[data-error-key="${key}"]`);
  if (marked) return marked;
  const named = form.elements.namedItem(key);
  const element = named instanceof Element ? named : (named?.[0] ?? null);
  if (!(element instanceof HTMLElement)) return null;
  if (element instanceof HTMLInputElement && element.type === 'hidden') return null;
  return element;
}

/** The keys a control's value feeds: its marked key and its name. */
export function keysOf(target: EventTarget | null): string[] {
  if (!(target instanceof HTMLElement)) return [];
  return [target.dataset.errorKey, target.getAttribute('name')].filter(
    (key): key is string => typeof key === 'string' && key !== '',
  );
}

/** The visible label of a control: its `<label>`, or the group's legend for a choice. */
function labelOf(control: HTMLElement): string | null {
  const choice =
    control instanceof HTMLInputElement &&
    (control.type === 'radio' || control.type === 'checkbox');
  const legend = choice ? control.closest('fieldset')?.querySelector('legend') : null;
  const label =
    legend ??
    ('labels' in control ? (control.labels as NodeListOf<HTMLLabelElement> | null)?.[0] : null);
  const text = label
    ? (label.dataset.label ?? label.textContent)
    : control.getAttribute('aria-label');
  const trimmed = text?.trim();
  return trimmed === undefined || trimmed === '' ? null : trimmed;
}

/** For each key with a control in the form, the label to name it by. */
export function describeFields(
  form: HTMLFormElement,
  keys: string[],
): Record<string, { label: string | null }> {
  const found: Record<string, { label: string | null }> = {};
  for (const key of keys) {
    const control = findControl(form, key);
    if (control) found[key] = { label: labelOf(control) };
  }
  return found;
}

/** A choice group carries the error itself; focus lands on its chosen (or first) option. */
function focusable(element: HTMLElement): HTMLElement {
  if (element.getAttribute('role') !== 'radiogroup') return element;
  return (
    element.querySelector<HTMLElement>('input:checked:not(:disabled)') ??
    element.querySelector<HTMLElement>('input:not(:disabled)') ??
    element
  );
}

/** Opens any "More options" section around the element, scrolls to it, and focuses it. */
export function reveal(element: HTMLElement): void {
  for (
    let details = element.closest('details');
    details;
    details = details.parentElement?.closest('details') ?? null
  ) {
    details.open = true;
  }
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  element.scrollIntoView({ block: 'center', behavior: reduce ? 'auto' : 'smooth' });
  focusable(element).focus({ preventScroll: true });
}

export function revealField(form: HTMLFormElement | null, key: string): void {
  const control = form ? findControl(form, key) : null;
  if (control) reveal(control);
}

/**
 * After a failed submit: every "More options" section holding an error opens,
 * and focus moves to the first highlighted control in reading order, or to
 * the error summary when nothing on screen can take focus.
 */
export function revealFirstError(form: HTMLFormElement): void {
  for (const details of form.querySelectorAll('details:not([open])')) {
    if (details.querySelector('[aria-invalid="true"]')) {
      (details as HTMLDetailsElement).open = true;
    }
  }
  const target =
    form.querySelector<HTMLElement>('[aria-invalid="true"]:not(:disabled)') ??
    form.querySelector<HTMLElement>('[data-form-errors]');
  if (target) reveal(target);
}
