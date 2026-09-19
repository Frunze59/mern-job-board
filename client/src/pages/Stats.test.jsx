import { render, screen } from '@testing-library/react';
import Stats from './Stats';
import customFetch from '../utils/customFetch';

/**
 * The stats page does no counting -- the aggregation does -- so these cover
 * the only two pieces of arithmetic it owns: turning counts into bar widths,
 * and the guards around a month or an organization with nothing in it.
 */

vi.mock('../context/DashboardContext', () => ({
  useDashboardContext: () => ({
    activeOrg: { _id: 'org-1', name: 'Acme Recruiting', role: 'owner' },
  }),
}));

const RESPONSE = {
  countsByStatus: { pending: 167, interview: 167, declined: 166 },
  applicationsPerMonth: [
    { month: '2026-04', count: 32 },
    { month: '2026-05', count: 40 },
    { month: '2026-06', count: 50 },
    { month: '2026-07', count: 54 },
    { month: '2026-08', count: 69 },
    { month: '2026-09', count: 101 },
  ],
  topCompanies: [
    { company: 'Fable Systems', count: 19 },
    { company: 'Delta Labs', count: 18 },
    { company: 'Meridian Systems', count: 18 },
  ],
};

const emptyResponse = {
  countsByStatus: { pending: 0, interview: 0, declined: 0 },
  applicationsPerMonth: RESPONSE.applicationsPerMonth.map(({ month }) => ({ month, count: 0 })),
  topCompanies: [],
};

const renderStats = (data = RESPONSE) => {
  vi.spyOn(customFetch, 'get').mockResolvedValue({ data });
  return render(<Stats />);
};

const barFills = () => document.querySelectorAll('.bar-fill');

beforeEach(() => {
  vi.restoreAllMocks();
});

it('asks for the stats with no query parameters, since the org is a header', async () => {
  renderStats();
  await screen.findByRole('heading', { name: 'Stats' });
  expect(customFetch.get).toHaveBeenCalledWith('/stats');
});

it('shows a tile per status and the total in the subtitle', async () => {
  renderStats();

  expect(await screen.findByText('166')).toBeInTheDocument();
  expect(screen.getAllByText('167')).toHaveLength(2);
  // 167 + 167 + 166, added here only because the endpoint does not return it.
  expect(screen.getByText(/500 jobs in total/)).toBeInTheDocument();
});

it('labels each month from the string, so the label always matches the bucket', async () => {
  renderStats();

  // new Date('2026-04') is midnight UTC, and formatting that anywhere behind
  // UTC prints March. Reading the parts out of the key avoids the whole class
  // of off-by-one-month label bugs, which are invisible in a UTC+ timezone.
  expect(await screen.findByText('Apr 2026')).toBeInTheDocument();
  for (const label of ['May 2026', 'Jun 2026', 'Jul 2026', 'Aug 2026', 'Sep 2026']) {
    expect(screen.getByText(label)).toBeInTheDocument();
  }
});

it('scales every bar against the busiest month', async () => {
  renderStats();
  await screen.findByText('Apr 2026');

  const widths = [...barFills()].map((bar) => bar.style.width);
  expect(widths).toHaveLength(6);
  // September is the busiest, so it is the full width and the rest follow it.
  expect(widths.at(-1)).toBe('100%');
  expect(widths[0]).toBe(`${(32 / 101) * 100}%`);
});

it('ranks companies exactly as the server sent them', async () => {
  renderStats();
  await screen.findByText('Fable Systems');

  const rows = [...document.querySelectorAll('.data-table tbody tr')].map(
    (row) => row.cells[0].textContent
  );
  // Delta before Meridian is the server's tie-break on 18 each. Re-sorting on
  // the client would be a second, disagreeing implementation of that rule.
  expect(rows).toEqual(['Fable Systems', 'Delta Labs', 'Meridian Systems']);
});

describe('an organization with nothing in it', () => {
  it('says so rather than showing six empty bars without explanation', async () => {
    renderStats(emptyResponse);

    expect(await screen.findByText(/No jobs in this organization yet/)).toBeInTheDocument();
    expect(screen.getByText('No companies to rank yet.')).toBeInTheDocument();
  });

  it('draws no bar for a month with no jobs, and no NaN width', async () => {
    renderStats(emptyResponse);
    await screen.findByText('Apr 2026');

    // Every month is zero, so the busiest is zero too and the division would
    // be 0/0. Skipping the fill entirely is what keeps that from happening,
    // and is the only thing keeping it from happening -- a separate floor on
    // the divisor was removed once this test proved it could never be reached.
    expect(barFills()).toHaveLength(0);
    expect(document.body.innerHTML).not.toContain('NaN');
  });
});

it('shows the server message when the request fails', async () => {
  vi.spyOn(customFetch, 'get').mockRejectedValue(
    Object.assign(new Error('nope'), {
      response: { status: 403, data: { msg: 'You are not a member of this organization' } },
    })
  );
  render(<Stats />);

  expect(await screen.findByRole('alert')).toHaveTextContent(
    'You are not a member of this organization'
  );
});
