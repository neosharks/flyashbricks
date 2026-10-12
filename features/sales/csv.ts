/**
 * CSV for spreadsheets. Two things matter beyond quoting:
 *
 * - Formula injection: a cell beginning with `=`, `+`, `-`, `@` (or a tab or
 *   carriage return) is executed by Excel and Sheets. Customer names and notes
 *   are typed by people, so such cells are prefixed with a quote and opened as
 *   text.
 * - Encoding: Excel only reads UTF-8 (and so Hindi names) correctly when the
 *   file starts with a byte-order mark.
 */
export const CSV_BOM = '﻿';

const FORMULA_START = /^[=+\-@\t\r]/;
/** A bare negative number cannot run anything, and quoting it would turn it into text. */
const PLAIN_NUMBER = /^-?\d+(\.\d+)?$/;

export function csvCell(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return '';
  let text = String(value);
  if (typeof value === 'string' && FORMULA_START.test(text) && !PLAIN_NUMBER.test(text))
    text = `'${text}`;
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function csvRow(values: (string | number | null | undefined)[]): string {
  return `${values.map(csvCell).join(',')}\r\n`;
}

/** Rupees as a plain decimal for spreadsheet arithmetic: 125050 → "1250.50". */
export function csvRupees(paise: number): string {
  const sign = paise < 0 ? '-' : '';
  const abs = Math.abs(paise);
  return `${sign}${Math.trunc(abs / 100)}.${String(abs % 100).padStart(2, '0')}`;
}
