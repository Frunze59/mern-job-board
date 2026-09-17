describe('role enforcement on jobs', () => {
  it.todo('owner can create, patch and delete');
  it.todo('recruiter can create, patch and delete');
  it.todo('viewer can list but gets 403 on create, patch and delete');
  it.todo('a recruiter can edit a job created by ANOTHER recruiter in the same org');
  it.todo('a job in org A is invisible from org B (list, get, patch, delete all 404)');
  it.todo('createdBy is set from the JWT and cannot be forged');
  it.todo('list response includes createdByName');
});
