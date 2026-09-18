import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import AcceptInvite from './AcceptInvite';
import customFetch, { TOKEN_KEY, USER_KEY } from '../utils/customFetch';
import { ACTIVE_ORG_KEY } from '../utils/constants';

/**
 * The invite-acceptance form, which the brief singles out for frontend tests.
 *
 * The HTTP calls are stubbed on the axios instance rather than at the network
 * layer, because what is under test is which branch the page shows and what it
 * puts in storage, not how axios serialises a request. The server's own suite
 * covers the endpoints themselves.
 */

const TOKEN = 'raw-invite-token';

const INVITE = {
  email: 'dave@acme.test',
  role: 'recruiter',
  orgName: 'Acme Recruiting',
  expiresAt: '2026-09-25T00:00:00.000Z',
};

const ORG = {
  _id: 'org-1',
  name: 'Acme Recruiting',
  slug: 'acme-recruiting',
  role: 'recruiter',
  isPersonal: false,
};

/** Shaped like an axios rejection, which is what getErrorMessage reads. */
const apiError = (status, msg) =>
  Object.assign(new Error(msg), { response: { status, data: { msg } } });

const signInAs = (email) => {
  localStorage.setItem(TOKEN_KEY, 'stored.jwt');
  localStorage.setItem(USER_KEY, JSON.stringify({ name: 'Stored Person', email }));
};

const renderPage = () =>
  render(
    <MemoryRouter initialEntries={[`/invitations/${TOKEN}`]}>
      <Routes>
        <Route path="/invitations/:token" element={<AcceptInvite />} />
        <Route path="/dashboard" element={<h1>Dashboard</h1>} />
        <Route path="/register" element={<h1>Sign in page</h1>} />
        <Route path="/" element={<h1>Landing</h1>} />
      </Routes>
    </MemoryRouter>
  );

/** Wait for the initial GET to settle, whichever branch it lands on. */
const heading = () => screen.findByRole('heading', { level: 3 });

beforeEach(() => {
  vi.restoreAllMocks();
  vi.spyOn(customFetch, 'get').mockResolvedValue({ data: INVITE });
});

describe('loading the invitation', () => {
  it('asks the server about the token in the URL', async () => {
    renderPage();
    await heading();
    expect(customFetch.get).toHaveBeenCalledWith(`/invitations/${TOKEN}`);
  });

  it('names the organization, the invited address and the role', async () => {
    renderPage();

    expect(await screen.findByText(/Join Acme Recruiting/)).toBeInTheDocument();
    expect(screen.getByText('dave@acme.test')).toBeInTheDocument();
    expect(screen.getByText('recruiter')).toBeInTheDocument();
    expect(screen.getByText(/valid until 25 Sept 2026/)).toBeInTheDocument();
  });

  it('explains an unknown token instead of offering a form', async () => {
    customFetch.get.mockRejectedValue(apiError(404, 'This invitation does not exist'));
    renderPage();

    expect(await screen.findByText('This link cannot be used')).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('This invitation does not exist');
    expect(screen.queryByLabelText('password')).not.toBeInTheDocument();
  });

  it('passes on the reason a spent link is dead', async () => {
    customFetch.get.mockRejectedValue(apiError(410, 'This invitation has already been used'));
    renderPage();

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'This invitation has already been used'
    );
  });
});

describe('signed out: accepting also creates the account', () => {
  it('offers a password rather than a confirm button', async () => {
    renderPage();
    await heading();

    expect(screen.getByLabelText('password')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /join as/ })).not.toBeInTheDocument();
  });

  it('rejects a short password without troubling the server', async () => {
    const post = vi.spyOn(customFetch, 'post');
    renderPage();
    await heading();

    await userEvent.type(screen.getByLabelText('password'), 'short');
    await userEvent.click(screen.getByRole('button', { name: /create account/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Password must be at least 6 characters'
    );
    expect(post).not.toHaveBeenCalled();
  });

  it('stores the new session, marks the org active, and lands on the dashboard', async () => {
    vi.spyOn(customFetch, 'post').mockResolvedValue({
      data: {
        user: { name: 'Dave', email: 'dave@acme.test' },
        token: 'fresh.jwt',
        org: ORG,
        role: 'recruiter',
      },
    });
    renderPage();
    await heading();

    await userEvent.type(screen.getByLabelText('name (optional)'), 'Dave');
    await userEvent.type(screen.getByLabelText('password'), 'Password123');
    await userEvent.click(screen.getByRole('button', { name: /create account/i }));

    expect(await screen.findByRole('heading', { name: 'Dashboard' })).toBeInTheDocument();
    expect(customFetch.post).toHaveBeenCalledWith(`/invitations/${TOKEN}/accept`, {
      password: 'Password123',
      name: 'Dave',
    });
    expect(localStorage.getItem(TOKEN_KEY)).toBe('fresh.jwt');
    expect(JSON.parse(localStorage.getItem(USER_KEY))).toEqual({
      name: 'Dave',
      email: 'dave@acme.test',
    });
    // The point of the whole flow: the new member lands in the org they
    // joined, not in their own Personal one.
    expect(localStorage.getItem(ACTIVE_ORG_KEY)).toBe('org-1');
  });

  it('leaves the name out entirely when it is blank, so the server can default it', async () => {
    vi.spyOn(customFetch, 'post').mockResolvedValue({
      data: { user: {}, token: 't', org: ORG, role: 'recruiter' },
    });
    renderPage();
    await heading();

    await userEvent.type(screen.getByLabelText('password'), 'Password123');
    await userEvent.click(screen.getByRole('button', { name: /create account/i }));

    await waitFor(() => expect(customFetch.post).toHaveBeenCalled());
    expect(customFetch.post.mock.calls[0][1]).toEqual({
      password: 'Password123',
      name: undefined,
    });
  });

  it('sends an already-registered address to sign in rather than taking a password', async () => {
    vi.spyOn(customFetch, 'post').mockRejectedValue(
      apiError(403, 'An account with this email already exists. Please sign in, then open this link again.')
    );
    renderPage();
    await heading();

    await userEvent.type(screen.getByLabelText('password'), 'Password123');
    await userEvent.click(screen.getByRole('button', { name: /create account/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent('already exists');
    expect(screen.getByRole('link', { name: /go to sign in/i })).toHaveAttribute(
      'href',
      '/register'
    );
    expect(localStorage.getItem(TOKEN_KEY)).toBeNull();
  });
});

describe('signed in as the invited person', () => {
  it('confirms in one click, with no body to send', async () => {
    signInAs('dave@acme.test');
    vi.spyOn(customFetch, 'post').mockResolvedValue({
      data: { org: ORG, role: 'recruiter' },
    });
    renderPage();

    await userEvent.click(await screen.findByRole('button', { name: 'join as recruiter' }));

    expect(await screen.findByRole('heading', { name: 'Dashboard' })).toBeInTheDocument();
    expect(customFetch.post).toHaveBeenCalledWith(`/invitations/${TOKEN}/accept`);
    expect(localStorage.getItem(ACTIVE_ORG_KEY)).toBe('org-1');
    // The existing session is untouched; only the active org changed.
    expect(localStorage.getItem(TOKEN_KEY)).toBe('stored.jwt');
  });

  it('recovers in place when the stored token turns out to be stale', async () => {
    signInAs('dave@acme.test');
    vi.spyOn(customFetch, 'post').mockRejectedValue(apiError(401, 'Authentication invalid'));
    renderPage();

    await userEvent.click(await screen.findByRole('button', { name: 'join as recruiter' }));

    // Signed out where they stand, still on the invite page, now able to
    // continue. Redirecting to /register would have lost the invite URL.
    expect(await screen.findByRole('status')).toHaveTextContent('session had expired');
    expect(screen.getByLabelText('password')).toBeInTheDocument();
    expect(localStorage.getItem(TOKEN_KEY)).toBeNull();
    expect(screen.queryByRole('heading', { name: 'Dashboard' })).not.toBeInTheDocument();
  });
});

describe('signed in as somebody else', () => {
  it('says so before any request is made, and offers a way out', async () => {
    signInAs('someone.else@acme.test');
    const post = vi.spyOn(customFetch, 'post');
    renderPage();
    await heading();

    expect(screen.getByText(/You are signed in as/)).toHaveTextContent('someone.else@acme.test');
    expect(screen.queryByRole('button', { name: /join as/ })).not.toBeInTheDocument();
    expect(post).not.toHaveBeenCalled();
  });

  it('drops into the create-account branch once signed out', async () => {
    signInAs('someone.else@acme.test');
    renderPage();
    await heading();

    await userEvent.click(screen.getByRole('button', { name: /sign out and continue/i }));

    expect(screen.getByLabelText('password')).toBeInTheDocument();
    expect(localStorage.getItem(TOKEN_KEY)).toBeNull();
    expect(localStorage.getItem(ACTIVE_ORG_KEY)).toBeNull();
  });
});
