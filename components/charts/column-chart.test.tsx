import { describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NextIntlClientProvider } from 'next-intl';
import charts from '@/messages/en/charts.json';
import { ColumnChart, type ColumnDatum, type ColumnSeries } from './column-chart';

const series: ColumnSeries[] = [
  { key: 'good', label: 'Good bricks', color: 'chart-1' },
  { key: 'broken', label: 'Broken bricks', color: 'chart-2' },
];

const data: ColumnDatum[] = [
  { label: '1 Oct', values: { good: 100, broken: 10 } },
  { label: '2 Oct', values: { good: 300, broken: 20 } },
  { label: '3 Oct', values: { good: 200, broken: 30 } },
];

function renderChart(overrides: Partial<React.ComponentProps<typeof ColumnChart>> = {}) {
  return render(
    <NextIntlClientProvider locale="en" messages={{ charts }} timeZone="Asia/Kolkata">
      <ColumnChart
        title="Bricks made"
        data={data}
        series={series}
        format={(value) => String(value)}
        emptyLabel="Nothing yet"
        {...overrides}
      />
    </NextIntlClientProvider>,
  );
}

describe('ColumnChart', () => {
  it('writes out the total, the average and the best day', () => {
    renderChart();
    const insights = screen.getAllByRole('definition');
    expect(insights.map((node) => node.textContent)).toEqual(['660', '220', '320· 2 Oct']);
  });

  it('compares with the previous period when one is given', () => {
    renderChart({ previousTotal: 600 });
    expect(screen.getByText(/10% more than the 3 days before/)).toBeInTheDocument();
  });

  it('shows the empty message when there is nothing to plot', () => {
    renderChart({ data: [{ label: '1 Oct', values: { good: 0, broken: 0 } }] });
    expect(screen.getByText('Nothing yet')).toBeInTheDocument();
    expect(screen.queryByRole('slider')).not.toBeInTheDocument();
  });

  it('walks the columns with the arrow keys and announces the chosen one', async () => {
    const user = userEvent.setup();
    renderChart();
    const slider = screen.getByRole('slider');

    slider.focus();
    await user.keyboard('{ArrowRight}');
    expect(slider).toHaveAttribute('aria-valuetext', expect.stringContaining('1 Oct'));

    await user.keyboard('{ArrowRight}');
    expect(slider).toHaveAttribute('aria-valuenow', '1');
    expect(screen.getByRole('status')).toHaveTextContent(
      '2 Oct. Good bricks: 300, Broken bricks: 20',
    );

    await user.keyboard('{Escape}');
    expect(screen.getByRole('status')).toHaveTextContent('');
  });

  it('pins a column with a tap and shows how it compares with the average', async () => {
    const user = userEvent.setup();
    const { container } = renderChart();
    const band = container.querySelectorAll('rect.cursor-pointer')[1];
    if (!band) throw new Error('expected a hit area for the second column');

    await user.click(band);
    expect(screen.getByRole('status')).toHaveTextContent('2 Oct');
    // 320 against an average of 220.
    expect(screen.getByText('45.5% above average')).toBeInTheDocument();

    // A second tap on the same column releases it.
    await user.click(band);
    expect(screen.getByRole('status')).toHaveTextContent('');
  });

  it('hides a series from the legend but never the last one', async () => {
    const user = userEvent.setup();
    renderChart();

    await user.click(screen.getByRole('button', { name: 'Hide Broken bricks' }));
    expect(screen.getByRole('button', { name: 'Show Broken bricks' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
    // The total now counts good bricks only.
    expect(screen.getAllByRole('definition')[0]).toHaveTextContent('600');
    expect(screen.getByRole('button', { name: 'Hide Good bricks' })).toBeDisabled();
  });

  it('opens full screen with every number in a table and other periods to pick', async () => {
    const user = userEvent.setup();
    renderChart({
      rangeKey: '3',
      ranges: [
        { key: '3', label: '3 days', data },
        { key: '2', label: '2 days', data: data.slice(-2), previousTotal: 110 },
      ],
    });

    await user.click(screen.getByRole('button', { name: 'Open “Bricks made” full screen' }));
    const dialog = screen.getByRole('dialog', { name: 'Bricks made' });
    const table = within(dialog).getByRole('table');
    // Header, three days, and the totals row.
    expect(within(table).getAllByRole('row')).toHaveLength(5);

    await user.click(within(dialog).getByRole('radio', { name: '2 days' }));
    expect(within(within(dialog).getByRole('table')).getAllByRole('row')).toHaveLength(4);
    expect(within(dialog).getByText(/more than the 2 days before/)).toBeInTheDocument();

    await user.click(within(dialog).getByRole('button', { name: 'Close' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
