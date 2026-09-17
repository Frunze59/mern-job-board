describe('GET /stats', () => {
  it.todo('returns the exact shape: countsByStatus, applicationsPerMonth, topCompanies');
  it.todo('countsByStatus matches a small deterministic fixture');
  it.todo('applicationsPerMonth has exactly 6 entries, oldest first, zeros for empty months');
  it.todo('topCompanies is max 3, count desc, ties broken by company asc');
  it.todo('only counts jobs in the active org');
  it.todo('an org with no jobs returns zeros, not an error');
});
