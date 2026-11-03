import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ToastProvider } from '../../components/ui/Toast.jsx';
import { ImageManager } from './ImageManager.jsx';

const images = [
  { _id: 'i1', url: 'https://x/1.jpg', isPrimary: true },
  { _id: 'i2', url: 'https://x/2.jpg', isPrimary: false },
  { _id: 'i3', url: 'https://x/3.jpg', isPrimary: false },
];
const json = (status, body) => Promise.resolve({ status, ok: status < 400, json: () => Promise.resolve(body) });

function Harness({ initial = images }) {
  const [product, setProduct] = useState({ images: initial });
  return (
    <ToastProvider>
      <ImageManager productId="p1" images={product.images} onProductChange={(u, o) => setProduct((p) => (o?.merge ? { ...p, ...u } : u))} />
      <output data-testid="order">{product.images.map((i) => i._id).join(',')}</output>
    </ToastProvider>
  );
}
const order = () => screen.getByTestId('order').textContent;

beforeEach(() => {
  URL.createObjectURL = vi.fn(() => 'blob:preview');
  URL.revokeObjectURL = vi.fn();
});
afterEach(() => vi.unstubAllGlobals());

describe('ImageManager', () => {
  it('reorders with the keyboard-accessible move buttons and saves the new order', async () => {
    const fetchMock = vi.fn((url, init) =>
      json(200, { product: { images: init.method === 'PUT' ? [images[1], images[0], images[2]] : images } }),
    );
    vi.stubGlobal('fetch', fetchMock);
    render(<Harness />);

    await userEvent.click(screen.getByRole('button', { name: 'Move image 1 later' }));
    expect(order()).toBe('i2,i1,i3');
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain('/admin/products/p1/images/order');
    expect(JSON.parse(init.body)).toEqual({ order: ['i2', 'i1', 'i3'] });
  });

  it('rolls the order back and tells the admin when saving fails', async () => {
    vi.stubGlobal('fetch', vi.fn(() => json(500, { message: 'Server broke' })));
    render(<Harness />);
    await userEvent.click(screen.getByRole('button', { name: 'Move image 1 later' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not save the new order');
    expect(order()).toBe('i1,i2,i3');
  });

  it('reorders by drag and drop', async () => {
    vi.stubGlobal('fetch', vi.fn(() => json(200, { product: { images: [images[1], images[2], images[0]] } })));
    const { container } = render(<Harness />);
    const items = container.querySelectorAll('ul li[draggable]');
    fireEvent.dragStart(items[0]);
    fireEvent.dragOver(items[2]);
    fireEvent.drop(items[2]);
    expect(order()).toBe('i2,i3,i1');
  });

  it('disables moves at the ends and marks the primary image', () => {
    render(<Harness />);
    expect(screen.getByRole('button', { name: 'Move image 1 earlier' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Move image 3 later' })).toBeDisabled();
    expect(screen.getByText('Primary')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Make image 1 the primary image' })).toBeDisabled();
  });

  it('asks for confirmation before deleting an image', async () => {
    const fetchMock = vi.fn(() => json(200, { product: { images: [images[0], images[2]] } }));
    vi.stubGlobal('fetch', fetchMock);
    render(<Harness />);

    await userEvent.click(screen.getByRole('button', { name: 'Delete image 2' }));
    expect(screen.getByRole('dialog', { name: 'Delete this image?' })).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole('button', { name: 'Delete' }));
    await waitFor(() => expect(order()).toBe('i1,i3'));
    expect(fetchMock.mock.calls[0][1].method).toBe('DELETE');
  });

  it('previews valid files, rejects invalid ones and explains why', async () => {
    render(<Harness initial={[]} />);
    const input = screen.getByLabelText('Choose product images');
    const good = new File(['x'], 'photo.png', { type: 'image/png' });
    const bad = new File(['x'], 'notes.gif', { type: 'image/gif' });
    // The browser's file picker honours `accept`, but drag-and-drop does not, so our own checks must catch bad files.
    await userEvent.setup({ applyAccept: false }).upload(input, [good, bad]);

    expect(screen.getByAltText('Preview of photo.png')).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('notes.gif: only JPEG, PNG or WebP');
    expect(screen.getByRole('button', { name: 'Upload 1 image' })).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Remove photo.png from the upload' }));
    expect(screen.queryByAltText('Preview of photo.png')).not.toBeInTheDocument();
  });
});
