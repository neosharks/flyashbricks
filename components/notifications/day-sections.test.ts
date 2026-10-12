import { describe, expect, it } from 'vitest';
import { relativeDay, sectionsByDay } from './day-sections';

const at = (iso: string) => ({ createdAt: iso });

describe('sectionsByDay', () => {
  it('groups consecutive notifications by the organisation’s day', () => {
    const sections = sectionsByDay(
      [
        at('2026-10-12T10:00:00Z'),
        at('2026-10-12T04:00:00Z'),
        // 23:00 UTC on the 11th is already the 12th in India.
        at('2026-10-11T23:00:00Z'),
        at('2026-10-11T10:00:00Z'),
      ],
      'Asia/Kolkata',
    );
    expect(sections.map((section) => [section.day, section.items.length])).toEqual([
      ['2026-10-12', 3],
      ['2026-10-11', 1],
    ]);
  });
});

describe('relativeDay', () => {
  it('names today and yesterday only', () => {
    expect(relativeDay('2026-10-12', '2026-10-12')).toBe('today');
    expect(relativeDay('2026-10-11', '2026-10-12')).toBe('yesterday');
    expect(relativeDay('2026-10-09', '2026-10-12')).toBeNull();
  });
});
