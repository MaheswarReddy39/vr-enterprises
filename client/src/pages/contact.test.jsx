import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { EnquiryForm, validateEnquiry } from '../components/store/EnquiryForm.jsx';
import { isPlaceholder, mailHref, telHref } from '../config/business.js';
import { json, makeProduct, mockApi } from '../test/storeFixtures.js';
import ContactPage from './ContactPage.jsx';

afterEach(() => vi.unstubAllGlobals());

const fill = async ({ name = 'Asha Rao', email = 'asha@example.com', message = 'I would like some advice please.' } = {}) => {
  await userEvent.type(screen.getByLabelText(/Your name/), name);
  await userEvent.type(screen.getByLabelText(/^Email/), email);
  await userEvent.type(screen.getByLabelText(/^Message/), message);
};

describe('validateEnquiry', () => {
  const ok = { name: 'Asha', email: 'a@b.co', phone: '', message: '1234567890' };
  it('accepts a valid enquiry, with the phone optional', () => {
    expect(validateEnquiry(ok)).toEqual({});
    expect(validateEnquiry({ ...ok, phone: '+91 98765-43210' })).toEqual({});
  });
  it('flags every invalid field', () => {
    expect(Object.keys(validateEnquiry({ name: 'A', email: 'x', phone: 'abc', message: 'short' })).sort()).toEqual(['email', 'message', 'name', 'phone']);
  });
});

describe('EnquiryForm', () => {
  it('validates accessibly and does not call the API while invalid', async () => {
    const calls = mockApi({});
    render(<EnquiryForm idPrefix="t" />);
    await userEvent.click(screen.getByRole('button', { name: 'Send enquiry' }));
    expect(screen.getByLabelText(/Your name/)).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByLabelText(/Your name/)).toHaveFocus();
    expect(screen.getByText('Please enter a valid email address.')).toBeInTheDocument();
    expect(calls).toHaveLength(0);
  });

  it('submits the enquiry (without the honeypot) and confirms', async () => {
    const calls = mockApi({ 'POST /store/enquiries': () => json(201, { success: true }) });
    render(<EnquiryForm idPrefix="t" product={{ id: 'p1', name: 'Alpha' }} />);
    expect(screen.getByText('Alpha')).toBeInTheDocument();
    await fill();
    await userEvent.click(screen.getByRole('button', { name: 'Send enquiry' }));
    expect(await screen.findByRole('status')).toHaveTextContent('Thank you, your enquiry has been sent.');
    expect(calls[0].body).toEqual({ name: 'Asha Rao', email: 'asha@example.com', message: 'I would like some advice please.', product: 'p1' });
    expect(calls[0].headers.Authorization).toBeUndefined();
  });

  it('keeps the honeypot field hidden from people and assistive technology', () => {
    const { container } = render(<EnquiryForm idPrefix="t" />);
    const trap = container.querySelector('input[name="website"]');
    expect(trap.closest('[aria-hidden="true"]')).not.toBeNull();
    expect(trap).toHaveAttribute('tabindex', '-1');
  });

  it('shows server-side validation and keeps what was typed', async () => {
    mockApi({ 'POST /store/enquiries': () => json(400, { message: 'Validation failed.', details: [{ path: 'body.email', message: 'Server says bad email.' }] }) });
    render(<EnquiryForm idPrefix="t" />);
    await fill();
    await userEvent.click(screen.getByRole('button', { name: 'Send enquiry' }));
    expect(await screen.findByText('Server says bad email.')).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('Please check the highlighted fields.');
    expect(screen.getByLabelText(/Your name/)).toHaveValue('Asha Rao');
  });

  it('reports network failures without losing the message', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new TypeError('Failed to fetch'))));
    render(<EnquiryForm idPrefix="t" />);
    await fill();
    await userEvent.click(screen.getByRole('button', { name: 'Send enquiry' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/Cannot reach the server/);
    expect(screen.getByLabelText(/^Message/)).toHaveValue('I would like some advice please.');
  });
});

describe('contact page', () => {
  it('pre-fills the product from ?product= and ignores unknown products', async () => {
    mockApi({ 'GET /store/products/alpha': () => json(200, { success: true, product: makeProduct({ id: 'p9', name: 'Alpha' }) }) });
    const { unmount } = render(<MemoryRouter initialEntries={['/contact?product=alpha']}><ContactPage /></MemoryRouter>);
    expect(await screen.findByText('Alpha')).toBeInTheDocument();
    unmount();

    mockApi({ 'GET /store/products/nope': () => json(404, { message: 'nf' }) });
    render(<MemoryRouter initialEntries={['/contact?product=nope']}><ContactPage /></MemoryRouter>);
    expect(await screen.findByRole('heading', { name: 'Send an enquiry' })).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByText(/Enquiring about/)).not.toBeInTheDocument());
  });

  it('shows the real contact details as links and hides the details not supplied yet', async () => {
    mockApi({});
    render(<MemoryRouter initialEntries={['/contact']}><ContactPage /></MemoryRouter>);
    expect((await screen.findAllByRole('link', { name: '9346411218' }))[0]).toHaveAttribute('href', 'tel:9346411218');
    expect(screen.getAllByRole('link', { name: 'maheswarreddygondireddy12@gmail.com' })[0]).toHaveAttribute('href', 'mailto:maheswarreddygondireddy12@gmail.com');
    expect(screen.getAllByText(/Yerraguntla Circle, Dharmavaram/).length).toBeGreaterThan(0);
    expect(screen.queryByText('Hours')).not.toBeInTheDocument(); // hours were not supplied: never invented, simply not shown
  });
});

describe('business helpers', () => {
  it('treats [bracketed] text as placeholders and only links real values', () => {
    expect(isPlaceholder('[Add phone]')).toBe(true);
    expect(isPlaceholder('+91 98765 43210')).toBe(false);
    expect(telHref('[Add phone]')).toBeNull();
    expect(telHref('+91 98765 43210')).toBe('tel:+919876543210');
    expect(mailHref('[Add email]')).toBeNull();
    expect(mailHref('hello@example.com')).toBe('mailto:hello@example.com');
  });
});
