describe('organizations & memberships', () => {
  it.todo('registration creates a Personal org with an owner membership');
  it.todo('POST /orgs creates an org and makes the caller its owner');
  it.todo('slugs are unique: two orgs named "Acme" get acme and acme-2');
  it.todo('GET /orgs lists every org the user belongs to, with role');
  it.todo('X-Org-Id for an org the user is not in -> 403');
  it.todo('missing X-Org-Id falls back to the Personal org');
});
