import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { lookFor, WorkerAvatar } from './worker-avatar';

describe('worker avatars', () => {
  it('gives every one of the 100 variants a different look', () => {
    const looks = new Set(
      Array.from({ length: 100 }, (_, variant) => {
        const look = lookFor(variant);
        return `${look.skin}|${look.hat}|${look.extra}`;
      }),
    );
    expect(looks.size).toBe(100);
  });

  it('wraps out-of-range variants instead of failing', () => {
    expect(lookFor(100)).toEqual(lookFor(0));
    expect(lookFor(-1)).toEqual(lookFor(99));
  });

  it('renders a decorative picture for each gender', () => {
    for (const gender of ['male', 'female', 'other', 'unspecified'] as const) {
      const { container } = render(<WorkerAvatar gender={gender} variant={42} />);
      const svg = container.querySelector('svg');
      expect(svg?.getAttribute('aria-hidden')).toBe('true');
    }
  });
});
