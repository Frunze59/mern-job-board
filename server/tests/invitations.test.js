describe('invitations', () => {
  describe('creating', () => {
    it.todo('owner can invite; response contains an invite URL and expiresAt ~7 days out');
    it.todo('recruiter and viewer get 403 when inviting');
    it.todo('invalid role or email -> 400');
    it.todo('inviting an existing member -> 400');
  });

  describe('accepting as an existing, signed-in user', () => {
    it.todo('matching email -> membership created, token consumed, 200');
    it.todo('signed in as a different email -> 403');
    it.todo('accepting the same token twice -> 410');
  });

  describe('accepting as a brand-new user', () => {
    it.todo('{ password } creates the user, membership, and returns a JWT (201)');
    it.todo('name defaults to the part of the email before @');
    it.todo('email already registered but not signed in -> 403 telling them to sign in');
    it.todo('weak password -> 400 and NO user or membership is created');
  });

  describe('token lifecycle', () => {
    it.todo('unknown token -> 404');
    it.todo('expired token -> 410');
    it.todo('raw token is never stored, only its hash');
  });
});
