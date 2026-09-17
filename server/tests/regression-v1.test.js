/**
 * v1 behaviour that must survive v2 untouched. The brief's regression check:
 * register -> create job -> filter -> paginate -> delete.
 * Fill these in during step 19 (harness) so they guard every later step.
 */
describe('v1 regression', () => {
  it.todo('register -> login round trip returns the same user');
  it.todo('create job -> appears in the list for its creator');
  it.todo('status / jobType / search filters narrow the list');
  it.todo('pagination: limit=5 over 12 jobs gives 3 non-overlapping pages');
  it.todo('delete removes the job; second delete is 404');
  it.todo('missing token is 401 on every jobs route');
});
