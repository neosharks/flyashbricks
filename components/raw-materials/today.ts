/**
 * Today's date for a date input's default, in the device's own calendar. The
 * server still validates it against the organisation's day.
 */
export function localToday(): string {
  const now = new Date();
  const offset = now.getTimezoneOffset() * 60_000;
  return new Date(now.getTime() - offset).toISOString().slice(0, 10);
}
