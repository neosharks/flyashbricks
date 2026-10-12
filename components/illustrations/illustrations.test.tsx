import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { BrickLoader, TruckLoader } from '@/components/ui/brick-loader';
import { EmptyState } from '@/components/ui/empty-state';
import * as illustrations from './index';

describe('illustrations', () => {
  it.each(Object.entries(illustrations))(
    '%s is a scalable, decorative SVG',
    (_name, Illustration) => {
      const { container } = render(<Illustration className="w-10" />);
      const svg = container.querySelector('svg');
      expect(svg).not.toBeNull();
      expect(svg?.getAttribute('aria-hidden')).toBe('true');
      expect(svg?.getAttribute('viewBox')).toMatch(/^0 0 \d+ \d+$/);
      expect(svg?.classList.contains('w-10')).toBe(true);
    },
  );

  it('is shown in an empty state in place of the icon', () => {
    const { container } = render(
      <EmptyState
        illustration={<illustrations.Silo />}
        title="No raw materials yet"
        description="Add fly ash, cement and sand to start."
      />,
    );
    expect(container.querySelector('svg')).not.toBeNull();
    expect(screen.getByRole('heading', { name: 'No raw materials yet' })).toBeInTheDocument();
  });
});

describe('loaders', () => {
  it('announces the brick loader with its label', () => {
    render(<BrickLoader label="Loading sales" />);
    expect(screen.getByRole('status')).toHaveTextContent('Loading sales');
  });

  it('stays silent inside a region that already announces loading', () => {
    render(<BrickLoader label="Loading" announce={false} />);
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('shows the truck loader label to everyone', () => {
    render(<TruckLoader label="Preparing your backup" />);
    expect(screen.getByRole('status')).toHaveTextContent('Preparing your backup');
  });
});
