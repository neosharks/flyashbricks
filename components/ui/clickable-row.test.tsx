import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import Link from 'next/link';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { ClickableRow, PanelLink } from './clickable-row';

const push = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));

function screenIsWide(wide: boolean) {
  window.matchMedia = vi.fn().mockReturnValue({ matches: wide });
}

function renderRow(panelHref?: string) {
  render(
    <table>
      <tbody>
        <ClickableRow href="/sales/1" panelHref={panelHref}>
          <td>
            <PanelLink href="/sales/1" panelHref={panelHref}>
              S-0001
            </PanelLink>
          </td>
          <td>Plain cell</td>
          <td>
            <Link href="/customers/9">Ramesh</Link>
          </td>
        </ClickableRow>
      </tbody>
    </table>,
  );
}

beforeEach(() => push.mockClear());
afterEach(() => vi.restoreAllMocks());

describe('ClickableRow', () => {
  it('opens the record beside the list on a wide screen', () => {
    screenIsWide(true);
    renderRow('/sales?open=1');
    fireEvent.click(screen.getByText('Plain cell'));
    expect(push).toHaveBeenCalledWith('/sales?open=1', { scroll: false });
  });

  it("opens the record's own page on a narrow screen, or where there is no panel", () => {
    screenIsWide(false);
    renderRow('/sales?open=1');
    fireEvent.click(screen.getByText('Plain cell'));
    expect(push).toHaveBeenCalledWith('/sales/1');

    cleanup();
    push.mockClear();
    screenIsWide(true);
    renderRow();
    fireEvent.click(screen.getByText('Plain cell'));
    expect(push).toHaveBeenCalledWith('/sales/1');
  });

  it('leaves links inside the row to go where they point', () => {
    screenIsWide(true);
    renderRow('/sales?open=1');
    fireEvent.click(screen.getByText('Ramesh'));
    expect(push).not.toHaveBeenCalled();
  });

  it('opens a new tab on Ctrl/⌘-click', () => {
    screenIsWide(true);
    const open = vi.spyOn(window, 'open').mockReturnValue(null);
    renderRow('/sales?open=1');
    fireEvent.click(screen.getByText('Plain cell'), { ctrlKey: true });
    expect(open).toHaveBeenCalledWith('/sales/1', '_blank', 'noopener');
    expect(push).not.toHaveBeenCalled();
  });
});

describe('PanelLink', () => {
  it('keeps its real address and opens the panel on a plain click when wide', () => {
    screenIsWide(true);
    renderRow('/sales?open=1');
    const link = screen.getByRole('link', { name: 'S-0001' });
    expect(link).toHaveAttribute('href', '/sales/1');
    fireEvent.click(link);
    expect(push).toHaveBeenCalledWith('/sales?open=1', { scroll: false });
  });
});
