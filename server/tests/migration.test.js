describe('migration 001-orgs', () => {
  it.todo('gives a pre-v2 user a Personal org, owner membership, and moves their jobs');
  it.todo('running it twice creates no extra orgs, memberships, or job changes');
  it.todo('a user who already has a membership is skipped and counted as such');
  it.todo('recovers when a Personal org exists but its membership is missing');
  it.todo('summary counts are accurate');
});
